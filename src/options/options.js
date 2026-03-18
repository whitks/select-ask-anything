const DEFAULT_SETTINGS = {
  apiKey: "",
  model: "moonshotai/kimi-k2-instruct-0905",
  depth: "very-deep"
};

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function truncate(value, max) {
  const text = String(value || "");
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…`;
}

function renderHistoryItem(item) {
  const card = document.createElement("article");
  card.className = "ud-bg-slate-800 ud-border ud-border-slate-700 ud-rounded-xl ud-p-3 ud-space-y-2";

  const meta = document.createElement("p");
  meta.className = "ud-text-xs ud-text-slate-300";
  meta.textContent = `${formatDate(item.createdAt)} • ${item.model}`;

  const title = document.createElement("a");
  title.className = "ud-text-sm ud-font-medium ud-text-slate-100 hover:ud-underline ud-block";
  title.href = item.pageUrl || "#";
  title.target = "_blank";
  title.rel = "noreferrer";
  title.textContent = truncate(item.pageTitle || "Untitled page", 100);

  const selected = document.createElement("p");
  selected.className = "ud-text-sm ud-text-slate-200";
  selected.textContent = `Selection: ${truncate(item.selectedSnippet, 220)}`;

  const explanation = document.createElement("p");
  explanation.className = "ud-text-sm ud-text-slate-300";
  explanation.textContent = `Explanation: ${truncate(item.explanation, 360)}`;

  card.append(meta, title, selected, explanation);
  return card;
}

async function renderHistory() {
  const list = document.getElementById("history-list");
  const data = await storageGet(["history"]);
  const history = Array.isArray(data.history) ? data.history : [];

  list.innerHTML = "";

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "ud-text-sm ud-text-slate-400";
    empty.textContent = "No history yet.";
    list.appendChild(empty);
    return;
  }

  history.slice(0, 20).forEach((item) => list.appendChild(renderHistoryItem(item)));
}

async function loadSettings() {
  const data = await storageGet(Object.keys(DEFAULT_SETTINGS));
  const settings = {
    ...DEFAULT_SETTINGS,
    ...data
  };

  document.getElementById("api-key").value = settings.apiKey;
  document.getElementById("model").value = settings.model;
  document.getElementById("depth").value = settings.depth;
}

async function saveSettings(event) {
  event.preventDefault();

  const apiKey = document.getElementById("api-key").value.trim();
  const model = document.getElementById("model").value.trim();
  const depth = document.getElementById("depth").value;

  const status = document.getElementById("save-status");

  await storageSet({ apiKey, model, depth });
  status.textContent = "Saved.";

  setTimeout(() => {
    status.textContent = "";
  }, 1800);
}

async function testApiKey() {
  const status = document.getElementById("save-status");
  status.textContent = "Testing API key…";

  try {
    const result = await chrome.runtime.sendMessage({ type: "DEEP_EXPLAIN_HEALTHCHECK" });
    if (!result?.ok) {
      status.textContent = `Test failed: ${result?.error || "Unknown error"}`;
      return;
    }

    status.textContent = "Test succeeded: API key works.";
  } catch (error) {
    status.textContent = `Test failed: ${error instanceof Error ? error.message : "Unexpected error"}`;
  }
}

async function clearHistory() {
  await storageSet({ history: [] });
  await renderHistory();
}

async function init() {
  await loadSettings();
  await renderHistory();

  document.getElementById("settings-form").addEventListener("submit", saveSettings);
  document.getElementById("test-api").addEventListener("click", testApiKey);
  document.getElementById("clear-history").addEventListener("click", clearHistory);
}

init();
