import {
  AlertCircle,
  CheckCircle2,
  Eraser,
  FlaskConical,
  Loader2,
  Play,
  RotateCcw,
  Square
} from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../react/styles.css";
import {
  AppErrorCode,
  CaptionKind,
  ChapterFiveWOneHSummary,
  ReportHeading,
  StreamEvent
} from "../../shared/types";

interface JsonErrorResponse {
  error?: {
    code?: AppErrorCode;
    message?: string;
  };
}

interface TranscriptFetchResponse {
  transcriptToken: string;
  captionKind?: CaptionKind;
  language?: string;
}

interface RenderBlock {
  id: string;
  kind: "title" | "subtitle" | "heading" | "paragraph";
  level?: 1 | 2 | 3;
  parentId?: string;
  headingId?: string;
  text: string;
  rendered: string;
}

type ChapterSummaryState =
  | { status: "loading" }
  | { status: "success"; summary: ChapterFiveWOneHSummary }
  | { status: "error"; message: string };

type StatusTone = "idle" | "active" | "success" | "error" | "warning";

const MAX_RETRIES = 5;
const TYPE_DELAY_MS = 18;
const diagnosticEnabled = Boolean(window.__APP_CONFIG__?.enableDiagnosticControls);

function App(): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<{ id: string; text: string }[]>([]);
  const drainingRef = useRef(false);
  const skipRef = useRef(matchMedia("(prefers-reduced-motion: reduce)").matches);
  const retryRef = useRef(0);
  const tokenRef = useRef("");
  const generationRequirementsRef = useRef("");

  const [url, setUrl] = useState("");
  const [generationRequirements, setGenerationRequirements] = useState("");
  const [status, setStatus] = useState("Ready.");
  const [tone, setTone] = useState<StatusTone>("idle");
  const [diagnosticStatus, setDiagnosticStatus] = useState("Gemini test not run.");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [hasReport, setHasReport] = useState(false);
  const [caption, setCaption] = useState("");
  const [blocks, setBlocks] = useState<RenderBlock[]>([]);
  const [reportContextId, setReportContextId] = useState("");
  const [chapterSummaries, setChapterSummaries] = useState<Record<string, ChapterSummaryState>>({});

  const statusIcon = useMemo(() => {
    if (tone === "active") return <Loader2 className="status-icon spin" aria-hidden="true" />;
    if (tone === "success") return <CheckCircle2 className="status-icon" aria-hidden="true" />;
    if (tone === "error") return <AlertCircle className="status-icon" aria-hidden="true" />;
    if (tone === "warning") return <AlertCircle className="status-icon" aria-hidden="true" />;
    return <Play className="status-icon" aria-hidden="true" />;
  }, [tone]);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    closeStream();
    retryRef.current = 0;
    tokenRef.current = "";
    generationRequirementsRef.current = generationRequirements.trim();
    skipRef.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    queueRef.current = [];
    setBlocks([]);
    setReportContextId("");
    setChapterSummaries({});
    setCaption("");
    setHasReport(false);
    setBusy(true);
    setStreaming(false);
    setTone("active");
    setStatus("Fetching transcript...");

    try {
      const transcript = await fetchTranscript(url);
      tokenRef.current = transcript.transcriptToken;
      if (transcript.captionKind) {
        setCaption(
          transcript.captionKind === "auto_generated"
            ? "Auto-generated captions"
            : "Manual captions"
        );
      }
      await openStream(transcript.transcriptToken, generationRequirementsRef.current);
    } catch (error) {
      closeStream();
      setTone("error");
      setStatus(readErrorMessage(error));
      setBusy(false);
      setStreaming(false);
    }
  }

  async function fetchTranscript(videoUrl: string): Promise<TranscriptFetchResponse> {
    const response = await fetch("/api/transcripts/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: videoUrl })
    });
    const body: TranscriptFetchResponse & JsonErrorResponse = await response.json();
    if (!response.ok) {
      throw new Error(body.error?.message ?? "Transcript fetch failed.");
    }
    return body;
  }

  async function openStream(
    transcriptToken: string,
    currentGenerationRequirements: string
  ): Promise<void> {
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setTone("active");
    setStatus("Generating report...");

    try {
      const requestBody =
        currentGenerationRequirements.length > 0
          ? { transcriptToken, generationRequirements: currentGenerationRequirements }
          : { transcriptToken };
      const response = await fetch("/api/reports/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        let message = "Report stream failed.";
        try {
          const body: JsonErrorResponse = await response.json();
          message = body.error?.message ?? message;
        } catch {
          // Keep fallback.
        }
        throw new Error(message);
      }

      const streamBody = response.body;
      if (streamBody === null) {
        throw new Error("Report stream failed.");
      }
      await readSseStream(streamBody);
    } catch {
      if (controller.signal.aborted) return;
      if (retryRef.current >= MAX_RETRIES) {
        setTone("warning");
        setStatus("Retry failed. Partial content remains visible.");
        setBusy(false);
        setStreaming(false);
        return;
      }
      retryRef.current += 1;
      setTone("warning");
      setStatus(`Reconnecting ${String(retryRef.current)}...`);
      await wait(backoffMs(retryRef.current));
      if (abortRef.current === controller) {
        await openStream(transcriptToken, currentGenerationRequirements);
      }
    }
  }

  async function readSseStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.slice(6))
          .join("\n");
        if (data) handleEvent(JSON.parse(data) as StreamEvent);
      }
    }
  }

  function handleEvent(event: StreamEvent): void {
    if (event.type === "state") {
      setTone("active");
      setStatus(event.message);
      return;
    }
    if (event.type === "report_context") {
      setReportContextId(event.reportContextId);
      return;
    }
    if (event.type === "caption") {
      setCaption(
        event.captionKind === "auto_generated" ? "Auto-generated captions" : "Manual captions"
      );
      return;
    }
    if (event.type === "title") {
      setHasReport(true);
      addBlock("title", "title", event.title);
      addBlock("subtitle", "subtitle", event.subtitle);
      setStatus("Streaming report...");
      return;
    }
    if (event.type === "heading") {
      setHasReport(true);
      addBlock(
        `heading:${event.heading.id}`,
        "heading",
        event.heading.text,
        event.heading,
        event.heading.id
      );
      return;
    }
    if (event.type === "section") {
      setHasReport(true);
      addBlock(
        `heading:${event.section.id}`,
        "heading",
        event.section.heading,
        {
          id: event.section.id,
          level: 1,
          text: event.section.heading
        },
        event.section.id
      );
      return;
    }
    if (event.type === "summary_paragraph") {
      setHasReport(true);
      addBlock(`paragraph:${event.paragraph.id}`, "paragraph", event.paragraph.text);
      return;
    }
    if (event.type === "complete") {
      closeStream();
      setTone("success");
      setStatus("Complete.");
      setBusy(false);
      setStreaming(false);
      return;
    }
    closeStream();
    setTone("error");
    setStatus(event.message);
    setBusy(false);
    setStreaming(false);
  }

  function addBlock(
    id: string,
    kind: RenderBlock["kind"],
    text: string,
    heading?: ReportHeading,
    headingId?: string
  ): void {
    const block: RenderBlock = {
      id,
      kind,
      text,
      rendered: "",
      ...(heading ? { level: heading.level } : {}),
      ...(heading?.parentId ? { parentId: heading.parentId } : {}),
      ...(headingId ? { headingId } : {})
    };
    setBlocks((current) =>
      current.some((item) => item.id === id) ? current : [...current, block]
    );
    queueRef.current.push({ id, text });
    void drainQueue();
  }

  async function drainQueue(): Promise<void> {
    if (drainingRef.current) return;
    drainingRef.current = true;
    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift();
      if (!item) continue;
      if (skipRef.current) {
        setBlocks((current) =>
          current.map((block) => (block.id === item.id ? { ...block, rendered: item.text } : block))
        );
        continue;
      }
      let next = "";
      for (const char of Array.from(item.text)) {
        next += char;
        setBlocks((current) =>
          current.map((block) => (block.id === item.id ? { ...block, rendered: next } : block))
        );
        await wait(TYPE_DELAY_MS);
      }
    }
    drainingRef.current = false;
  }

  async function runPreflight(): Promise<void> {
    setDiagnosticStatus("Checking Gemini setup...");
    try {
      const response = await fetch("/api/gemini/preflight", { method: "POST" });
      const body: { message?: string } & JsonErrorResponse = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Gemini setup check failed.");
      setDiagnosticStatus(body.message ?? "Gemini setup check succeeded.");
    } catch (error) {
      setDiagnosticStatus(`Gemini setup check failed. ${readErrorMessage(error)}`);
    }
  }

  async function requestChapterSummary(chapterId: string): Promise<void> {
    if (!reportContextId) return;
    const existing = chapterSummaries[chapterId];
    if (existing?.status === "success") return;
    setChapterSummaries((current) => ({ ...current, [chapterId]: { status: "loading" } }));
    try {
      const response = await fetch("/api/reports/chapter-5w1h", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportContextId, chapterId })
      });
      const body: { summary?: ChapterFiveWOneHSummary } & JsonErrorResponse = await response.json();
      const summary = body.summary;
      if (!response.ok || !summary) {
        throw new Error(body.error?.message ?? "Chapter 5W1H summary failed.");
      }
      setChapterSummaries((current) => ({
        ...current,
        [chapterId]: { status: "success", summary }
      }));
    } catch (error) {
      setChapterSummaries((current) => ({
        ...current,
        [chapterId]: { status: "error", message: readErrorMessage(error) }
      }));
    }
  }

  function cancel(): void {
    closeStream();
    setTone("warning");
    setStatus("Canceled.");
    setBusy(false);
    setStreaming(false);
  }

  function clearContent(): void {
    closeStream();
    tokenRef.current = "";
    queueRef.current = [];
    setBlocks([]);
    setCaption("");
    setReportContextId("");
    setChapterSummaries({});
    setGenerationRequirements("");
    generationRequirementsRef.current = "";
    setHasReport(false);
    setBusy(false);
    setStreaming(false);
    setTone("idle");
    setStatus("Ready.");
    inputRef.current?.focus();
  }

  function skipAnimation(): void {
    skipRef.current = true;
    void drainQueue();
  }

  function closeStream(): void {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  return (
    <div className="shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">Transcript intelligence</p>
          <h1>YouTube Report Generator</h1>
        </div>
        {diagnosticEnabled ? (
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              void runPreflight();
            }}
          >
            <FlaskConical size={16} />
            Test Gemini
          </button>
        ) : null}
      </header>

      <section className="control-band" aria-label="Report controls">
        <form className="url-form" onSubmit={(event) => void submit(event)}>
          <input
            ref={inputRef}
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
            type="url"
            required
            placeholder="Paste a YouTube video URL"
            aria-label="YouTube video URL"
          />
          <button className="primary-button" type="submit" disabled={busy}>
            <Play size={16} />
            Generate
          </button>
          <button className="secondary-button" type="button" onClick={cancel} disabled={!busy}>
            <Square size={15} />
            Cancel
          </button>
          <textarea
            value={generationRequirements}
            onChange={(event) => {
              setGenerationRequirements(event.target.value);
            }}
            maxLength={1000}
            placeholder="Optional generation requirements, such as task type, output style, target audience, or constraints"
            aria-label="Optional generation requirements"
          />
        </form>

        <div className={`status-banner ${tone}`} role="status" aria-live="polite">
          {statusIcon}
          <div>
            <span>Status</span>
            <strong>{status}</strong>
          </div>
          {caption ? <em>{caption}</em> : null}
        </div>

        <div className="toolbar">
          {streaming || queueRef.current.length > 0 ? (
            <button className="ghost-button" type="button" onClick={skipAnimation}>
              <RotateCcw size={16} />
              Skip animation
            </button>
          ) : null}
          {hasReport ? (
            <button className="ghost-button" type="button" onClick={clearContent}>
              <Eraser size={16} />
              Clear and enter new link
            </button>
          ) : null}
        </div>

        {diagnosticEnabled ? <p className="diagnostic">{diagnosticStatus}</p> : null}
      </section>

      <ReportDocument
        blocks={blocks}
        reportContextId={reportContextId}
        chapterSummaries={chapterSummaries}
        onRequestChapterSummary={(chapterId) => {
          void requestChapterSummary(chapterId);
        }}
      />
    </div>
  );
}

