## Context

The current Gemini client constructs REST requests manually with `fetch`. That is small and transparent, but it means this project owns request payload shape, status mapping, response extraction, and future Gemini API drift. Google's Gemini API library page now recommends the Google GenAI SDK as the official production-ready library for JavaScript/TypeScript, and the SDK reference documents `GoogleGenAI`, API-key initialization, `generateContent`, and `generateContentStream`.

This project deploys to Cloudflare Workers, so the SDK decision must be gated by runtime compatibility. The existing `GeminiClient` interface and report pipeline should remain the application boundary even if the implementation moves to the SDK.

## Goals / Non-Goals

**Goals:**

- Prefer `@google/genai` for Gemini API calls when it works in Cloudflare Workers.
- Preserve the existing app-level behavior for preflight, report generation, prompt construction, report validation, and sanitized SSE errors.
- Keep Gemini dependency details isolated inside `src/llm/`.
- Verify the SDK works under Wrangler/local Worker execution before removing the direct `fetch` implementation.
- Keep tests focused on stable app behavior instead of SDK internals.

**Non-Goals:**

- Changing the report prompt or output language requirements.
- Moving to Vertex AI or Gemini Enterprise Agent Platform.
- Exposing Gemini calls from browser code.
- Adding a frontend model picker.
- Adding durable jobs, report download, or any other deferred product capability.

## Decisions

### Prefer the official SDK behind the existing client interface

Use `@google/genai` inside the existing Gemini adapter rather than exposing SDK classes to routes or the report pipeline. The public application contract remains `GeminiClient.preflight()` and `GeminiClient.generateReport()`.

This is better than direct fetch if the SDK is compatible because:

- Google documents it as the recommended, maintained JavaScript/TypeScript library.
- It reduces custom payload-building code.
- It should track newer Gemini features and response shapes better than hand-written REST calls.
- It gives a cleaner path to future streaming or structured-output improvements.

Alternatives considered:

- Keep direct fetch permanently: smallest bundle and fully transparent, but more likely to drift from official examples and newer Gemini features.
- Use the old `@google/generative-ai` package: not preferred because Google now points JavaScript/TypeScript users to `@google/genai`.
- Use SDK types throughout the app: rejected because provider types should not leak into transcript, report, or streaming modules.

### Prove Cloudflare compatibility before deleting direct fetch

Add `@google/genai`, build the Worker, run unit/e2e tests, and run Wrangler locally against the Gemini preflight path. If the SDK imports Node-only dependencies or fails under the Worker runtime, keep direct fetch as a fallback and document the reason.

The compatibility check should include:

- TypeScript compile with strict mode.
- Wrangler build/dev startup.
- A mocked e2e path using the SDK adapter.
- A manual or environment-gated real preflight test when `GEMINI_API_KEY` is available.

Alternatives considered:

- Replace direct fetch immediately without runtime verification: too risky for Cloudflare Workers.
- Keep both clients selectable at runtime from the start: unnecessary unless compatibility or rollout risk justifies it.

### Keep error mapping at the application boundary

SDK exceptions must be translated into existing `AppError` codes: `gemini_config_error`, `gemini_rate_limited`, and `gemini_service_error`. Browser-visible messages must remain sanitized and must not include raw SDK errors, API keys, request URLs, stack traces, or provider payloads.

Alternatives considered:

- Surface SDK error messages directly: easier, but risks leaking internals and creates unstable UI text.
- Add new error codes for SDK-specific failures: unnecessary unless a user-visible recovery path differs.

### Keep direct fetch fallback until SDK behavior is verified

The implementation can keep the current direct fetch client as a private fallback during the migration. Once `@google/genai` is verified in Cloudflare Workers and tests cover the same behavior, the fallback can be removed to avoid duplicate Gemini implementations.

Alternatives considered:

- Remove direct fetch in the same patch: clean, but leaves no fallback if Worker runtime behavior fails late.
- Keep both implementations indefinitely: flexible, but increases maintenance and test matrix cost.

## Risks / Trade-offs

- SDK may not bundle cleanly for Cloudflare Workers -> verify with Wrangler before removing direct fetch.
- SDK may increase Worker bundle size -> inspect build output and keep dependency justified by lower maintenance risk.
- SDK error shapes may be unstable -> map all SDK failures through app-level errors and test the mapping.
- SDK may use different defaults than current REST request -> explicitly pass model, API key, API version if needed, response MIME type, and generation options.
- Local package version lookup may fail in restricted environments -> verify package resolution during implementation with normal network access or approved dependency install.

## Migration Plan

1. Install `@google/genai`.
2. Add or refactor a SDK-backed Gemini adapter behind the existing `GeminiClient` interface.
3. Preserve the existing prompt builder, report schema validation, and preflight prompt.
4. Update tests to assert behavior and SDK call inputs without relying on raw REST payload URLs.
5. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, and Wrangler build/dev checks.
6. If SDK compatibility fails, keep direct fetch and document the blocker in this change.

Rollback is to remove the SDK dependency and restore the direct-fetch Gemini adapter already covered by the existing tests.

## Open Questions

- Does the current `@google/genai` release bundle and execute correctly in Cloudflare Workers without Node-only runtime dependencies?
- Should the SDK adapter use the default beta endpoint or explicitly set an API version for the Gemini Developer API?

## Implementation Record

- Installed `@google/genai` version `2.3.0`.
- Verified strict TypeScript imports using the SDK web entrypoint, `@google/genai/web`.
- Verified Wrangler dry-run bundling succeeds for the Cloudflare Worker with the SDK included.
- Removed the direct REST `fetch` Gemini implementation instead of retaining a fallback.
- Kept SDK types isolated to `src/llm/gemini.ts`; the report pipeline and server route still depend on the local `GeminiClient` interface.
- Observed that `models.generateContent` uses the runtime global `fetch`; tests therefore stub global `fetch` for SDK-backed Gemini calls.
