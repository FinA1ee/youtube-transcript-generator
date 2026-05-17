import { AppError, CaptionKind, CaptionTrack, VideoMetadata } from "../shared/types";

interface PlayerCaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  name?: { simpleText?: string };
  kind?: string;
  isTranslatable?: boolean;
  vssId?: string;
}

interface PlayerResponse {
  videoDetails?: {
    title?: string;
    lengthSeconds?: string;
  };
  microformat?: {
    playerMicroformatRenderer?: {
      lengthSeconds?: string;
      availableCountries?: string[];
      category?: string;
    };
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: PlayerCaptionTrack[];
      audioTracks?: {
        defaultCaptionTrackIndex?: number;
        captionTrackIndices?: number[];
      }[];
    };
  };
}

export interface YoutubeClient {
  getVideoMetadata(videoId: string, signal?: AbortSignal): Promise<VideoMetadata>;
  fetchCaptionTrack(track: CaptionTrack, signal?: AbortSignal): Promise<string>;
}

export class PublicYoutubeClient implements YoutubeClient {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async getVideoMetadata(videoId: string, signal?: AbortSignal): Promise<VideoMetadata> {
    const requestInit: RequestInit = {
      headers: {
        "accept-language": "en-US,en;q=0.9"
      }
    };
    if (signal) {
      requestInit.signal = signal;
    }
    const response = await this.fetcher(`https://www.youtube.com/watch?v=${videoId}`, requestInit);

    if (!response.ok) {
      throw new AppError("transcript_unavailable", "Unable to load YouTube video metadata.", 502);
    }

    const html = await response.text();
    const playerResponse = extractPlayerResponse(html);
    if (!playerResponse) {
      throw new AppError("transcript_unavailable", "Unable to read YouTube caption metadata.", 502);
    }

    return toVideoMetadata(videoId, playerResponse);
  }

  async fetchCaptionTrack(track: CaptionTrack, signal?: AbortSignal): Promise<string> {
    const requestInit: RequestInit = {};
    if (signal) {
      requestInit.signal = signal;
    }
    const response = await this.fetcher(track.baseUrl, requestInit);
    if (!response.ok) {
      throw new AppError(
        "transcript_unavailable",
        "Unable to fetch the selected caption track.",
        502
      );
    }
    return response.text();
  }
}

export function selectCaptionTrack(metadata: VideoMetadata): CaptionTrack {
  if (metadata.captionTracks.length === 0) {
    throw new AppError("transcript_unavailable", "This video does not expose usable subtitles.");
  }

  const defaultLanguage = metadata.defaultLanguage;
  const defaultLanguageTracks = defaultLanguage
    ? metadata.captionTracks.filter((track) => track.languageCode === defaultLanguage)
    : metadata.captionTracks.filter((track) => track.isDefault);
  const candidates =
    defaultLanguageTracks.length > 0 ? defaultLanguageTracks : metadata.captionTracks;

  const selected =
    candidates.find((track) => track.kind === "manual") ??
    candidates.find((track) => track.kind === "auto_generated") ??
    candidates[0] ??
    metadata.captionTracks[0];
  if (!selected) {
    throw new AppError("transcript_unavailable", "This video does not expose usable subtitles.");
  }
  return selected;
}

function extractPlayerResponse(html: string): PlayerResponse | null {
  const marker = "ytInitialPlayerResponse = ";
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const jsonStart = markerIndex + marker.length;
  const jsonEnd = html.indexOf(";</script>", jsonStart);
  if (jsonEnd === -1) {
    return null;
  }

  const rawJson = html.slice(jsonStart, jsonEnd);
  const parsed = JSON.parse(rawJson) as unknown;
  return isPlayerResponse(parsed) ? parsed : null;
}

function isPlayerResponse(value: unknown): value is PlayerResponse {
  return typeof value === "object" && value !== null;
}

function toVideoMetadata(videoId: string, player: PlayerResponse): VideoMetadata {
  const tracklist = player.captions?.playerCaptionsTracklistRenderer;
  const defaultIndex = tracklist?.audioTracks?.[0]?.defaultCaptionTrackIndex;
  const captionTracks = (tracklist?.captionTracks ?? []).flatMap((track, index): CaptionTrack[] => {
    if (!track.baseUrl || !track.languageCode) {
      return [];
    }
    return [
      {
        baseUrl: track.baseUrl,
        languageCode: track.languageCode,
        name: track.name?.simpleText ?? track.languageCode,
        kind: toCaptionKind(track),
        isDefault: defaultIndex === index
      }
    ];
  });

  const duration =
    parseDurationSeconds(player.videoDetails?.lengthSeconds) ??
    parseDurationSeconds(player.microformat?.playerMicroformatRenderer?.lengthSeconds);

  return {
    videoId,
    title: player.videoDetails?.title,
    durationSeconds: duration,
    defaultLanguage: captionTracks.find((track) => track.isDefault)?.languageCode,
    captionTracks
  };
}

function toCaptionKind(track: PlayerCaptionTrack): CaptionKind {
  return track.kind === "asr" || track.vssId?.startsWith("a.") ? "auto_generated" : "manual";
}

function parseDurationSeconds(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
