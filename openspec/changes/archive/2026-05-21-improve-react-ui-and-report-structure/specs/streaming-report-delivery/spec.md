## MODIFIED Requirements

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

### Requirement: Protect the stream from secret leakage
The system SHALL never send Gemini API keys, TranscriptAPI keys, transcript token secrets, Cloudflare credentials, internal stack traces, or raw provider error payloads to the browser over the report stream.

#### Scenario: Provider error occurs
- **WHEN** an upstream provider fails with a detailed internal error
- **THEN** the system emits a sanitized user-visible error event

#### Scenario: Heading or title chunk is malformed
- **WHEN** Gemini returns malformed heading or title output
- **THEN** the system emits a sanitized generation error or skips the malformed chunk according to implementation policy

