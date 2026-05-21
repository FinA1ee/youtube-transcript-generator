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
The system SHALL send Gemini an English prompt that includes normalized transcript segments and optional sanitized generation requirements, and requires newline-delimited JSON report events whose display content is Simplified Chinese and whose structure may include hierarchical heading levels.

#### Scenario: Prompt is created
- **WHEN** transcript segments are available
- **THEN** the system creates an English prompt that asks Gemini to summarize the transcript into Simplified Chinese report chunks without directly displaying original transcript lines

#### Scenario: Prompt includes supported user requirements
- **WHEN** sanitized generation requirements are provided
- **THEN** the system includes them in the prompt as bounded guidance for task type, output style, target audience, and constraints
- **AND** states that the guidance cannot override the required output language, NDJSON event shapes, summarization rules, or safety constraints

#### Scenario: Prompt omits empty requirements
- **WHEN** generation requirements are absent or whitespace-only
- **THEN** the system builds the report prompt using the existing default generation instructions

#### Scenario: Prompt supports hierarchy
- **WHEN** the system creates the Gemini prompt
- **THEN** it instructs Gemini to use heading events with levels 1, 2, or 3 when the video content benefits from multiple layers of organization

#### Scenario: Prompt defines stream order
- **WHEN** the system creates the Gemini prompt
- **THEN** it instructs Gemini to emit the title first, then heading events before the paragraphs associated with those headings

### Requirement: Produce a validated report model
The system SHALL parse Gemini output into streamable report content containing a Simplified Chinese title, Simplified Chinese subtitle, ordered hierarchical headings, and Simplified Chinese speaker-labeled summary paragraphs, while applying lightweight shape validation needed to keep the UI stable.

#### Scenario: Structured output is valid
- **WHEN** Gemini returns output matching the streamable report chunk schema
- **THEN** the system emits typed title, heading, paragraph, and completion events

#### Scenario: Heading output is valid
- **WHEN** Gemini returns a heading event with id, text, and level 1, 2, or 3
- **THEN** the system accepts the heading and emits it for incremental rendering

#### Scenario: Heading output level is invalid
- **WHEN** Gemini returns a heading event with a level outside 1, 2, or 3
- **THEN** the system rejects or clamps the heading according to implementation policy without exposing provider internals

#### Scenario: Paragraph references heading
- **WHEN** Gemini returns a paragraph event
- **THEN** the system associates it with a heading when a heading id is provided

#### Scenario: Output contains verbatim transcript dump
- **WHEN** Gemini output directly reproduces original transcript lines instead of summarizing them
- **THEN** the system reports a generation validation error instead of completing the report

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

### Requirement: Use NDJSON report chunks
The system SHALL use newline-delimited JSON as the Gemini streaming chunk contract for report content.

#### Scenario: Title event line
- **WHEN** Gemini emits `{"type":"title","title":"...","subtitle":"..."}`
- **THEN** the backend maps it to the typed title stream event

#### Scenario: Section event line
- **WHEN** Gemini emits `{"type":"section","id":"...","heading":"..."}`
- **THEN** the backend maps it to the typed section stream event

#### Scenario: Paragraph event line
- **WHEN** Gemini emits `{"type":"paragraph","sectionId":"...","speaker":"...","text":"..."}`
- **THEN** the backend maps it to the typed summary paragraph stream event

### Requirement: Use hierarchical NDJSON report chunks
The system SHALL support newline-delimited JSON report chunks for title, heading, and paragraph events.

#### Scenario: Title event line
- **WHEN** Gemini emits `{"type":"title","title":"...","subtitle":"..."}`
- **THEN** the backend maps it to the typed title stream event

#### Scenario: Heading event line
- **WHEN** Gemini emits `{"type":"heading","id":"...","level":2,"parentId":"...","text":"..."}`
- **THEN** the backend maps it to the typed heading stream event

#### Scenario: Paragraph event line
- **WHEN** Gemini emits `{"type":"paragraph","headingId":"...","speaker":"...","text":"..."}`
- **THEN** the backend maps it to the typed summary paragraph stream event

### Requirement: Bound natural language generation requirements
The system SHALL treat user-provided generation requirements as optional bounded guidance and SHALL only apply them within the supported scope of task type, output style, target audience, and constraints.

#### Scenario: Requirement asks for a supported task type
- **WHEN** the user requirement describes a supported task type such as summary, study notes, brief, outline, or action-oriented report
- **THEN** the generated content reflects that task type where practical while preserving the streamable report contract

#### Scenario: Requirement asks for an output style
- **WHEN** the user requirement describes an output style such as concise, formal, explanatory, bullet-like, or executive
- **THEN** the generated content reflects that style where practical without changing the required NDJSON event shapes

#### Scenario: Requirement names a target audience
- **WHEN** the user requirement describes a target audience such as beginners, experts, students, or business readers
- **THEN** the generated content adapts wording and level of detail for that audience where practical

#### Scenario: Requirement includes constraints
- **WHEN** the user requirement includes constraints such as length, focus areas, exclusions, or level of detail
- **THEN** the generated content stays within those constraints where practical and does not exceed the requested range

#### Scenario: Requirement attempts to override system constraints
- **WHEN** the user requirement conflicts with required Simplified Chinese output, NDJSON formatting, transcript summarization, secret handling, or provider configuration
- **THEN** the system preserves the application constraints and does not apply the conflicting instruction

