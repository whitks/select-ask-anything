(() => {
  const browser = globalThis.browser || globalThis.chrome;
  const ROOT_ID = "understand-deeply-root";
  let panelRoot = null;
  let lastSelection = "";
  let isLoading = false;
  let activeRequestId = "";
  let streamedExplanation = "";
  let typedBuffer = "";
  let typedBufferTimer = null;

  const DEFAULT_MODE = "deep";
  const QUICK_MODE = "quick-definition";

  function getSelectedText() {
    const selected = String(window.getSelection?.()?.toString() || "").trim();
    if (selected) {
      return selected;
    }

    const active = document.activeElement;
    const isInput =
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLInputElement && /^(text|search|url|tel|password)$/i.test(active.type));

    if (isInput) {
      const start = active.selectionStart ?? 0;
      const end = active.selectionEnd ?? 0;
      if (end > start) {
        return active.value.slice(start, end).trim();
      }
    }

    if (active && active.isContentEditable) {
      const editableSelection = String(window.getSelection?.()?.toString() || "").trim();
      return editableSelection;
    }

    return "";
  }

  function ensurePanel() {
    if (panelRoot) {
      return panelRoot;
    }

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "ud-fixed ud-top-4 ud-right-4 ud-z-[2147483647] ud-w-[440px] ud-max-w-[92vw] ud-max-h-[86vh]";

    root.innerHTML = `
      <section class="ud-bg-slate-900/90 ud-backdrop-blur-md ud-text-slate-100 ud-rounded-2xl ud-shadow-2xl ud-border ud-border-slate-700/50 ud-overflow-hidden ud-font-sans">
        <header class="ud-flex ud-items-center ud-justify-between ud-px-4 ud-py-3 ud-border-b ud-border-slate-700/50 ud-bg-slate-800/50">
          <div>
            <h2 class="ud-text-sm ud-font-semibold">Understand Deeply</h2>
            <p id="ud-meta" class="ud-text-[11px] ud-text-slate-300">Select text, then run shortcut.</p>
          </div>
          <div class="ud-flex ud-gap-2">
            <button id="ud-stop" class="ud-hidden ud-text-xs ud-bg-slate-700 hover:ud-bg-slate-600 ud-px-2 ud-py-1 ud-rounded-md" type="button">Stop</button>
            <button id="ud-rerun" class="ud-hidden ud-text-xs ud-bg-slate-700 hover:ud-bg-slate-600 ud-px-2 ud-py-1 ud-rounded-md" type="button">Re-run</button>
            <button id="ud-close" class="ud-text-xs ud-bg-slate-700 hover:ud-bg-slate-600 ud-px-2 ud-py-1 ud-rounded-md" type="button">Close</button>
          </div>
        </header>
        <div class="ud-p-4 ud-space-y-3">
          <p id="ud-status" class="ud-text-xs ud-text-slate-300"></p>
          <div id="ud-body" class="ud-text-sm ud-leading-6 ud-whitespace-pre-wrap ud-max-h-[56vh] ud-overflow-auto"></div>
        </div>
      </section>
    `;

    document.documentElement.appendChild(root);

    const closeButton = root.querySelector("#ud-close");
    const rerunButton = root.querySelector("#ud-rerun");
    const stopButton = root.querySelector("#ud-stop");

    closeButton?.addEventListener("click", () => {
      root.remove();
      panelRoot = null;
    });

    rerunButton?.addEventListener("click", () => {
      if (!isLoading && lastSelection) {
        runExplain(lastSelection, DEFAULT_MODE);
      }
    });

    stopButton?.addEventListener("click", () => {
      cancelActiveRequest();
    });

    panelRoot = root;
    return panelRoot;
  }

  function setPanelState({ status = "", body = "", loading = false, canRerun = false, canStop = false }) {
    const root = ensurePanel();
    const statusNode = root.querySelector("#ud-status");
    const bodyNode = root.querySelector("#ud-body");
    const rerunButton = root.querySelector("#ud-rerun");
    const stopButton = root.querySelector("#ud-stop");

    isLoading = loading;

    if (statusNode) {
      statusNode.textContent = status;
    }

    if (bodyNode) {
      bodyNode.textContent = body;
    }

    if (rerunButton) {
      rerunButton.classList.toggle("ud-hidden", !canRerun);
      rerunButton.setAttribute("aria-disabled", String(loading));
    }

    if (stopButton) {
      stopButton.classList.toggle("ud-hidden", !canStop);
      stopButton.setAttribute("aria-disabled", String(!loading));
    }
  }

  async function cancelActiveRequest() {
    if (!activeRequestId || !isLoading) {
      return;
    }

    const requestId = activeRequestId;

    setPanelState({
      status: "Stopping…",
      body: streamedExplanation,
      loading: true,
      canRerun: false,
      canStop: false
    });

    try {
      await browser.runtime.sendMessage({
        type: "DEEP_EXPLAIN_CANCEL",
        payload: { requestId }
      });
    } catch {
      setPanelState({
        status: "Stop failed",
        body: "Could not cancel this request. It may complete normally.",
        loading: false,
        canRerun: true,
        canStop: false
      });
    }
  }

  async function runExplain(forcedText = "", mode = DEFAULT_MODE) {
    const selectedText = forcedText || getSelectedText();

    if (!selectedText) {
      setPanelState({
        status: "No text selected",
        body: "Highlight any text first, then use Ctrl+Shift+Y for deep mode or type wzz for quick definition.",
        loading: false,
        canRerun: false,
        canStop: false
      });
      return;
    }

    lastSelection = selectedText;
    activeRequestId = crypto.randomUUID();
    streamedExplanation = "";

    setPanelState({
      status: mode === QUICK_MODE ? "Generating quick definition…" : "Thinking deeply…",
      body:
        mode === QUICK_MODE
          ? "Preparing short 3–5 line response."
          : "Preparing streaming request to Groq.",
      loading: true,
      canRerun: false,
      canStop: true
    });

    try {
      const response = await browser.runtime.sendMessage({
        type: "DEEP_EXPLAIN_REQUEST",
        payload: {
          requestId: activeRequestId,
          mode,
          selectedText,
          pageTitle: document.title,
          pageUrl: location.href
        }
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Unknown failure.");
      }

      if (!response.accepted) {
        throw new Error("Streaming request was not accepted.");
      }

      setPanelState({
        status:
          mode === QUICK_MODE
            ? `Streaming quick definition from ${response.model}…`
            : `Streaming from ${response.model}…`,
        body: "",
        loading: true,
        canRerun: false,
        canStop: true
      });
    } catch (error) {
      activeRequestId = "";
      setPanelState({
        status: "Request failed",
        body: error instanceof Error ? error.message : "Unexpected error.",
        loading: false,
        canRerun: true,
        canStop: false
      });
    }
  }

  document.addEventListener("keydown", (event) => {
    const active = document.activeElement;
    const typingInEditable =
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      Boolean(active && active.isContentEditable);

    if (typingInEditable || event.repeat || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    if (typedBufferTimer) {
      clearTimeout(typedBufferTimer);
    }

    typedBuffer = `${typedBuffer}${String(event.key || "").toLowerCase()}`.slice(-3);
    typedBufferTimer = setTimeout(() => {
      typedBuffer = "";
    }, 900);

    if (typedBuffer === "wzz") {
      typedBuffer = "";
      runExplain("", QUICK_MODE);
    }
  });

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "DEEP_EXPLAIN_TRIGGER") {
      runExplain("", message?.payload?.mode || DEFAULT_MODE);
      return;
    }

    if (message?.type !== "DEEP_EXPLAIN_STREAM") {
      return;
    }

    const payload = message.payload || {};

    if (!payload.requestId || payload.requestId !== activeRequestId) {
      return;
    }

    if (payload.event === "start") {
      streamedExplanation = "";
      setPanelState({
        status: `Streaming from ${payload.model || "model"}…`,
        body: "",
        loading: true,
        canRerun: false,
        canStop: true
      });
      return;
    }

    if (payload.event === "chunk") {
      streamedExplanation += String(payload.chunk || "");
      setPanelState({
        status: "Streaming…",
        body: streamedExplanation,
        loading: true,
        canRerun: false,
        canStop: true
      });
      return;
    }

    if (payload.event === "end") {
      const finalText = (streamedExplanation || String(payload.explanation || "")).trim();
      setPanelState({
        status: `Model: ${payload.model || "unknown"}`,
        body: finalText || "No explanation content was returned.",
        loading: false,
        canRerun: true,
        canStop: false
      });
      activeRequestId = "";
      return;
    }

    if (payload.event === "cancelled") {
      setPanelState({
        status: "Stopped",
        body: streamedExplanation || "Generation was stopped.",
        loading: false,
        canRerun: true,
        canStop: false
      });
      activeRequestId = "";
      return;
    }

    if (payload.event === "error") {
      setPanelState({
        status: "Request failed",
        body: String(payload.error || "Unexpected error."),
        loading: false,
        canRerun: true,
        canStop: false
      });
      activeRequestId = "";
    }
  });
})();
