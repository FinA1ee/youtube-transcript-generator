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
    expect(script).toContain("Test Gemini");
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

function isStreamEvent(value: unknown): value is StreamEvent {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}
