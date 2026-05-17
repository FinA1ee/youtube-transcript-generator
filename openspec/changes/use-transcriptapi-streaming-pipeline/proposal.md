## Why

The `youtube-transcript` npm package is likely to create Cloudflare Worker runtime and reliability risk because it depends on unofficial YouTube access. TranscriptAPI.com provides a simple REST service for YouTube transcript extraction, which better fits a Cloudflare Worker backend that can call external HTTP APIs with server-side secrets.

## What Changes

- Keep Hono as the web framework and Cloudflare Worker entrypoint.
- Replace the planned `youtube-transcript` package dependency with a TranscriptAPI.com service adapter.
- Fetch transcripts through TranscriptAPI's `GET /api/v2/youtube/transcript` endpoint using server-side Bearer-token authentication.
- Store the TranscriptAPI key only in Worker secrets/local ignored env files and never expose it to the browser.
- Keep transcript fetching as a backend step before Gemini generation; if TranscriptAPI reports no transcript, quota/payment, rate-limit, timeout, or service failure, return a sanitized transcript error without fallback.
- Call Gemini only after transcript content has been fetched and normalized.
- Use a stream-friendly chunk format for Gemini output so backend streaming and frontend rendering can proceed at the same time.
- Keep output report content in Simplified Chinese and UI text in English.
- Keep validation lightweight: validate event shape and safety, but do not block useful partial streamed content on strict final language/verbatim checks.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `report-html-rendering`: Clarify the Hono-served UI renders partial report chunks as they arrive.
- `transcript-acquisition`: Use TranscriptAPI.com REST service for server-side transcript fetching instead of local YouTube transcript package logic or OAuth-based YouTube APIs.
- `gemini-report-generation`: Generate stream-friendly Simplified Chinese report chunks from fetched transcript content with lightweight event validation.
- `streaming-report-delivery`: Use SSE to forward typed report chunks while Gemini generation continues.

## Impact

- Adds a TranscriptAPI service client and configuration such as `TRANSCRIPTAPI_KEY`.
- Removes the planned `youtube-transcript` package dependency from this change.
- Keeps the current Hono/Cloudflare Worker deployment model.
- Requires tests for TranscriptAPI request construction, error mapping, secret handling, no-Gemini-before-transcript behavior, and partial chunk streaming.