function ReportDocument({
  blocks,
  reportContextId,
  chapterSummaries,
  onRequestChapterSummary
}: {
  blocks: RenderBlock[];
  reportContextId: string;
  chapterSummaries: Record<string, ChapterSummaryState>;
  onRequestChapterSummary: (chapterId: string) => void;
}): React.ReactElement {
  if (blocks.length === 0) {
    return (
      <article className="report empty" aria-live="polite">
        <p>Generated report content will appear here as the stream arrives.</p>
      </article>
    );
  }

  return (
    <article className="report" aria-live="polite">
      {blocks.map((block) => {
        if (block.kind === "title") {
          return <h2 key={block.id}>{block.rendered || "\u00a0"}</h2>;
        }
        if (block.kind === "subtitle") {
          return (
            <p key={block.id} className="subtitle">
              {block.rendered || "\u00a0"}
            </p>
          );
        }
        if (block.kind === "heading") {
          const level = block.level ?? 1;
          const className = `report-heading level-${String(level)}`;
          const isChapter = level === 1 && block.headingId;
          const summaryState = block.headingId ? chapterSummaries[block.headingId] : undefined;
          return (
            <React.Fragment key={block.id}>
              <div className={className}>
                <span>{block.rendered || "\u00a0"}</span>
                {isChapter && reportContextId ? (
                  <button
                    className="chapter-action"
                    type="button"
                    onClick={() => {
                      onRequestChapterSummary(block.headingId ?? "");
                    }}
                    disabled={summaryState?.status === "loading"}
                  >
                    [5W1H]
                  </button>
                ) : null}
              </div>
              {isChapter && summaryState ? <ChapterSummaryPanel state={summaryState} /> : null}
            </React.Fragment>
          );
        }
        return <p key={block.id}>{block.rendered || "\u00a0"}</p>;
      })}
    </article>
  );
}

function ChapterSummaryPanel({ state }: { state: ChapterSummaryState }): React.ReactElement {
  if (state.status === "loading") {
    return <div className="chapter-summary loading">Loading 5W1H summary...</div>;
  }
  if (state.status === "error") {
    return <div className="chapter-summary error">{state.message}</div>;
  }
  const rows: [string, string][] = [
    ["Who", state.summary.who],
    ["What", state.summary.what],
    ["When", state.summary.when],
    ["Where", state.summary.where],
    ["Why", state.summary.why],
    ["How", state.summary.how]
  ];
  return (
    <dl className="chapter-summary">
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed.";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(count: number): number {
  return Math.min(5000, 300 * 2 ** Math.max(0, count - 1));
}

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element not found.");
}
createRoot(rootElement).render(<App />);
