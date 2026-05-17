## ADDED Requirements

### Requirement: Stream report generation over SSE
The system SHALL provide an SSE endpoint that accepts a report generation request and streams typed report events to the browser while backend work is in progress.

#### Scenario: SSE generation starts
- **WHEN** the browser opens the report SSE stream with a valid generation request
- **THEN** the system starts the report pipeline and emits progress events before completion

#### Scenario: Invalid SSE request is submitted
- **WHEN** the browser opens the report SSE stream with an invalid generation request
- **THEN** the system emits an error event and closes the stream without calling YouTube or Gemini

#### Scenario: Gemini setup check fails when SSE generation starts
- **WHEN** the browser opens the report SSE stream and Gemini setup preflight fails
- **THEN** the system emits a sanitized provider error event
- **AND** closes the stream without fetching captions or sending transcript content to Gemini

### Requirement: Emit typed stream events
The system SHALL emit JSON events with explicit event types for progress, partial Simplified Chinese report content, speaker-labeled summary paragraphs, errors, and completion.

#### Scenario: Partial report is generated
- **WHEN** the backend receives or derives partial report content
- **THEN** the system emits typed Simplified Chinese speaker-labeled summary events that the browser can render incrementally

#### Scenario: Generation state changes
- **WHEN** the backend moves through validation, Gemini setup preflight, caption fetching, transcript preparation, Gemini generation, streaming, completion, retry, or error states
- **THEN** the system emits typed progress or state events that the browser can display as user-facing notifications

#### Scenario: Generation completes
- **WHEN** the report model is fully validated
- **THEN** the system emits a complete event containing or referencing the final report state

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
The system SHALL never send Gemini API keys, Cloudflare credentials, internal stack traces, or raw provider error payloads to the browser over the report stream.

#### Scenario: Provider error occurs
- **WHEN** an upstream provider fails with a detailed internal error
- **THEN** the system emits a sanitized user-visible error event
