## 1. Dependency and Compatibility

- [x] 1.1 Verify the current `@google/genai` package version and install it as a production dependency.
- [x] 1.2 Confirm TypeScript strict-mode imports work without weakening compiler or lint rules.
- [x] 1.3 Run a Wrangler build or local Worker startup check to confirm the SDK bundles for Cloudflare Workers.
- [x] 1.4 If Worker compatibility fails, document the blocker and keep the direct-fetch Gemini client as the implementation.

## 2. SDK Adapter

- [x] 2.1 Refactor `src/llm/gemini.ts` so the production Gemini adapter uses `@google/genai` behind the existing `GeminiClient` interface when compatible.
- [x] 2.2 Preserve the current `preflight` behavior with the tiny setup-check prompt and no user URL or transcript content.
- [x] 2.3 Preserve report generation with the existing English prompt, configured model, JSON response expectation, and final report validation.
- [x] 2.4 Map SDK authentication, quota, rate-limit, unavailable model, network, service, and malformed-output failures to existing sanitized `AppError` codes.
- [x] 2.5 Keep SDK-specific types inside `src/llm/` so report pipeline, server routes, shared domain types, and browser code remain provider-agnostic.

## 3. Tests and Verification

- [x] 3.1 Update Gemini unit tests to cover SDK-backed preflight success, missing credentials, invalid credentials, quota or rate-limit failure, unavailable model, network failure, invalid preflight output, and no user-content leakage in the preflight prompt.
- [x] 3.2 Update report-generation tests to cover SDK-backed valid report output, malformed report output, non-Simplified-Chinese validation, and verbatim transcript rejection.
- [x] 3.3 Update pipeline and e2e tests to confirm preflight failure still stops before caption fetching and emits sanitized SSE errors.
- [x] 3.4 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, and OpenSpec validation.
- [x] 3.5 Record whether the direct-fetch fallback was removed or retained after SDK compatibility verification.
