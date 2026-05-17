## ADDED Requirements

### Requirement: Use official Gemini SDK where compatible
The system SHALL call Gemini through the official `@google/genai` JavaScript/TypeScript SDK when the SDK is compatible with the Cloudflare Worker runtime.

#### Scenario: SDK is compatible with Cloudflare Workers
- **WHEN** the SDK-backed Gemini adapter passes typecheck, tests, and Wrangler runtime compatibility checks
- **THEN** Gemini preflight and report generation use `@google/genai` instead of hand-written REST request construction

#### Scenario: SDK is not compatible with Cloudflare Workers
- **WHEN** the SDK cannot bundle or execute correctly in the Cloudflare Worker runtime
- **THEN** the system keeps the direct-fetch Gemini implementation
- **AND** documents the compatibility blocker before closing the change

### Requirement: Preserve Gemini application contract during SDK migration
The system SHALL preserve the existing Gemini client behavior for preflight, report generation, prompt handling, validation, and sanitized stream errors while migrating to `@google/genai`.

#### Scenario: Gemini preflight runs through SDK adapter
- **WHEN** the report stream starts
- **THEN** the SDK-backed client sends the existing tiny setup-check prompt without YouTube URL, caption segment, transcript text, or report content

#### Scenario: Report generation runs through SDK adapter
- **WHEN** transcript segments are available after preflight and caption parsing
- **THEN** the SDK-backed client sends the existing English report prompt and returns a validated Simplified Chinese structured report

#### Scenario: SDK returns provider failure
- **WHEN** the SDK reports authentication, quota, rate-limit, unavailable model, network, or service failure
- **THEN** the system maps the failure to the existing sanitized application error codes and browser-visible messages

#### Scenario: SDK returns malformed output
- **WHEN** the SDK response cannot be parsed into the expected report or preflight structure
- **THEN** the system reports a sanitized Gemini service or generation validation error instead of rendering invalid content

### Requirement: Keep SDK isolated from domain modules
The system SHALL isolate `@google/genai` usage inside the Gemini adapter and SHALL NOT expose SDK-specific types through report pipeline, transcript, streaming, server route, or browser modules.

#### Scenario: Pipeline uses Gemini client
- **WHEN** the report pipeline requests preflight or report generation
- **THEN** it depends only on the local `GeminiClient` interface and not on `@google/genai` SDK classes
