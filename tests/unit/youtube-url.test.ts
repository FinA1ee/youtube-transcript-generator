import { describe, expect, it } from "vitest";
import { normalizeYoutubeUrl } from "../../src/youtube/url";
import { AppError } from "../../src/shared/types";

describe("normalizeYoutubeUrl", () => {
  it("accepts watch URLs", () => {
    expect(normalizeYoutubeUrl("https://www.youtube.com/watch?v=abc123XYZ").videoId).toBe(
      "abc123XYZ"
    );
  });

  it("accepts short URLs", () => {
    expect(normalizeYoutubeUrl("https://youtu.be/abc123XYZ").videoId).toBe("abc123XYZ");
  });

  it("accepts embed and shorts URLs", () => {
    expect(normalizeYoutubeUrl("https://www.youtube.com/embed/abc123XYZ").videoId).toBe(
      "abc123XYZ"
    );
    expect(normalizeYoutubeUrl("https://www.youtube.com/shorts/abc123XYZ").videoId).toBe(
      "abc123XYZ"
    );
  });

  it("rejects malformed and unsupported URLs", () => {
    expect(() => normalizeYoutubeUrl("not a url")).toThrow(AppError);
    expect(() => normalizeYoutubeUrl("https://example.com/watch?v=abc123XYZ")).toThrow(AppError);
    expect(() => normalizeYoutubeUrl("https://www.youtube.com/watch")).toThrow(AppError);
  });
});
