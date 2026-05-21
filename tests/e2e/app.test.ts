import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/server/app";
import { AppError, StreamEvent } from "../../src/shared/types";
import { hierarchicalReport, report, transcript } from "../fixtures/captions";
import { FakeGeminiClient, FakeTranscriptClient, readSseEvents } from "../helpers/fakes";

describe("Hono app", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves the English app shell without secrets", async () => {
    const app = createApp();
    const response = await app.request("/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("YouTube Report Generator");
    expect(html).toContain('"enableDiagnosticControls":false');
    expect(html).toContain('<div id="root"></div>');
    expect(html).not.toContain("GEMINI_API_KEY");
    expect(html).not.toContain("TRANSCRIPTAPI_KEY");
    expect(html).not.toContain("TRANSCRIPT_TOKEN_SECRET");
  });

  it("exposes diagnostic config only when enabled", async () => {
    const app = createApp();
    const response = await app.request("/", undefined, { ENABLE_DIAGNOSTIC_CONTROLS: "true" });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('"enableDiagnosticControls":true');
  });

  it("uses standalone preflight and fetch-based POST stream in the browser script", async () => {
    const app = createApp();
    const response = await app.request("/client.js");
    const script = await response.text();

    expect(response.status).toBe(200);
    expect(script).toContain("/api/gemini/preflight");
    expect(script).toContain("/api/transcripts/fetch");
    expect(script).toContain("/api/reports/stream");
    expect(script).toContain("/api/reports/chapter-5w1h");
    expect(script).toContain("Test Gemini");
    expect(script).toContain("Optional generation requirements");
    expect(script).toContain("[5W1H]");
    expect(script).toContain("Who");
    expect(script).toContain("How");
    expect(script).toContain("Skip animation");
    expect(script).toContain("Clear and enter new link");
    expect(script).toContain("status-banner");
    expect(script).toContain("report-heading");
    expect(script).not.toContain("new EventSource");
  });

  it("rejects GET report stream startup", async () => {
    const app = createApp();
    const response = await app.request("/api/reports/stream");

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "generation_validation_error", message: "Report stream requires POST." }
    });
  });

  it("returns sanitized Gemini setup errors from standalone preflight", async () => {
    const app = createApp();
    const response = await app.request("/api/gemini/preflight", { method: "POST" });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "gemini_config_error",
        message: "Gemini API key is not configured."
      }
    });
  });

  it("returns successful standalone Gemini preflight output without report content events", async () => {
    const app = createApp(fetch, {
      createGeminiClient: () => new FakeGeminiClient(report)
    });
    const response = await app.request("/api/gemini/preflight", { method: "POST" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: "Gemini setup check succeeded."
    });
  });

  it("fetches transcript through a standalone request and returns a handoff", async () => {
    const transcriptClient = new FakeTranscriptClient(transcript);
    const geminiClient = new FakeGeminiClient(report);
    const app = createApp(fetch, {
      createTranscriptClient: () => transcriptClient,
      createGeminiClient: () => geminiClient
    });
    const response = await app.request(
      "/api/transcripts/fetch",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtu.be/abc123XYZ" }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );
    const body = parseTranscriptTokenResponse(await response.json());

    expect(response.status).toBe(200);
    expect(body.transcriptToken).toEqual(expect.any(String));
    expect(transcriptClient.calls).toBe(1);
    expect(geminiClient.calls).toBe(0);
  });

  it("emits a report context id during report streaming", async () => {
    const app = createApp(fetch, {
      createTranscriptClient: () => new FakeTranscriptClient(transcript),
      createGeminiClient: () => new FakeGeminiClient(hierarchicalReport)
    });
    const transcriptToken = await createTranscriptToken(app);

    const response = await app.request(
      "/api/reports/stream",
      {
        method: "POST",
        body: JSON.stringify({ transcriptToken }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );
    const events = await readSseEvents(response);
    const contextEvent = findReportContextEvent(events);

    expect(contextEvent?.reportContextId).toEqual(expect.any(String));
  });

  it("generates chapter 5W1H from server-saved context with lightweight request", async () => {
    const geminiClient = new FakeGeminiClient(hierarchicalReport);
    const app = createApp(fetch, {
      createTranscriptClient: () => new FakeTranscriptClient(transcript),
      createGeminiClient: () => geminiClient
    });
    const reportContextId = await createReportContext(app);

    const response = await app.request(
      "/api/reports/chapter-5w1h",
      {
        method: "POST",
        body: JSON.stringify({ reportContextId, chapterId: "h1-intro" }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );

    const body = parseChapterFiveWOneHResponse(await response.json());

    expect(response.status).toBe(200);
    expect(body.reportContextId).toBe(reportContextId);
    expect(body.chapterId).toBe("h1-intro");
    expect(body.summary.who).toBe("Jack");
    expect(typeof body.summary.what).toBe("string");
    expect(typeof body.summary.when).toBe("string");
    expect(typeof body.summary.where).toBe("string");
    expect(typeof body.summary.why).toBe("string");
    expect(typeof body.summary.how).toBe("string");
    expect(geminiClient.chapterFiveWOneHCalls).toBe(1);
    expect(geminiClient.lastChapterContext).toMatchObject({
      reportContextId,
      chapterId: "h1-intro",
      chapterTitle: "开场与目标"
    });
    expect(geminiClient.lastChapterContext?.paragraphs).toHaveLength(1);
  });

  it("rejects frontend full article resubmission for chapter 5W1H", async () => {
    const geminiClient = new FakeGeminiClient(hierarchicalReport);
    const app = createApp(fetch, {
      createTranscriptClient: () => new FakeTranscriptClient(transcript),
      createGeminiClient: () => geminiClient
    });
    const reportContextId = await createReportContext(app);

    const response = await app.request(
      "/api/reports/chapter-5w1h",
      {
        method: "POST",
        body: JSON.stringify({
          reportContextId,
          chapterId: "h1-intro",
          article: hierarchicalReport
        }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "generation_validation_error",
        message: "Chapter summary requests must use server-saved context."
      }
    });
    expect(geminiClient.chapterFiveWOneHCalls).toBe(0);
  });

  it("rejects unavailable report context before chapter 5W1H calls Gemini", async () => {
    const geminiClient = new FakeGeminiClient(hierarchicalReport);
    const app = createApp(fetch, {
      createTranscriptClient: () => new FakeTranscriptClient(transcript),
      createGeminiClient: () => geminiClient
    });

    const response = await app.request(
      "/api/reports/chapter-5w1h",
      {
        method: "POST",
        body: JSON.stringify({ reportContextId: "missing", chapterId: "h1-intro" }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "report_context_unavailable",
        message: "Report context is no longer available."
      }
    });
    expect(geminiClient.chapterFiveWOneHCalls).toBe(0);
  });

  it("rejects invalid chapter ids before chapter 5W1H calls Gemini", async () => {
    const geminiClient = new FakeGeminiClient(hierarchicalReport);
    const app = createApp(fetch, {
      createTranscriptClient: () => new FakeTranscriptClient(transcript),
      createGeminiClient: () => geminiClient
    });
    const reportContextId = await createReportContext(app);

    const response = await app.request(
      "/api/reports/chapter-5w1h",
      {
        method: "POST",
        body: JSON.stringify({ reportContextId, chapterId: "missing-chapter" }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "generation_validation_error",
        message: "Chapter is not available."
      }
    });
    expect(geminiClient.chapterFiveWOneHCalls).toBe(0);
  });

  it("ignores generation requirements during standalone transcript fetch", async () => {
    const transcriptClient = new FakeTranscriptClient(transcript);
    const geminiClient = new FakeGeminiClient(report);
    const app = createApp(fetch, {
      createTranscriptClient: () => transcriptClient,
      createGeminiClient: () => geminiClient
    });
    const response = await app.request(
      "/api/transcripts/fetch",
      {
        method: "POST",
        body: JSON.stringify({
          url: "https://youtu.be/abc123XYZ",
          generationRequirements: "Create a concise study guide."
        }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );

    expect(response.status).toBe(200);
    expect(transcriptClient.calls).toBe(1);
    expect(geminiClient.calls).toBe(0);
  });

  it("returns sanitized transcript fetch errors without calling Gemini", async () => {
    const transcriptClient = new FakeTranscriptClient(
      new AppError("transcript_provider_error", "Transcript service failed.", 502)
    );
    const geminiClient = new FakeGeminiClient(report);
    const app = createApp(fetch, {
      createTranscriptClient: () => transcriptClient,
      createGeminiClient: () => geminiClient
    });
    const response = await app.request(
      "/api/transcripts/fetch",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtu.be/abc123XYZ" }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "transcript_provider_error",
        message: "Transcript service failed."
      }
    });
    expect(geminiClient.calls).toBe(0);
  });

  it("streams partial report events from a transcript handoff without calling TranscriptAPI", async () => {
    const transcriptClient = new FakeTranscriptClient(transcript);
    const geminiClient = new FakeGeminiClient(hierarchicalReport);
    const app = createApp(fetch, {
      createTranscriptClient: () => transcriptClient,
      createGeminiClient: () => geminiClient
    });
    const transcriptResponse = await app.request(
      "/api/transcripts/fetch",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtu.be/abc123XYZ" }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );
    const { transcriptToken } = parseTranscriptTokenResponse(await transcriptResponse.json());

    const response = await app.request(
      "/api/reports/stream",
      {
        method: "POST",
        body: JSON.stringify({ transcriptToken }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );
    const events = await readSseEvents(response);

    expect(response.status).toBe(200);
    const streamEvents = events.filter(isStreamEvent);
    const headingEvent = streamEvents.find(
      (event) => event.type === "heading" && event.heading.id === "h3-detail"
    );

    expect(streamEvents.map((event) => event.type)).toContain("title");
    expect(headingEvent).toMatchObject({
      type: "heading",
      heading: { level: 3, parentId: "h2-context" }
    });
    expect(streamEvents.map((event) => event.type)).toContain("summary_paragraph");
    expect(streamEvents.map((event) => event.type)).toContain("complete");
    expect(transcriptClient.calls).toBe(1);
  });

  it("passes trimmed generation requirements to report streaming", async () => {
    const transcriptClient = new FakeTranscriptClient(transcript);
    const geminiClient = new FakeGeminiClient(hierarchicalReport);
    const app = createApp(fetch, {
      createTranscriptClient: () => transcriptClient,
      createGeminiClient: () => geminiClient
    });
    const transcriptResponse = await app.request(
      "/api/transcripts/fetch",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtu.be/abc123XYZ" }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );
    const { transcriptToken } = parseTranscriptTokenResponse(await transcriptResponse.json());

    const response = await app.request(
      "/api/reports/stream",
      {
        method: "POST",
        body: JSON.stringify({
          transcriptToken,
          generationRequirements: "  Create study notes for beginners.  "
        }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );

    expect(response.status).toBe(200);
    await readSseEvents(response);
    expect(geminiClient.lastOptions).toEqual({
      generationRequirements: "Create study notes for beginners."
    });
    expect(transcriptClient.calls).toBe(1);
  });

  it("omits blank generation requirements from report streaming", async () => {
    const geminiClient = new FakeGeminiClient(report);
    const app = createApp(fetch, {
      createTranscriptClient: () => new FakeTranscriptClient(transcript),
      createGeminiClient: () => geminiClient
    });
    const transcriptToken = await createTranscriptToken(app);

    const response = await app.request(
      "/api/reports/stream",
      {
        method: "POST",
        body: JSON.stringify({ transcriptToken, generationRequirements: "   " }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );

    expect(response.status).toBe(200);
    await readSseEvents(response);
    expect(geminiClient.lastOptions).toEqual({});
  });

  it("rejects invalid generation requirements before calling Gemini", async () => {
    const geminiClient = new FakeGeminiClient(report);
    const app = createApp(fetch, {
      createTranscriptClient: () => new FakeTranscriptClient(transcript),
      createGeminiClient: () => geminiClient
    });
    const transcriptToken = await createTranscriptToken(app);

    const response = await app.request(
      "/api/reports/stream",
      {
        method: "POST",
        body: JSON.stringify({ transcriptToken, generationRequirements: ["study notes"] }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "generation_validation_error",
        message: "Generation requirements must be text."
      }
    });
    expect(geminiClient.calls).toBe(0);
  });

  it("rejects excessive generation requirements before calling Gemini", async () => {
    const geminiClient = new FakeGeminiClient(report);
    const app = createApp(fetch, {
      createTranscriptClient: () => new FakeTranscriptClient(transcript),
      createGeminiClient: () => geminiClient
    });
    const transcriptToken = await createTranscriptToken(app);

    const response = await app.request(
      "/api/reports/stream",
      {
        method: "POST",
        body: JSON.stringify({ transcriptToken, generationRequirements: "x".repeat(1001) }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "generation_validation_error",
        message: "Generation requirements must be 1000 characters or fewer."
      }
    });
    expect(geminiClient.calls).toBe(0);
  });

  it("rejects invalid transcript handoffs before calling Gemini", async () => {
    const geminiClient = new FakeGeminiClient(report);
    const app = createApp(fetch, {
      createTranscriptClient: () => new FakeTranscriptClient(transcript),
      createGeminiClient: () => geminiClient
    });
    const response = await app.request(
      "/api/reports/stream",
      {
        method: "POST",
        body: JSON.stringify({ transcriptToken: "bad-token" }),
        headers: { "content-type": "application/json" }
      },
      { TRANSCRIPT_TOKEN_SECRET: "secret" }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "transcript_token_error" }
    });
    expect(geminiClient.calls).toBe(0);
  });
});

function parseTranscriptTokenResponse(value: unknown): { transcriptToken: string } {
  if (
    typeof value === "object" &&
    value !== null &&
    "transcriptToken" in value &&
    typeof value.transcriptToken === "string"
  ) {
    return { transcriptToken: value.transcriptToken };
  }
  throw new Error("Expected transcript token response.");
}

async function createTranscriptToken(app: ReturnType<typeof createApp>): Promise<string> {
  const transcriptResponse = await app.request(
    "/api/transcripts/fetch",
    {
      method: "POST",
      body: JSON.stringify({ url: "https://youtu.be/abc123XYZ" }),
      headers: { "content-type": "application/json" }
    },
    { TRANSCRIPT_TOKEN_SECRET: "secret" }
  );
  const { transcriptToken } = parseTranscriptTokenResponse(await transcriptResponse.json());
  return transcriptToken;
}

async function createReportContext(app: ReturnType<typeof createApp>): Promise<string> {
  const transcriptToken = await createTranscriptToken(app);
  const response = await app.request(
    "/api/reports/stream",
    {
      method: "POST",
      body: JSON.stringify({ transcriptToken }),
      headers: { "content-type": "application/json" }
    },
    { TRANSCRIPT_TOKEN_SECRET: "secret" }
  );
  const events = await readSseEvents(response);
  const contextEvent = findReportContextEvent(events);
  if (!contextEvent) {
    throw new Error("Expected report context event.");
  }
  return contextEvent.reportContextId;
}

function findReportContextEvent(
  events: unknown[]
): { type: "report_context"; reportContextId: string } | undefined {
  return events.find(
    (event): event is { type: "report_context"; reportContextId: string } =>
      typeof event === "object" &&
      event !== null &&
      "type" in event &&
      event.type === "report_context" &&
      "reportContextId" in event &&
      typeof event.reportContextId === "string"
  );
}

function parseChapterFiveWOneHResponse(value: unknown): {
  reportContextId: string;
  chapterId: string;
  summary: {
    who: string;
    what: string;
    when: string;
    where: string;
    why: string;
    how: string;
  };
} {
  if (
    typeof value === "object" &&
    value !== null &&
    "reportContextId" in value &&
    typeof value.reportContextId === "string" &&
    "chapterId" in value &&
    typeof value.chapterId === "string" &&
    "summary" in value &&
    typeof value.summary === "object" &&
    value.summary !== null &&
    "who" in value.summary &&
    typeof value.summary.who === "string" &&
    "what" in value.summary &&
    typeof value.summary.what === "string" &&
    "when" in value.summary &&
    typeof value.summary.when === "string" &&
    "where" in value.summary &&
    typeof value.summary.where === "string" &&
    "why" in value.summary &&
    typeof value.summary.why === "string" &&
    "how" in value.summary &&
    typeof value.summary.how === "string"
  ) {
    return {
      reportContextId: value.reportContextId,
      chapterId: value.chapterId,
      summary: {
        who: value.summary.who,
        what: value.summary.what,
        when: value.summary.when,
        where: value.summary.where,
        why: value.summary.why,
        how: value.summary.how
      }
    };
  }
  throw new Error("Expected chapter 5W1H response.");
}

function isStreamEvent(value: unknown): value is StreamEvent {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}
