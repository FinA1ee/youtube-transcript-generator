## MODIFIED Requirements

### Requirement: Render report input and status
The system SHALL render an English-language React UI where users can submit a YouTube URL, optionally provide natural language generation requirements, fetch transcript readiness, generate a streamed report, clearly understand current status, and optionally test Gemini setup in diagnostic mode without navigating away.

#### Scenario: Page loads
- **WHEN** a user opens the application root page
- **THEN** the system displays a themed React interface with a YouTube URL input, an optional generation requirements input, a submit control, a prominent status area, and an empty report area

#### Scenario: Generation requirements are optional
- **WHEN** a user submits a YouTube URL without generation requirements
- **THEN** the page starts the existing transcript fetch and report generation workflow without requiring additional input

#### Scenario: User enters generation requirements
- **WHEN** a user enters natural language generation requirements before submitting
- **THEN** the page keeps the requirements associated with the current report request for stream startup and retry
- **AND** the requirements can describe task type, output style, target audience, or constraints

#### Scenario: Generation status updates
- **WHEN** the browser receives report stream events or standalone request results
- **THEN** the page updates a visually prominent English status banner for the current step

#### Scenario: Submit starts transcript fetch
- **WHEN** a user submits a YouTube URL
- **THEN** the page immediately displays an English transcript-fetching notification
- **AND** sends a standalone transcript fetch request before opening the report stream

#### Scenario: Transcript fetch succeeds
- **WHEN** the standalone transcript fetch request returns a valid transcript handoff
- **THEN** the page starts the report rendering stream with the transcript handoff and any non-empty generation requirements

#### Scenario: Backend state changes
- **WHEN** standalone transcript fetch or report stream state changes occur
- **THEN** the page displays concise English loading, completion, cancellation, retry, or error notifications for the current step

#### Scenario: Caption kind is known
- **WHEN** the selected caption track is manually authored or auto-generated
- **THEN** the page displays an English label indicating whether captions are manual or auto-generated

#### Scenario: User clears current content
- **WHEN** the user clicks the clear-content or new-link control
- **THEN** the page closes any active stream, clears current report content and status derived from that report, hides report-only controls, and focuses the URL input
