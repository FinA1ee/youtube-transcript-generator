export const styles = `
:root {
  color-scheme: light;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f6f7f9;
  color: #1b1f24;
}
body {
  margin: 0;
}
main {
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 20px 56px;
}
h1 {
  font-size: 32px;
  margin: 0 0 18px;
}
form {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 10px;
  align-items: center;
}
input {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid #c9d1dc;
  border-radius: 6px;
  font-size: 16px;
}
button {
  padding: 12px 14px;
  border: 0;
  border-radius: 6px;
  background: #1f6feb;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
button.secondary {
  background: #384252;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.status {
  min-height: 28px;
  margin: 18px 0;
  color: #4b5563;
}
.badge {
  display: inline-block;
  margin-left: 8px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #e8eef8;
  color: #243b63;
  font-size: 13px;
}
.report {
  background: #fff;
  border: 1px solid #d9e0ea;
  border-radius: 8px;
  padding: 24px;
  min-height: 280px;
}
.report h2 {
  margin: 0;
  font-size: 28px;
}
.report .subtitle {
  color: #586474;
  margin: 8px 0 22px;
}
.report section {
  margin-top: 24px;
}
.report p {
  line-height: 1.75;
}
@media (max-width: 720px) {
  form {
    grid-template-columns: 1fr;
  }
}
`;

