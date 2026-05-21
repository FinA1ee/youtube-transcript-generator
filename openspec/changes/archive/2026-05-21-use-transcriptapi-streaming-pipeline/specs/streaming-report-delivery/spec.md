## MODIFIED Requirements

### Requirement: Stream report generation over SSE
The system SHALL provide an SSE endpoint that accepts a report generation request and streams typed report events to the browser while backend work is in progress. The report-generation SSE endpoint SHALL NOT run Gemini preflight before transcript acquisition and SHALL NOT expose transcript fetching as a separate frontend streaming workflow.

#### Scenario: SSE generation starts
- **WHEN** the browser opens the report SSE stream with a valid generation request
- **THEN** the system starts the report pipeline and emits progress events before completion
- **AND** does not run Gemini preflight before transcript fetching

#### Scenario: Invalid SSE request is submitted
- **WHEN** the browser opens the report SSE stream with an invalid generation request
- **THEN** the system emits an error event and closes the stream without calling TranscriptAPI or Gemini

#### Scenario: Transcript fetching occurs
- **WHEN** the backend is fetching, normalizing, or checking transcript content
- **THEN** the report SSE stream may emit high-level progress state events
- **AND** does not stream raw transcript lines as the frontend rendering content

### Requirement: Emit typed stream events
The system SHALL emit JSON events with explicit event types for progress, partial Simplified Chinese report content, speaker-labeled summary paragraphs, errors, and completion.

#### Scenario: Partial report is generated
- **WHEN** the backend parses a valid NDJSON report line from Gemini after transcript acquisition
- **THEN** the system immediately emits the corresponding typed SSE event that the browser can render incrementally

#### Scenario: Generation state changes
- **WHEN** the backend moves through validation, transcript fetching, transcript preparation, Gemini generation, streaming, completion, retry, or error states
- **THEN** the system emits typed progress or state events that the browser can display as user-facing notifications

#### Scenario: Generation completes
- **WHEN** Gemini generation finishes and the backend has emitted all usable report content
- **THEN** the system emits a complete event for the current report stream

### Requirement: Stream Gemini preflight diagnostics over SSE
The system SHALL provide a dedicated Gemini preflight SSE endpoint that streams diagnostic events independently from report generation.

#### Scenario: Preflight diagnostic stream starts
- **WHEN** the browser opens the Gemini preflight SSE stream
- **THEN** the system emits a checking state and runs Gemini preflight
- **AND** does not call TranscriptAPI or report pipeline code

#### Scenario: Preflight diagnostic stream fails
- **WHEN** Gemini preflight fails
- **THEN** the system emits a sanitized diagnostic error event
- **AND** closes the preflight stream without changing report-generation stream state
