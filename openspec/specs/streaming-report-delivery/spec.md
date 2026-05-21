# streaming-report-delivery Specification

## Purpose
TBD - created by archiving change build-streaming-youtube-report-app. Update Purpose after archive.
## Requirements
### Requirement: Stream report generation over SSE
The system SHALL provide a report streaming endpoint that accepts a previously fetched transcript handoff and streams typed report events to the browser while Gemini generation is in progress. The report-generation stream SHALL NOT run Gemini preflight or fetch transcripts.

#### Scenario: SSE generation starts
- **WHEN** the browser opens the report stream with a valid transcript handoff
- **THEN** the system verifies the handoff and starts Gemini report generation
- **AND** does not run Gemini preflight
- **AND** does not call the transcript provider

#### Scenario: Invalid stream request is submitted
- **WHEN** the browser opens the report stream without a valid transcript handoff
- **THEN** the system emits or returns an error without calling the transcript provider or Gemini

### Requirement: Emit typed stream events
The system SHALL emit JSON events with explicit event types for report-generation progress, partial Simplified Chinese report title, hierarchical headings, speaker-labeled summary paragraphs, errors, and completion.

#### Scenario: Title is generated
- **WHEN** the backend parses a valid Gemini title chunk
- **THEN** the system immediately emits the corresponding typed title stream event that the browser can render incrementally

#### Scenario: Heading is generated
- **WHEN** the backend parses a valid Gemini heading chunk
- **THEN** the system immediately emits the corresponding typed heading stream event including heading level

#### Scenario: Partial report paragraph is generated
- **WHEN** the backend parses a valid Gemini paragraph chunk after transcript handoff verification
- **THEN** the system immediately emits the corresponding typed paragraph stream event that the browser can render incrementally

#### Scenario: Generation state changes
- **WHEN** the backend moves through Gemini generation, streaming, completion, retry, or error states
- **THEN** the system emits typed progress or state events that the browser can display as user-facing notifications

#### Scenario: Generation completes
- **WHEN** Gemini generation finishes and the backend has emitted all usable report content
- **THEN** the system emits a complete event for the current report stream

### Requirement: Support client cancellation
The system SHALL stop report generation when the client closes the SSE connection, including when the user clicks the cancel button.

#### Scenario: Client disconnects
- **WHEN** the browser closes the SSE connection during generation
- **THEN** the system stops ongoing downstream work where the runtime and external APIs allow cancellation

#### Scenario: User cancels generation
- **WHEN** the browser closes the SSE connection because the user clicked cancel
- **THEN** the system aborts downstream work where supported and emits no further events for that connection

### Requirement: Handle SSE retry state
The system SHALL support browser retry handling by emitting ordered SSE events and exposing sanitized retry or retry-failed states when a stream disconnects before completion.

#### Scenario: Stream disconnects before completion
- **WHEN** the SSE stream disconnects before a complete or error event
- **THEN** the browser shows a reconnecting state and attempts up to 5 retries using exponential backoff with jitter

#### Scenario: Retry succeeds
- **WHEN** the browser reconnects and receives subsequent stream events
- **THEN** the browser continues rendering the report and clears the reconnecting state

#### Scenario: Retry fails
- **WHEN** the browser exhausts 5 retry attempts or the backend cannot continue the stream safely
- **THEN** the browser shows a retry-failed notification, leaves partial rendered content visible, and allows the user to re-enter the URL

### Requirement: Protect the stream from secret leakage
The system SHALL never send Gemini API keys, TranscriptAPI keys, transcript token secrets, Cloudflare credentials, internal stack traces, raw provider error payloads, or raw generation requirement validation internals to the browser over the report stream.

#### Scenario: Provider error occurs
- **WHEN** an upstream provider fails with a detailed internal error
- **THEN** the system emits a sanitized user-visible error event

#### Scenario: Heading or title chunk is malformed
- **WHEN** Gemini returns malformed heading or title output
- **THEN** the system emits a sanitized generation error or skips the malformed chunk according to implementation policy

#### Scenario: Requirement validation fails
- **WHEN** generation requirement validation fails before streaming begins
- **THEN** the system returns a sanitized JSON error without echoing secrets or internal validation details

### Requirement: Stream Gemini preflight diagnostics over SSE
The system SHALL NOT provide Gemini preflight diagnostics over SSE. Gemini preflight SHALL use the standalone JSON preflight request.

#### Scenario: Preflight diagnostic is requested
- **WHEN** the browser wants to test Gemini setup
- **THEN** it calls the standalone Gemini preflight request
- **AND** does not open a preflight SSE connection

#### Scenario: Report stream starts
- **WHEN** the browser starts report streaming
- **THEN** the stream does not run Gemini preflight diagnostics

### Requirement: Use POST-capable streaming for report rendering
The system SHALL support starting report rendering with a request body containing the transcript handoff and optional sanitized generation requirements.

#### Scenario: Browser starts report stream
- **WHEN** transcript fetch has returned a valid transcript handoff
- **THEN** the browser sends the handoff in the report stream request body
- **AND** includes non-empty generation requirements when the user provided them
- **AND** the backend responds with a streaming event response for rendering

#### Scenario: Transcript handoff is too large for a query string
- **WHEN** the transcript handoff would be large or sensitive
- **THEN** the browser does not put it in the URL query string

#### Scenario: Generation requirements are omitted
- **WHEN** the browser starts report streaming without generation requirements
- **THEN** the backend starts the existing report stream from the transcript handoff

#### Scenario: Generation requirements are invalid
- **WHEN** the report stream request includes generation requirements with an unsupported shape or excessive length
- **THEN** the backend rejects the request with a sanitized validation error before calling Gemini