export const clientScript = `
const form = document.querySelector("#report-form");
const urlInput = document.querySelector("#youtube-url");
const submitButton = document.querySelector("#submit");
const cancelButton = document.querySelector("#cancel");
const testGeminiButton = document.querySelector("#test-gemini");
const skipButton = document.querySelector("#skip-animation");
const resetButton = document.querySelector("#reset-url");
const statusEl = document.querySelector("#status");
const diagnosticStatusEl = document.querySelector("#diagnostic-status");
const captionBadge = document.querySelector("#caption-badge");
const reportEl = document.querySelector("#report");
let source = null;
let retryCount = 0;
let activeTranscriptToken = "";
let skipAnimation = matchMedia("(prefers-reduced-motion: reduce)").matches;
const maxRetries = 5;
const queue = [];
let draining = false;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  start(urlInput.value);
});

cancelButton.addEventListener("click", () => {
  closeSource();
  setStatus("Canceled.");
  setActive(false);
});

testGeminiButton.addEventListener("click", () => {
  startGeminiPreflight();
});

skipButton.addEventListener("click", () => {
  skipAnimation = true;
  drainQueue();
});

resetButton.addEventListener("click", () => {
  closeSource();
  resetButton.hidden = true;
  setActive(false);
  urlInput.focus();
});

async function start(url) {
  closeSource();
  retryCount = 0;
  activeTranscriptToken = "";
  skipAnimation = matchMedia("(prefers-reduced-motion: reduce)").matches;
  reportEl.innerHTML = "";
  captionBadge.textContent = "";
  resetButton.hidden = true;
  setActive(true);
  setStatus("Fetching transcript...");
  try {
    const transcript = await fetchTranscript(url);
    activeTranscriptToken = transcript.transcriptToken;
    if (transcript.captionKind) {
      captionBadge.textContent =
        transcript.captionKind === "auto_generated" ? "Auto-generated captions" : "Manual captions";
    }
    await openStream(activeTranscriptToken);
  } catch (error) {
    closeSource();
    setStatus(readErrorMessage(error));
    resetButton.hidden = false;
    setActive(false);
  }
}

async function fetchTranscript(url) {
  const response = await fetch("/api/transcripts/fetch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url })
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || "Transcript fetch failed.");
  }
  return body;
}

async function openStream(transcriptToken) {
  const controller = new AbortController();
  source = { close: () => controller.abort() };
  setStatus("Generating report...");
  try {
    const response = await fetch("/api/reports/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcriptToken }),
      signal: controller.signal
    });
    if (!response.ok || !response.body) {
      let message = "Report stream failed.";
      try {
        const body = await response.json();
        message = body.error?.message || message;
      } catch {
        // Keep sanitized fallback message.
      }
      throw new Error(message);
    }
    await readSseStream(response.body);
  } catch (error) {
    if (controller.signal.aborted) return;
    if (retryCount >= maxRetries) {
      closeSource();
      setStatus("Retry failed. Partial content remains visible.");
      resetButton.hidden = false;
      setActive(false);
      return;
    }
    retryCount += 1;
    setStatus("Reconnecting " + retryCount + "...");
    await wait(backoffMs(retryCount));
    if (source) {
      await openStream(transcriptToken);
    }
  }
}

async function readSseStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    buffer += decoder.decode(result.value, { stream: true });
    const frames = buffer.split("\\n\\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const data = frame
        .split("\\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\\n");
      if (data) {
        handleEvent(JSON.parse(data));
      }
    }
  }
}

async function startGeminiPreflight() {
  setDiagnosticActive(true);
  setDiagnosticStatus("Checking Gemini setup...");
  try {
    const response = await fetch("/api/gemini/preflight", { method: "POST" });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error?.message || "Gemini setup check failed.");
    }
    setDiagnosticStatus(body.message);
  } catch (error) {
    setDiagnosticStatus("Gemini setup check failed. " + readErrorMessage(error));
  } finally {
    setDiagnosticActive(false);
  }
}

function handleEvent(event) {
  if (event.type === "state") {
    if (event.state === "loading") setStatus("Loading...");
    return;
  }
  if (event.type === "caption") {
    captionBadge.textContent =
      event.captionKind === "auto_generated" ? "Auto-generated captions" : "Manual captions";
    return;
  }
  if (event.type === "title") {
    ensureHeader().querySelector("h2").textContent = event.title;
    ensureHeader().querySelector(".subtitle").textContent = event.subtitle;
    setStatus("Streaming report...");
    return;
  }
  if (event.type === "section") {
    ensureSection(event.section.id, event.section.heading);
    return;
  }
  if (event.type === "summary_paragraph") {
    const section = ensureSection(event.sectionId, "");
    const p = document.createElement("p");
    section.append(p);
    queue.push({ element: p, text: event.paragraph.text });
    void drainQueue();
    return;
  }
  if (event.type === "complete") {
    closeSource();
    setStatus("Complete.");
    setActive(false);
    return;
  }
  if (event.type === "error") {
    closeSource();
    if (String(event.code).startsWith("gemini_")) {
      setStatus("Gemini setup check failed. " + event.message);
    } else {
      setStatus(event.message);
    }
    setActive(false);
  }
}

function ensureHeader() {
  let header = reportEl.querySelector("[data-report-header]");
  if (!header) {
    header = document.createElement("header");
    header.dataset.reportHeader = "true";
    header.innerHTML = "<h2></h2><p class='subtitle'></p>";
    reportEl.prepend(header);
  }
  return header;
}

function ensureSection(id, heading) {
  let section = reportEl.querySelector("[data-section-id='" + id + "']");
  if (!section) {
    section = document.createElement("section");
    section.dataset.sectionId = id;
    const h = document.createElement("h3");
    h.textContent = heading;
    section.append(h);
    reportEl.append(section);
  } else if (heading) {
    section.querySelector("h3").textContent = heading;
  }
  return section;
}

async function drainQueue() {
  if (draining) return;
  draining = true;
  while (queue.length > 0) {
    const item = queue.shift();
    if (skipAnimation) {
      item.element.textContent += item.text;
      continue;
    }
    for (const char of Array.from(item.text)) {
      item.element.textContent += char;
      await new Promise((resolve) => setTimeout(resolve, 22));
    }
  }
  draining = false;
}

function closeSource() {
  if (source) {
    source.close();
    source = null;
  }
}

function readErrorMessage(error) {
  return error instanceof Error ? error.message : "Request failed.";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(count) {
  return Math.min(5000, 300 * 2 ** Math.max(0, count - 1));
}

function setStatus(message) {
  statusEl.textContent = message;
}

function setDiagnosticStatus(message) {
  diagnosticStatusEl.textContent = message;
}

function setActive(active) {
  submitButton.disabled = active;
  cancelButton.disabled = !active;
}

function setDiagnosticActive(active) {
  testGeminiButton.disabled = active;
}
`;

export const appHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>YouTube Report Generator</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main>
      <h1>YouTube Report Generator</h1>
      <form id="report-form">
        <input id="youtube-url" type="url" required placeholder="Paste a YouTube video URL" />
        <button id="submit" type="submit">Generate</button>
        <button id="test-gemini" class="secondary" type="button">Test Gemini</button>
        <button id="cancel" class="secondary" type="button" disabled>Cancel</button>
      </form>
      <p id="status" class="status">Ready.</p>
      <p id="diagnostic-status" class="status">Gemini test not run.</p>
      <p>
        <button id="skip-animation" class="secondary" type="button">Skip animation</button>
        <button id="reset-url" class="secondary" type="button" hidden>Re-enter URL</button>
        <span id="caption-badge" class="badge"></span>
      </p>
      <article id="report" class="report" aria-live="polite"></article>
    </main>
    <script src="/client.js"></script>
  </body>
</html>`;
