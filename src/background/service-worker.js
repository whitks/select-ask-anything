const DEFAULT_SETTINGS = {
  apiKey: "",
  model: "moonshotai/kimi-k2-instruct-0905",
  depth: "very-deep",
  maxSelectionChars: 6000,
  maxHistoryItems: 50,
  requestTimeoutMs: 45000
};

// Polyfill for cross-browser compatibility
const browser = globalThis.browser || globalThis.chrome;

const activeStreamControllers = new Map();

function storageGet(keys) {
  return new Promise((resolve) => browser.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => browser.storage.local.set(values, resolve));
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    browser.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (browser.runtime.lastError) {
        reject(new Error(browser.runtime.lastError.message));
        return;
      }
      if (!tabs.length || !tabs[0].id) {
        reject(new Error("No active tab found."));
        return;
      }
      resolve(tabs[0]);
    });
  });
}

function getDepthInstruction(depth) {
  switch (depth) {
    case "short":
      return "Keep the explanation concise while still accurate.";
    case "medium":
      return "Provide balanced detail with key concepts and one practical example.";
    case "very-deep":
    default:
      return "Go very deep with layered conceptual detail, examples, caveats, and misconceptions.";
  }
}

function deepExplainPrompt(selectedText, pageTitle, pageUrl, depth) {
  return [
    "Explain the following selected text deeply.",
    getDepthInstruction(depth),
    "",
    "Response requirements:",
    "1) Core meaning in plain words.",
    "2) Concept-by-concept breakdown.",
    "3) Hidden assumptions or prerequisites.",
    "4) Concrete examples and analogies.",
    "5) Edge cases, caveats, and common misunderstandings.",
    "6) Quick recap bullets at the end.",
    "",
    `Page title: ${pageTitle || "Unknown"}`,
    `Page URL: ${pageUrl || "Unknown"}`,
    "",
    "Selected text:",
    selectedText
  ].join("\n");
}

function quickDefinitionPrompt(selectedText, pageTitle, pageUrl) {
  return [
    "Give a concise definition of the selected text.",
    "Output rules:",
    "- Strictly 3 to 5 short lines.",
    "- No headings, no bullet points, no extra sections.",
    "- Keep it clear and beginner-friendly.",
    "",
    `Page title: ${pageTitle || "Unknown"}`,
    `Page URL: ${pageUrl || "Unknown"}`,
    "",
    "Selected text:",
    selectedText
  ].join("\n");
}

async function getSettings() {
  const existing = await storageGet(Object.keys(DEFAULT_SETTINGS));
  return {
    ...DEFAULT_SETTINGS,
    ...existing
  };
}

async function saveHistoryEntry(entry, maxHistoryItems) {
  const stored = await storageGet(["history"]);
  const history = Array.isArray(stored.history) ? stored.history : [];
  const next = [entry, ...history].slice(0, maxHistoryItems);
  await storageSet({ history: next });
}

function sendStreamEvent(tabId, payload) {
  browser.tabs.sendMessage(tabId, { type: "DEEP_EXPLAIN_STREAM", payload }, () => {
    void browser.runtime.lastError;
  });
}

function dispatchExplainTrigger(tabId) {
  browser.tabs.sendMessage(tabId, { type: "DEEP_EXPLAIN_TRIGGER" }, () => {
    void browser.runtime.lastError;
  });
}

async function streamGroqExplanation({ requestId, apiKey, model, prompt, timeoutMs, onChunk }) {
  const controller = new AbortController();
  activeStreamControllers.set(requestId, controller);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_completion_tokens: 4096,
        top_p: 1,
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "You are an expert tutor. Your explanations are deep, precise, and easy to follow."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      let details = "Unknown Groq API error.";

      try {
        const parsed = JSON.parse(errorText);
        details = parsed?.error?.message || details;
      } catch {
        if (errorText?.trim()) {
          details = errorText.trim();
        }
      }

      throw new Error(details);
    }

    if (!response.body) {
      throw new Error("No stream body returned by Groq.");
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        const lines = event
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("data:"));

        for (const line of lines) {
          const payloadText = line.slice(5).trim();

          if (!payloadText || payloadText === "[DONE]") {
            continue;
          }

          try {
            const parsed = JSON.parse(payloadText);
            const chunk = parsed?.choices?.[0]?.delta?.content || "";
            if (chunk) {
              fullText += chunk;
              onChunk(chunk);
            }
          } catch {
            continue;
          }
        }
      }
    }

    const flushed = decoder.decode();
    if (flushed) {
      buffer += flushed;
    }

    if (!fullText.trim()) {
      throw new Error("No explanation text returned by Groq.");
    }

    return fullText.trim();
  } finally {
    activeStreamControllers.delete(requestId);
    clearTimeout(timeoutId);
  }
}

