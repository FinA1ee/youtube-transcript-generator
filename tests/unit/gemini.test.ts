import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_PREFLIGHT_PROMPT,
  GeminiApiClient
} from "../../src/llm/gemini";
import { buildReportPrompt } from "../../src/llm/prompt";
import { validateReport } from "../../src/reports/validation";
import { AppError, Report } from "../../src/shared/types";
import { report, transcript } from "../fixtures/captions";

describe("Gemini report generation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the default Gemini 3 Flash Preview model", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3-flash-preview");
  });

  it("builds an English prompt requiring Simplified Chinese output", () => {
    const prompt = buildReportPrompt(transcript);
    expect(prompt).toContain("The report content must be written in Simplified Chinese.");
    expect(prompt).toContain("Do not output the original transcript.");
    expect(prompt).toContain("Return newline-delimited JSON only.");
    expect(prompt).toContain('"type":"paragraph"');
    expect(prompt).toContain("Caption segments:");
  });

  it("rejects missing API key before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const client = new GeminiApiClient({});

    await expect(client.generateReport(transcript)).rejects.toThrow(AppError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preflights Gemini setup with the default model and no user content", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(geminiTextResponse(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetcher);
    const client = new GeminiApiClient({ apiKey: "key" });

    await expect(client.preflight()).resolves.toBeUndefined();

    expect(fetcher).toHaveBeenCalledTimes(1);
    const call = fetcher.mock.calls[0];
    if (!call) throw new Error("Expected Gemini preflight fetch call.");
    const url = call[0];
    if (typeof url !== "string") throw new Error("Expected Gemini preflight URL string.");
    expect(url).toContain(DEFAULT_GEMINI_MODEL);
    const init = call[1];
    const requestBody = init?.body;
    if (typeof requestBody !== "string") throw new Error("Expected Gemini preflight JSON body.");
    const body = JSON.parse(requestBody) as {
      contents: { parts: { text: string }[] }[];
    };
    const prompt = body.contents[0]?.parts[0]?.text;
    expect(prompt).toBe(GEMINI_PREFLIGHT_PROMPT);
    expect(prompt).not.toContain("https://www.youtube.com/watch?v=abc123XYZ");
    expect(prompt).not.toContain(transcript.segments[0]?.text);
  });

  it("rejects missing API key before Gemini preflight makes a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const client = new GeminiApiClient({});

    await expect(client.preflight()).rejects.toMatchObject({ code: "gemini_config_error" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401, "gemini_config_error"],
    [403, "gemini_config_error"],
    [404, "gemini_service_error"],
    [429, "gemini_rate_limited"]
  ] as const)("maps Gemini preflight status %s", async (status, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status }));
    vi.stubGlobal("fetch", fetcher);
    const client = new GeminiApiClient({ apiKey: "key" });

    await expect(client.preflight()).rejects.toMatchObject({ code });
  });

  it("maps Gemini preflight network failures", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network failed"));
    vi.stubGlobal("fetch", fetcher);
    const client = new GeminiApiClient({ apiKey: "key" });

    await expect(client.preflight()).rejects.toMatchObject({ code: "gemini_service_error" });
  });

  it("rejects invalid Gemini preflight output", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(geminiTextResponse("not json"));
    vi.stubGlobal("fetch", fetcher);
    const client = new GeminiApiClient({ apiKey: "key" });

    await expect(client.preflight()).rejects.toMatchObject({
      code: "gemini_service_error",
      message: "Gemini setup check returned invalid output."
    });
  });

  it("maps rate limit responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    const client = new GeminiApiClient({ apiKey: "key" });

    await expect(client.generateReport(transcript)).rejects.toThrow(AppError);
  });

  it("validates successful structured output", () => {
    expect(validateReport(report, transcript)).toEqual(report);
  });

  it("rejects verbatim transcript dumps", () => {
    const badReport: Report = {
      ...report,
      sections: [
        {
          id: "section-1",
          heading: "开场与目标",
          paragraphs: [
            {
              id: "p-1",
              text: "Jack: Hello and welcome to the product discussion."
            }
          ]
        }
      ]
    };

    expect(() => validateReport(badReport, transcript)).toThrow(AppError);
  });
});

function geminiTextResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text }]
          }
        }
      ]
    })
  );
}
