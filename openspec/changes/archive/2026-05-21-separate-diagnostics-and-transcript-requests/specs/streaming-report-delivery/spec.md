## MODIFIED Requirements

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
The system SHALL emit JSON events with explicit event types for report-generation progress, partial Simplified Chinese report content, speaker-labeled summary paragraphs, errors, and completion.

#### Scenario: Partial report is generated
- **WHEN** the backend parses a valid Gemini report chunk after transcript handoff verification
- **THEN** the system immediately emits the corresponding typed stream event that the browser can render incrementally

#### Scenario: Generation state changes
- **WHEN** the backend moves through Gemini generation, streaming, completion, retry, or error states
- **THEN** the system emits typed progress or state events that the browser can display as user-facing notifications
- **AND** it does not emit transcript-fetch progress events

#### Scenario: Generation completes
- **WHEN** Gemini generation finishes and the backend has emitted all usable report content
- **THEN** the system emits a complete event for the current report stream

### Requirement: Stream Gemini preflight diagnostics over SSE
The system SHALL NOT provide Gemini preflight diagnostics over SSE. Gemini preflight SHALL use the standalone JSON preflight request.

#### Scenario: Preflight diagnostic is requested
- **WHEN** the browser wants to test Gemini setup
- **THEN** it calls the standalone Gemini preflight request
- **AND** does not open a preflight SSE connection

#### Scenario: Report stream starts
- **WHEN** the browser starts report streaming
- **THEN** the stream does not run Gemini preflight diagnostics

## ADDED Requirements

### Requirement: Use POST-capable streaming for report rendering
The system SHALL support starting report rendering with a request body containing the transcript handoff.

#### Scenario: Browser starts report stream
- **WHEN** transcript fetch has returned a valid transcript handoff
- **THEN** the browser sends the handoff in the report stream request body
- **AND** the backend responds with a streaming event response for rendering

#### Scenario: Transcript handoff is too large for a query string
- **WHEN** the transcript handoff would be large or sensitive
- **THEN** the browser does not put it in the URL query string

