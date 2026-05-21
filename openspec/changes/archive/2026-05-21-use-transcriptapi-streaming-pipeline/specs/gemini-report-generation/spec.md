## MODIFIED Requirements

### Requirement: Build a Simplified Chinese structured summary prompt
The system SHALL send Gemini an English prompt that includes transcript segments already fetched through the TranscriptAPI adapter and requires newline-delimited JSON report events whose display content is Simplified Chinese.

#### Scenario: Prompt is created
- **WHEN** transcript segments have been fetched, normalized, and accepted by transcript limits
- **THEN** the system creates an English prompt that asks Gemini to output NDJSON report events for Simplified Chinese title, section, and speaker-labeled summary paragraph content

#### Scenario: Transcript is unavailable
- **WHEN** transcript fetching or normalization fails
- **THEN** the system does not create a Gemini report-generation prompt

#### Scenario: Prompt defines chunk format
- **WHEN** the system creates the Gemini prompt
- **THEN** it instructs Gemini to output one JSON object per line
- **AND** it forbids Markdown fences, prose outside JSON lines, and raw transcript dumps

### Requirement: Produce a validated report model
The system SHALL parse Gemini output into streamable report content containing a Simplified Chinese title, Simplified Chinese subtitle, ordered sections, and Simplified Chinese speaker-labeled summary paragraphs, while applying only minimal shape validation needed to keep the UI stable.

#### Scenario: Title chunk is available
- **WHEN** Gemini outputs a complete NDJSON title line
- **THEN** the system validates the title event shape and emits a title SSE event before Gemini generation completes

#### Scenario: Section chunk is available
- **WHEN** Gemini outputs a complete NDJSON section line
- **THEN** the system validates the section event shape and emits a section SSE event before Gemini generation completes

#### Scenario: Paragraph chunk is available
- **WHEN** Gemini outputs a complete NDJSON paragraph line
- **THEN** the system validates the paragraph event shape and emits a speaker-labeled summary paragraph SSE event before Gemini generation completes

#### Scenario: Provider chunk splits a JSON line
- **WHEN** a Gemini stream chunk contains only part of a JSON line
- **THEN** the system buffers the partial line and waits for a newline before parsing

#### Scenario: Structured output is invalid
- **WHEN** Gemini returns malformed output that cannot be mapped to any safe report event
- **THEN** the system reports a generation error instead of rendering invalid report content as complete

#### Scenario: Strict language validation would block partial display
- **WHEN** partial Gemini output is displayable but has not yet passed strict Chinese, Simplified Chinese, or verbatim-transcript validation
- **THEN** the system may render the partial content
- **AND** still keeps provider errors and unsafe internal details out of the browser

## ADDED Requirements

### Requirement: Use NDJSON report chunks
The system SHALL use newline-delimited JSON as the Gemini streaming chunk contract for report content.

#### Scenario: Title event line
- **WHEN** Gemini emits `{"type":"title","title":"...","subtitle":"..."}`
- **THEN** the backend maps it to the typed title stream event

#### Scenario: Section event line
- **WHEN** Gemini emits `{"type":"section","id":"...","heading":"..."}`
- **THEN** the backend maps it to the typed section stream event

#### Scenario: Paragraph event line
- **WHEN** Gemini emits `{"type":"paragraph","sectionId":"...","speaker":"...","text":"..."}`
- **THEN** the backend maps it to the typed summary paragraph stream event

