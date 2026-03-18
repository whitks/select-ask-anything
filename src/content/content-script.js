(() => {
  const ROOT_ID = "understand-deeply-root";
  let panelRoot = null;
  let lastSelection = "";
  let isLoading = false;
  let activeRequestId = "";
  let streamedExplanation = "";
  let typedBuffer = "";
  let typedBufferTimer = null;
  
  // Drag state
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let panelX = null;
  let panelY = null;

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
    root.className = "ud-fixed ud-z-[2147483647] ud-w-[480px] ud-max-w-[92vw]";
    root.style.top = "1rem";
    root.style.right = "1rem";

    root.innerHTML = `
      <div class="ud-rounded-2xl ud-overflow-hidden ud-shadow-2xl ud-border ud-border-purple-300/20 ud-transition-all ud-duration-300">
        <!-- Multi-layer premium glassmorphism background with intense blur and high opacity -->
        <div class="ud-absolute ud-inset-0">
          <!-- Base layer: Solid gradient with high opacity -->
          <div class="ud-absolute ud-inset-0 ud-bg-gradient-to-br ud-from-indigo-900/70 ud-via-purple-800/60 ud-to-slate-900/75"></div>
          
          <!-- Second layer: Cyan/Blue accent with strong opacity for visual interest -->
          <div class="ud-absolute ud-inset-0 ud-bg-gradient-to-tr ud-from-cyan-400/30 ud-via-blue-400/40 ud-to-transparent"></div>
          
          <!-- Third layer: Purple accent for depth -->
          <div class="ud-absolute ud-inset-0 ud-bg-gradient-to-b ud-from-purple-400/40 ud-via-transparent ud-to-indigo-600/30"></div>
          
          <!-- Intense backdrop blur for premium glass effect -->
          <div class="ud-absolute ud-inset-0 ud-backdrop-blur-3xl"></div>
          
          <!-- Additional blur layer for extra depth -->
          <div class="ud-absolute ud-inset-0 ud-backdrop-blur-2xl ud-opacity-50"></div>
        </div>
        
        <!-- Content wrapper -->
        <div class="ud-relative ud-z-10 ud-flex ud-flex-col ud-h-full ud-max-h-[86vh]">
          <!-- Header with drag handle -->
          <header id="ud-header" class="ud-flex ud-items-center ud-justify-between ud-px-5 ud-py-4 ud-border-b ud-border-purple-300/15 ud-bg-gradient-to-r ud-from-purple-500/10 ud-via-blue-500/5 ud-to-transparent ud-cursor-move ud-select-none ud-hover:from-purple-500/15 ud-hover:via-blue-500/10 ud-transition-all ud-duration-300 ud-group ud-backdrop-blur-xl">
            <div class="ud-flex-1">
              <div class="ud-flex ud-items-center ud-gap-2">
                <div class="ud-w-2 ud-h-2 ud-rounded-full ud-bg-gradient-to-r ud-from-cyan-400 ud-via-blue-400 ud-to-purple-400 ud-animate-pulse ud-box-shadow-lg"></div>
                <h2 class="ud-text-lg ud-font-bold ud-text-black">Understand Deeply</h2>
              </div>
              <p id="ud-meta" class="ud-text-sm ud-text-black ud-mt-0.5 ud-tracking-tight ud-opacity-75">Select text, then run shortcut</p>
            </div>
            <div class="ud-flex ud-gap-2 ud-items-center">
              <button id="ud-stop" class="ud-hidden ud-text-sm ud-bg-gradient-to-br ud-from-red-400/30 ud-to-rose-500/20 ud-border ud-border-red-400/30 ud-text-black ud-font-bold hover:ud-from-red-400/40 hover:ud-to-rose-500/30 ud-px-3 ud-py-2 ud-rounded-lg ud-transition-all ud-font-medium ud-shadow-lg ud-backdrop-blur-lg" type="button">Stop</button>
              <button id="ud-rerun" class="ud-hidden ud-text-sm ud-bg-gradient-to-br ud-from-emerald-400/30 ud-to-teal-500/20 ud-border ud-border-emerald-400/30 ud-text-black ud-font-bold hover:ud-from-emerald-400/40 hover:ud-to-teal-500/30 ud-px-3 ud-py-2 ud-rounded-lg ud-transition-all ud-font-medium ud-shadow-lg ud-backdrop-blur-lg" type="button">Re-run</button>
              <button id="ud-close" class="ud-text-sm ud-bg-gradient-to-br ud-from-slate-500/25 ud-to-slate-600/15 ud-border ud-border-slate-500/25 ud-text-black ud-font-bold hover:ud-from-slate-500/35 hover:ud-to-slate-600/25 ud-px-3 ud-py-2 ud-rounded-lg ud-transition-all ud-font-medium ud-shadow-lg ud-backdrop-blur-lg" type="button">✕</button>
            </div>
          </header>

          <!-- Status bar with intense blur and minimal opacity -->
          <div class="ud-px-5 ud-pt-4 ud-pb-2 ud-border-b ud-border-purple-300/10 ud-bg-gradient-to-r ud-from-indigo-500/8 ud-to-transparent ud-backdrop-blur-xl">
            <p id="ud-status" class="ud-text-sm ud-text-black ud-font-bold ud-tracking-widest ud-uppercase"></p>
          </div>

          <!-- Body with ultra-translucent background -->
          <div class="ud-flex-1 ud-overflow-hidden ud-flex ud-flex-col ud-bg-gradient-to-b ud-from-transparent ud-via-blue-500/3 ud-to-purple-500/5 ud-backdrop-blur-2xl">
            <div class="ud-p-5 ud-space-y-3 ud-overflow-y-auto ud-flex-1 ud-scrollbar-thin ud-scrollbar-thumb-blue-500/20 ud-scrollbar-track-transparent">
              <div id="ud-body" class="ud-text-lg ud-leading-8 ud-whitespace-pre-wrap ud-text-black ud-font-medium ud-text-opacity-95"></div>
            </div>
          </div>

          <!-- Footer gradient accent with refined colors -->
          <div class="ud-h-1.5 ud-bg-gradient-to-r ud-from-indigo-500/40 ud-via-purple-400/25 ud-to-cyan-400/15"></div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(root);

    // Initialize drag functionality
    const header = root.querySelector("#ud-header");
    const panel = root;

    header?.addEventListener("mousedown", (e) => {
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      panel.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging || !panelRoot) return;
      
      const newX = e.clientX - dragOffsetX;
      const newY = e.clientY - dragOffsetY;
      
      // Keep panel within viewport
      const maxX = window.innerWidth - panelRoot.offsetWidth;
      const maxY = window.innerHeight - panelRoot.offsetHeight;
      
      panelRoot.style.left = Math.max(0, Math.min(newX, maxX)) + "px";
      panelRoot.style.top = Math.max(0, Math.min(newY, maxY)) + "px";
      panelRoot.style.right = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        if (header) header.style.cursor = "move";
      }
    });

    // ESC key to close
    const handleEsc = (e) => {
      if (e.key === "Escape" && panelRoot) {
        closePanel();
      }
    };

    document.addEventListener("keydown", handleEsc);

    function closePanel() {
      document.removeEventListener("keydown", handleEsc);
      root.remove();
      panelRoot = null;
    }

    const closeButton = root.querySelector("#ud-close");
    const rerunButton = root.querySelector("#ud-rerun");
    const stopButton = root.querySelector("#ud-stop");

    closeButton?.addEventListener("click", () => {
      closePanel();
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
      await chrome.runtime.sendMessage({
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
        body: "Highlight any text first, then:\n• Type 'wzz' for quick definition\n• Use Ctrl+Shift+Y for deep explanation\n• Use Alt+Shift+W for quick definition (alternative)",
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
      const response = await chrome.runtime.sendMessage({
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
    
    // Only skip for sensitive input types and textarea
    const isInput =
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLInputElement && /^(password|email|url|tel|search)$/i.test(active.type));

    // Skip for modifier key combinations (except Ctrl+Shift combo)
    if (isInput || event.repeat || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    // Alternative shortcut: Alt+Shift+W (not blocked by modifier check above because we check it separately)
    if ((event.ctrlKey || event.altKey) && event.shiftKey && event.key?.toLowerCase() === 'w') {
      event.preventDefault();
      runExplain("", QUICK_MODE);
      console.log("[Understand Deeply] Alt+Shift+W triggered quick definition");
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
      console.log("[Understand Deeply] 'wzz' typed, triggering quick definition");
      runExplain("", QUICK_MODE);
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
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