browser.runtime.onInstalled.addListener(async () => {
  const current = await storageGet(Object.keys(DEFAULT_SETTINGS));
  const init = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (current[key] === undefined) {
      init[key] = value;
    }
  }

  if (Object.keys(init).length > 0) {
    await storageSet(init);
  }
});

browser.commands.onCommand.addListener(async (command) => {
  if (command !== "explain-selected-text") {
    return;
  }

  try {
    const tab = await getActiveTab();
    dispatchExplainTrigger(tab.id);
  } catch (error) {
    console.error("Failed to dispatch trigger command:", error);
  }
});

browser.action.onClicked.addListener((tab) => {
  if (tab?.id) {
    dispatchExplainTrigger(tab.id);
  }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "DEEP_EXPLAIN_HEALTHCHECK") {
    (async () => {
      try {
        const settings = await getSettings();

        if (!settings.apiKey) {
          sendResponse({ ok: false, error: "No API key saved yet." });
          return;
        }

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify({
            model: settings.model,
            temperature: 0,
            max_completion_tokens: 16,
            stream: false,
            messages: [
              {
                role: "user",
                content: "Reply with OK"
              }
            ]
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          let details = "Groq request failed.";

          try {
            const parsed = JSON.parse(errorText);
            details = parsed?.error?.message || details;
          } catch {
            if (errorText?.trim()) {
              details = errorText.trim();
            }
          }

          sendResponse({ ok: false, error: details });
          return;
        }

        sendResponse({ ok: true, message: "API key and model look valid." });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Healthcheck failed"
        });
      }
    })();

    return true;
  }

  if (message?.type === "DEEP_EXPLAIN_CANCEL") {
    const requestId = String(message.payload?.requestId || "");
    if (!requestId) {
      sendResponse({ ok: false, error: "Missing requestId for cancel." });
      return false;
    }

    const controller = activeStreamControllers.get(requestId);
    if (!controller) {
      sendResponse({ ok: false, error: "No active stream found for this request." });
      return false;
    }

    controller.abort();
    sendResponse({ ok: true, cancelled: true });
    return false;
  }

  if (message?.type !== "DEEP_EXPLAIN_REQUEST") {
    return false;
  }

  (async () => {
    const tabId = sender?.tab?.id;
    const requestId = String(message.payload?.requestId || crypto.randomUUID());
    const mode = String(message.payload?.mode || "deep");

    if (!tabId) {
      sendResponse({ ok: false, error: "No sender tab found for streaming response." });
      return;
    }

    const settings = await getSettings();

    if (!settings.apiKey) {
      sendResponse({
        ok: false,
        error: "Missing Groq API key. Set it in extension options."
      });
      return;
    }

    const selectedText = String(message.payload?.selectedText || "").trim();

    if (!selectedText) {
      sendResponse({ ok: false, error: "No selected text found." });
      return;
    }

    if (selectedText.length > settings.maxSelectionChars) {
      sendResponse({
        ok: false,
        error: `Selected text is too long (${selectedText.length}). Limit is ${settings.maxSelectionChars} characters.`
      });
      return;
    }

    sendResponse({ ok: true, accepted: true, requestId, model: settings.model, mode });

    const prompt =
      mode === "quick-definition"
        ? quickDefinitionPrompt(selectedText, message.payload?.pageTitle, message.payload?.pageUrl)
        : deepExplainPrompt(
            selectedText,
            message.payload?.pageTitle,
            message.payload?.pageUrl,
            settings.depth
          );

    try {
      sendStreamEvent(tabId, {
        requestId,
        event: "start",
        model: settings.model
      });

      const explanation = await streamGroqExplanation({
        requestId,
        apiKey: settings.apiKey,
        model: settings.model,
        prompt,
        timeoutMs: settings.requestTimeoutMs,
        onChunk: (chunk) => {
          sendStreamEvent(tabId, {
            requestId,
            event: "chunk",
            chunk
          });
        }
      });

      await saveHistoryEntry(
        {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          pageTitle: message.payload?.pageTitle || "",
          pageUrl: message.payload?.pageUrl || "",
          selectedSnippet: selectedText.slice(0, 220),
          selectedLength: selectedText.length,
          explanation,
          model: settings.model,
          depth: mode === "quick-definition" ? "quick-definition" : settings.depth
        },
        settings.maxHistoryItems
      );

      sendStreamEvent(tabId, {
        requestId,
        event: "end",
        model: settings.model,
        explanation
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        sendStreamEvent(tabId, {
          requestId,
          event: "cancelled"
        });
        return;
      }

      sendStreamEvent(tabId, {
        requestId,
        event: "error",
        error: error instanceof Error ? error.message : "Unexpected error"
      });
    }
  })();

  return true;
});
