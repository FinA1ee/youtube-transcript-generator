# gemini-report-generation Specification

## Purpose
TBD - created by archiving change build-streaming-youtube-report-app. Update Purpose after archive.
## Requirements
### Requirement: Use Gemini AI Studio free API configuration
The system SHALL generate reports through the Gemini AI Studio API path configured for free-tier API key usage and default to the official Gemini 3 Flash Preview model code `gemini-3-flash-preview` unless the project owner explicitly approves another provider or paid configuration.

#### Scenario: Gemini API key is configured
- **WHEN** the report pipeline starts generation
- **THEN** the system reads the Gemini API key from environment configuration or Worker secrets

#### Scenario: Gemini API key is missing
- **WHEN** the report pipeline starts without a configured Gemini API key
- **THEN** the system reports a configuration error without attempting report generation

#### Scenario: Default model is used
- **WHEN** the report pipeline starts without a user-selected model
- **THEN** the system uses `gemini-3-flash-preview` as the Gemini model

#### Scenario: Frontend model selection is unavailable
- **WHEN** a user starts report generation in the first release
- **THEN** the system does not expose a frontend model picker and uses the configured default model

### Requirement: Preflight Gemini setup before transcript content is sent
The system SHALL NOT run Gemini setup preflight automatically as part of report generation. Gemini setup preflight SHALL be available through the separate user-triggered Gemini preflight diagnostics capability.

#### Scenario: Report stream starts
- **WHEN** the report SSE stream starts with a valid YouTube URL
- **THEN** the system validates the URL and continues to transcript acquisition without calling Gemini preflight

#### Scenario: Report generation reaches Gemini
- **WHEN** transcript segments are available and the system starts report generation
- **THEN** the system sends the report-generation prompt to Gemini
- **AND** maps any Gemini setup, authentication, quota, rate-limit, model, network, or service failure to sanitized generation errors

#### Scenario: User wants to test Gemini setup
- **WHEN** the user wants to verify Gemini setup before report generation
- **THEN** the user uses the separate Gemini preflight diagnostics control

### Requirement: Build a Simplified Chinese structured summary prompt
The system SHALL send Gemini an English prompt that includes normalized transcript segments and requires a structured report written entirely in Simplified Chinese with title, subtitle, sections, and speaker-labeled summarized paragraphs.

#### Scenario: Prompt is created
- **WHEN** transcript segments are available
- **THEN** the system creates an English prompt that asks Gemini to summarize the transcript into Simplified Chinese speaker-labeled report paragraphs without directly displaying original transcript lines

### Requirement: Produce a validated report model
The system SHALL validate Gemini output into a report model containing a Simplified Chinese title, Simplified Chinese subtitle, ordered sections, and Simplified Chinese speaker-labeled summary paragraphs derived from transcript evidence.

#### Scenario: Structured output is valid
- **WHEN** Gemini returns output matching the report schema
- **THEN** the system emits a complete validated report

#### Scenario: Structured output is invalid
- **WHEN** Gemini returns malformed or schema-incompatible output
- **THEN** the system reports a generation error instead of rendering invalid report content as complete

#### Scenario: Output is not Chinese
- **WHEN** Gemini returns report title, subtitle, section, or paragraph content that is not in Chinese
- **THEN** the system reports a generation validation error instead of completing the report

#### Scenario: Output is not Simplified Chinese
- **WHEN** Gemini returns Traditional Chinese content in report title, subtitle, section, or paragraph content
- **THEN** the system reports a generation validation error instead of completing the report

#### Scenario: Output contains verbatim transcript dump
- **WHEN** Gemini output directly reproduces original transcript lines instead of summarizing them
- **THEN** the system reports a generation validation error instead of completing the report

#### Scenario: Output uses dialog-style summary paragraphs
- **WHEN** Gemini returns summary paragraphs with speaker or role labels such as `Jack:` or `旁白:`
- **THEN** the system accepts the paragraphs when the text after the label is Simplified Chinese summarized content rather than raw transcript text

### Requirement: Handle Gemini service failures
The system SHALL map Gemini quota, rate-limit, authentication, network, and server failures into user-visible generation errors.

#### Scenario: Gemini returns rate limit
- **WHEN** Gemini returns a quota or rate-limit response
- **THEN** the system reports that generation is temporarily unavailable due to Gemini limits

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

