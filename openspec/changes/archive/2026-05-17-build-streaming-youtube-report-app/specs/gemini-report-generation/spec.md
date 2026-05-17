## ADDED Requirements

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
The system SHALL run a lightweight Gemini setup preflight when a report SSE stream starts, before sending any YouTube URL, transcript content, or report-generation prompt content to Gemini.

#### Scenario: Gemini preflight succeeds
- **WHEN** the report stream starts with configured Gemini credentials and an available model
- **THEN** the system sends a minimal provider setup-check prompt to Gemini
- **AND** continues to transcript acquisition only after the setup check succeeds

#### Scenario: Gemini API key is missing or invalid during preflight
- **WHEN** the setup check cannot authenticate with Gemini
- **THEN** the system reports a sanitized Gemini configuration error
- **AND** does not send transcript content to Gemini

#### Scenario: Gemini model or quota is unavailable during preflight
- **WHEN** Gemini rejects the setup check because the configured model is unavailable or quota or rate limits are exceeded
- **THEN** the system reports a sanitized Gemini provider error
- **AND** does not continue report generation

#### Scenario: Gemini setup preflight uses no user content
- **WHEN** the system performs the setup check
- **THEN** the prompt contains only a tiny diagnostic instruction and no YouTube URL, caption segment, transcript text, or report content

### Requirement: Build a Simplified Chinese structured summary prompt
The system SHALL send Gemini an English prompt that includes normalized transcript segments and requires a structured report written entirely in Simplified Chinese with title, subtitle, sections, and speaker-labeled summarized paragraphs.

#### Scenario: Prompt is created
- **WHEN** transcript segments are available
- **THEN** the system creates an English prompt that asks Gemini to summarize the transcript into Simplified Chinese speaker-labeled report paragraphs without directly displaying original transcript lines

### Requirement: Produce a validated report model
The system SHALL validate Gemini output into a report model containing a Simplified Chinese title, Simplified Chinese subtitle, ordered sections, and Simplified Chinese speaker-labeled summary paragraphs derived from transcript evidence.

#### Scenario: Structured output is valid
- **WHEN** Gemini returns output matching the report schema
- **THEN** the system emits a complete validated report

#### Scenario: Structured output is invalid
- **WHEN** Gemini returns malformed or schema-incompatible output
- **THEN** the system reports a generation error instead of rendering invalid report content as complete

#### Scenario: Output is not Chinese
- **WHEN** Gemini returns report title, subtitle, section, or paragraph content that is not in Chinese
- **THEN** the system reports a generation validation error instead of completing the report

#### Scenario: Output is not Simplified Chinese
- **WHEN** Gemini returns Traditional Chinese content in report title, subtitle, section, or paragraph content
- **THEN** the system reports a generation validation error instead of completing the report

#### Scenario: Output contains verbatim transcript dump
- **WHEN** Gemini output directly reproduces original transcript lines instead of summarizing them
- **THEN** the system reports a generation validation error instead of completing the report

#### Scenario: Output uses dialog-style summary paragraphs
- **WHEN** Gemini returns summary paragraphs with speaker or role labels such as `Jack:` or `旁白:`
- **THEN** the system accepts the paragraphs when the text after the label is Simplified Chinese summarized content rather than raw transcript text

### Requirement: Handle Gemini service failures
The system SHALL map Gemini quota, rate-limit, authentication, network, and server failures into user-visible generation errors.

#### Scenario: Gemini returns rate limit
- **WHEN** Gemini returns a quota or rate-limit response
- **THEN** the system reports that generation is temporarily unavailable due to Gemini limits
