## MODIFIED Requirements

### Requirement: Emit typed stream events
The system SHALL emit JSON events with explicit event types for report-generation progress, report context availability, partial Simplified Chinese report title, hierarchical chapter headings, speaker-labeled summary paragraphs, errors, and completion.

#### Scenario: Report context is created
- **WHEN** the backend starts report generation from a verified transcript handoff
- **THEN** the system emits a typed event that gives the browser a report context id for later chapter summary requests
- **AND** the event does not expose raw transcript text, generated report content, secrets, or provider payloads

#### Scenario: Title is generated
- **WHEN** the backend parses a valid Gemini title chunk
- **THEN** the system immediately emits the corresponding typed title stream event that the browser can render incrementally

#### Scenario: Heading is generated
- **WHEN** the backend parses a valid Gemini heading chunk
- **THEN** the system immediately emits the corresponding typed heading stream event including heading level
- **AND** level-1 headings are addressable as chapters for later 5W1H requests

#### Scenario: Partial report paragraph is generated
- **WHEN** the backend parses a valid Gemini paragraph chunk after transcript handoff verification
- **THEN** the system immediately emits the corresponding typed paragraph stream event that the browser can render incrementally

#### Scenario: Generation state changes
- **WHEN** the backend moves through Gemini generation, streaming, completion, retry, or error states
- **THEN** the system emits typed progress or state events that the browser can display as user-facing notifications

#### Scenario: Generation completes
- **WHEN** Gemini generation finishes and the backend has emitted all usable report content
- **THEN** the system emits a complete event for the current report stream

## ADDED Requirements

### Requirement: Save bounded report generation context
The system SHALL save bounded server-side report generation context for later chapter 5W1H summary requests.

#### Scenario: Report generation starts
- **WHEN** a report stream starts from a verified transcript handoff
- **THEN** the backend creates a report context id and stores the transcript context, generation requirements, and accumulating report structure server-side

#### Scenario: Report generation receives chapter content
- **WHEN** title, heading, or paragraph events are emitted during report generation
- **THEN** the backend updates the saved report context so level-1 chapters and their descendant content can be summarized later

#### Scenario: Context lifetime is bounded
- **WHEN** report contexts exceed configured age or count limits
- **THEN** the backend expires old contexts and returns a sanitized context-unavailable error for later requests to expired contexts

### Requirement: Accept lightweight chapter 5W1H requests
The system SHALL accept chapter 5W1H summary requests using only lightweight identifiers and SHALL NOT require the browser to send the full generated article content.

#### Scenario: Browser requests chapter 5W1H
- **WHEN** the browser posts a report context id and chapter id to the chapter summary endpoint
- **THEN** the backend validates the identifiers and loads the server-saved report generation context

#### Scenario: Browser sends full article content
- **WHEN** a chapter 5W1H request includes generated article content, raw transcript lines, or full report paragraphs
- **THEN** the backend ignores or rejects those fields and uses only the server-saved context

#### Scenario: Request validation fails
- **WHEN** a chapter 5W1H request has missing, malformed, expired, or unknown identifiers
- **THEN** the backend returns a sanitized JSON error before calling Gemini
