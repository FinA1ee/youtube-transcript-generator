import { afterEach, describe, expect, it, vi } from "vitest";
import { TranscriptApiClient } from "../../src/transcripts/client";

describe("TranscriptApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a TranscriptAPI request and maps successful responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        video_id: "abc123XYZ",
        language: "en",
        metadata: { duration_seconds: 60 },
        transcript: [
          { text: " Hello world ", start: 0, duration: 2.5 },
          { text: "Second line", start: "2.5", duration: "3" }
        ]
      })
    );
    const client = new TranscriptApiClient({ apiKey: "key" }, fetcher);

    const transcript = await client.fetchTranscript("https://www.youtube.com/watch?v=abc123XYZ");

    expect(fetcher).toHaveBeenCalledTimes(1);
    const call = fetcher.mock.calls[0];
    if (!call) throw new Error("Expected TranscriptAPI fetch call.");
    const requestUrl = call[0];
    if (typeof requestUrl !== "string") {
      throw new Error("Expected TranscriptAPI URL string.");
    }
    const url = new URL(requestUrl);
    expect(url.origin + url.pathname).toBe("https://transcriptapi.com/api/v2/youtube/transcript");
    expect(url.searchParams.get("video_url")).toBe("https://www.youtube.com/watch?v=abc123XYZ");
    expect(call[1]?.headers).toMatchObject({ Authorization: "Bearer key" });
    expect(transcript).toMatchObject({
      videoId: "abc123XYZ",
      language: "en",
      durationSeconds: 60,
      segments: [
        { startMs: 0, endMs: 2500, text: "Hello world", speaker: "unknown" },
        { startMs: 2500, endMs: 5500, text: "Second line", speaker: "unknown" }
      ]
    });
  });

  it("rejects missing API key before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new TranscriptApiClient({}, fetcher);

    await expect(
      client.fetchTranscript("https://www.youtube.com/watch?v=abc123XYZ")
    ).rejects.toMatchObject({ code: "transcript_config_error" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [402, "transcript_provider_error"],
    [408, "transcript_provider_error"],
    [429, "transcript_provider_error"],
    [503, "transcript_provider_error"],
    [404, "transcript_unavailable"],
    [401, "transcript_config_error"]
  ] as const)("maps provider status %s", async (status, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status }));
    const client = new TranscriptApiClient({ apiKey: "key" }, fetcher);

    await expect(
      client.fetchTranscript("https://www.youtube.com/watch?v=abc123XYZ")
    ).rejects.toMatchObject({ code });
  });

  it("maps malformed responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ transcript: "bad" }));
    const client = new TranscriptApiClient({ apiKey: "key" }, fetcher);

    await expect(
      client.fetchTranscript("https://www.youtube.com/watch?v=abc123XYZ")
    ).rejects.toMatchObject({ code: "transcript_parse_error" });
  });

  it("maps network failures", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network failed"));
    const client = new TranscriptApiClient({ apiKey: "key" }, fetcher);

    await expect(
      client.fetchTranscript("https://www.youtube.com/watch?v=abc123XYZ")
    ).rejects.toMatchObject({ code: "transcript_provider_error" });
  });

  it("enforces transcript limits", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        video_id: "abc123XYZ",
        metadata: { duration_seconds: 6100 },
        transcript: [{ text: "Hello", start: 0, duration: 1 }]
      })
    );
    const client = new TranscriptApiClient({ apiKey: "key" }, fetcher);

    await expect(
      client.fetchTranscript("https://www.youtube.com/watch?v=abc123XYZ", {
        maxDurationMinutes: 100
      })
    ).rejects.toMatchObject({ code: "transcript_too_large" });
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" }
  });
}
