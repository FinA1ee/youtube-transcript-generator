## MODIFIED Requirements

### Requirement: Stream report generation over SSE
The system SHALL provide an SSE endpoint that accepts a report generation request and streams typed report events to the browser while backend work is in progress. The report-generation SSE endpoint SHALL NOT run Gemini preflight before transcript acquisition.

#### Scenario: SSE generation starts
- **WHEN** the browser opens the report SSE stream with a valid generation request
- **THEN** the system starts the report pipeline and emits progress events before completion
- **AND** does not run Gemini preflight before caption fetching

#### Scenario: Invalid SSE request is submitted
- **WHEN** the browser opens the report SSE stream with an invalid generation request
- **THEN** the system emits an error event and closes the stream without calling YouTube or Gemini

### Requirement: Emit typed stream events
The system SHALL emit JSON events with explicit event types for progress, partial Simplified Chinese report content, speaker-labeled summary paragraphs, errors, and completion.

#### Scenario: Partial report is generated
- **WHEN** the backend receives or derives partial report content
- **THEN** the system emits typed Simplified Chinese speaker-labeled summary events that the browser can render incrementally

#### Scenario: Generation state changes
- **WHEN** the backend moves through validation, caption fetching, transcript preparation, Gemini generation, streaming, completion, retry, or error states
- **THEN** the system emits typed progress or state events that the browser can display as user-facing notifications

#### Scenario: Generation completes
- **WHEN** the report model is fully validated
- **THEN** the system emits a complete event containing or referencing the final report state

## ADDED Requirements

### Requirement: Stream Gemini preflight diagnostics over SSE
The system SHALL provide a dedicated Gemini preflight SSE endpoint that streams diagnostic events independently from report generation.

#### Scenario: Preflight diagnostic stream starts
- **WHEN** the browser opens the Gemini preflight SSE stream
- **THEN** the system emits a checking state and runs Gemini preflight
- **AND** does not call YouTube or report pipeline code

#### Scenario: Preflight diagnostic stream fails
- **WHEN** Gemini preflight fails
- **THEN** the system emits a sanitized diagnostic error event
- **AND** closes the preflight stream without changing report-generation stream state
