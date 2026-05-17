import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/server/app";
import { AppError } from "../../src/shared/types";
import { report, transcript } from "../fixtures/captions";
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
    expect(html).toContain("Test Gemini");
    expect(html).toContain("diagnostic-status");
    expect(html).not.toContain("GEMINI_API_KEY");
    expect(html).not.toContain("TRANSCRIPTAPI_KEY");
    expect(html).not.toContain("TRANSCRIPT_TOKEN_SECRET");
  });

  it("uses standalone preflight and fetch-based POST stream in the browser script", async () => {
    const app = createApp();
    const response = await app.request("/client.js");
    const script = await response.text();

    expect(response.status).toBe(200);
    expect(script).toContain('fetch("/api/gemini/preflight", { method: "POST" })');
    expect(script).toContain('fetch("/api/transcripts/fetch"');
    expect(script).toContain('fetch("/api/reports/stream"');
    expect(script).toContain("readSseStream");
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
    const geminiClient = new FakeGeminiClient(report);
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
    expect(events.map((event) => (event as { type: string }).type)).toContain("title");
    expect(events).toContainEqual(expect.objectContaining({ type: "summary_paragraph" }));
    expect(events).toContainEqual(expect.objectContaining({ type: "complete" }));
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
