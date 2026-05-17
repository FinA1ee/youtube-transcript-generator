import { AppError } from "../shared/types";

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{6,}$/;

export function normalizeYoutubeUrl(input: string): { videoId: string; canonicalUrl: string } {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new AppError("invalid_youtube_url", "Enter a valid YouTube video URL.");
  }

  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) {
    throw new AppError("invalid_youtube_url", "Only YouTube video URLs are supported.");
  }

  const videoId = extractVideoId(parsed);
  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) {
    throw new AppError("invalid_youtube_url", "The YouTube URL does not include a valid video id.");
  }

  return {
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`
  };
}

function extractVideoId(url: URL): string | null {
  if (url.hostname.toLowerCase() === "youtu.be") {
    return url.pathname.split("/").find(Boolean) ?? null;
  }

  if (url.pathname === "/watch") {
    return url.searchParams.get("v");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "embed" || parts[0] === "shorts") {
    return parts[1] ?? null;
  }

  return null;
}
