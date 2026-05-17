import { AppError, Transcript } from "../shared/types";

export interface TranscriptTokenPayload {
  version: 1;
  expiresAt: number;
  transcript: Transcript;
}

export interface TranscriptTokenOptions {
  now?: number | undefined;
  ttlSeconds?: number | undefined;
}

const DEFAULT_TTL_SECONDS = 10 * 60;
const TOKEN_VERSION = 1;

export async function signTranscriptToken(
  transcript: Transcript,
  secret: string | undefined,
  options: TranscriptTokenOptions = {}
): Promise<string> {
  if (!secret) {
    throw new AppError(
      "transcript_config_error",
      "Transcript token secret is not configured.",
      500
    );
  }

  const now = options.now ?? Date.now();
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const payload: TranscriptTokenPayload = {
    version: TOKEN_VERSION,
    expiresAt: now + ttlSeconds * 1000,
    transcript
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifyTranscriptToken(
  token: string,
  secret: string | undefined,
  now = Date.now()
): Promise<Transcript> {
  if (!secret) {
    throw new AppError(
      "transcript_config_error",
      "Transcript token secret is not configured.",
      500
    );
  }

  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra !== undefined) {
    throw invalidToken();
  }

  const expectedSignature = await signValue(encodedPayload, secret);
  if (!constantTimeEqual(signature, expectedSignature)) {
    throw invalidToken();
  }

  const payload = parsePayload(encodedPayload);
  if (payload.expiresAt <= now) {
    throw new AppError("transcript_token_error", "Transcript token has expired.", 400);
  }
  return payload.transcript;
}

function parsePayload(encodedPayload: string): TranscriptTokenPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(encodedPayload)) as unknown;
  } catch {
    throw invalidToken();
  }

  if (!isRecord(parsed) || parsed["version"] !== TOKEN_VERSION) {
    throw invalidToken();
  }
  if (typeof parsed["expiresAt"] !== "number" || !Number.isFinite(parsed["expiresAt"])) {
    throw invalidToken();
  }
  const transcript = parsed["transcript"];
  if (!isTranscript(transcript)) {
    throw invalidToken();
  }

  return {
    version: TOKEN_VERSION,
    expiresAt: parsed["expiresAt"],
    transcript
  };
}

function isTranscript(value: unknown): value is Transcript {
  if (!isRecord(value) || !Array.isArray(value["segments"])) {
    return false;
  }
  return value["segments"].every(
    (segment) =>
      isRecord(segment) &&
      typeof segment["startMs"] === "number" &&
      typeof segment["text"] === "string"
  );
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function base64UrlEncode(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function invalidToken(): AppError {
  return new AppError("transcript_token_error", "Transcript token is invalid.", 400);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
