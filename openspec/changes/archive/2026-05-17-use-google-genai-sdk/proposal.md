## Why

Google's current Gemini API documentation recommends the official Google GenAI SDK for JavaScript/TypeScript instead of hand-written REST calls. Moving the Gemini client to `@google/genai` should reduce request-shape drift, make structured output and future Gemini features easier to adopt, and keep this project closer to supported examples.

## What Changes

- Replace the custom Gemini REST `fetch` request construction with an adapter built on `@google/genai`, if the SDK is compatible with the Cloudflare Worker runtime.
- Keep the existing Gemini client boundary so the report pipeline, SSE route, tests, and browser behavior do not depend directly on the SDK.
- Preserve the current preflight behavior: a tiny setup check runs before transcript fetching, sends no user content, and maps setup failures to sanitized stream errors.
- Preserve the current report-generation behavior: English prompt in, Simplified Chinese structured report out, validated through the existing report model.
- Add tests proving the SDK adapter maps missing credentials, invalid credentials, quota/rate-limit, unavailable model, network/service errors, malformed output, and successful output into the same application-level outcomes as the current client.
- Keep a direct-fetch fallback only if implementation proves `@google/genai` cannot run reliably in Cloudflare Workers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `gemini-report-generation`: Gemini API calls should be made through the official `@google/genai` SDK where compatible, while preserving the existing app-level preflight, prompt, validation, and error contracts.

## Impact

- Adds a runtime dependency on `@google/genai`.
- Updates `src/llm/gemini.ts` or adds a dedicated SDK-backed adapter under `src/llm/`.
- Updates tests and fixtures around Gemini request behavior so they assert app-level outcomes rather than exact REST payload details.
- Requires a Cloudflare Worker compatibility check before removing the direct REST implementation.
- May reduce custom HTTP code but introduces SDK versioning and bundle-size considerations.
