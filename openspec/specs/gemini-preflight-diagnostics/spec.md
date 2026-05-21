# gemini-preflight-diagnostics Specification

## Purpose
TBD - created by archiving change separate-gemini-preflight-check. Update Purpose after archive.
## Requirements
### Requirement: User-triggered Gemini preflight
The system SHALL provide a separate user-triggered control for testing whether the configured Gemini API call is valid through a standalone JSON server request.

#### Scenario: User starts preflight
- **WHEN** the user clicks the Gemini test button
- **THEN** the browser sends a dedicated Gemini preflight request to the server
- **AND** does not require or send a YouTube URL

#### Scenario: Preflight uses no user content
- **WHEN** the backend runs the Gemini preflight
- **THEN** it sends only the tiny setup-check prompt
- **AND** it does not send any YouTube URL, caption segment, transcript text, report prompt, or report content

### Requirement: Stream Gemini preflight result
The system SHALL NOT stream Gemini preflight progress or terminal result over SSE. It SHALL return the Gemini preflight result as a standalone JSON response.

#### Scenario: Preflight succeeds
- **WHEN** Gemini accepts the setup-check call and returns the expected diagnostic output
- **THEN** the JSON response reports success
- **AND** the browser shows an English success notification

#### Scenario: Preflight fails
- **WHEN** Gemini authentication, quota, rate-limit, model availability, network, service, or output validation fails during preflight
- **THEN** the JSON response contains a sanitized error
- **AND** the browser shows an English error notification

#### Scenario: Preflight request completes
- **WHEN** the preflight request returns success or error
- **THEN** the browser restores the test button to an idle state

### Requirement: Keep preflight diagnostics separate from report rendering
The system SHALL keep Gemini preflight diagnostic results out of the report rendering area.

#### Scenario: Preflight fails with an existing report visible
- **WHEN** a Gemini preflight error occurs while report content is already visible
- **THEN** the browser preserves existing report content
- **AND** updates only the diagnostic status or notification area

#### Scenario: Preflight succeeds before report generation
- **WHEN** the Gemini preflight succeeds before the user submits a YouTube URL
- **THEN** the browser displays the diagnostic success
- **AND** does not create report title, section, paragraph, or caption elements

