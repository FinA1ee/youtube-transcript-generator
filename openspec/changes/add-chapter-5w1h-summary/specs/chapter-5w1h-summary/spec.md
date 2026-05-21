## ADDED Requirements

### Requirement: Request chapter 5W1H summaries from server context
The system SHALL provide an on-demand chapter 5W1H summary request that uses server-saved report generation context and SHALL NOT require the browser to submit the full generated article, transcript, or report content.

#### Scenario: Chapter summary is requested
- **WHEN** the browser requests a 5W1H summary with a valid report context id and chapter id
- **THEN** the backend looks up the saved generation context on the server
- **AND** generates the summary from the full video context and selected chapter context

#### Scenario: Browser omits full article content
- **WHEN** the browser requests a chapter 5W1H summary
- **THEN** the request body contains only lightweight identifiers and control metadata
- **AND** does not include the full generated article, raw transcript, or all report paragraphs

#### Scenario: Saved context is missing
- **WHEN** the requested report context id is unknown, expired, or no longer available
- **THEN** the backend returns a sanitized context-unavailable error without calling Gemini

#### Scenario: Chapter id is invalid
- **WHEN** the requested chapter id does not exist in the saved report context
- **THEN** the backend returns a sanitized validation error without calling Gemini

### Requirement: Return fixed structured 5W1H data
The system SHALL return chapter 5W1H summaries as structured data with fixed Who, What, When, Where, Why, and How fields.

#### Scenario: Structured summary succeeds
- **WHEN** Gemini returns a valid chapter 5W1H result
- **THEN** the backend returns JSON containing `who`, `what`, `when`, `where`, `why`, and `how` fields for the selected chapter

#### Scenario: Information is unavailable
- **WHEN** the video and chapter context do not contain enough information for a 5W1H field
- **THEN** the returned structured field uses a stable unknown or unavailable value instead of inventing details

#### Scenario: Structured summary is invalid
- **WHEN** Gemini returns malformed or incomplete 5W1H data
- **THEN** the backend returns a sanitized generation validation error instead of rendering invalid content

### Requirement: Scope 5W1H summaries to generated chapters
The system SHALL treat each top-level generated chapter as an addressable unit for chapter 5W1H summaries.

#### Scenario: Top-level chapter is available
- **WHEN** a generated report contains a level-1 heading
- **THEN** the system treats that heading and its descendant content before the next level-1 heading as a chapter

#### Scenario: Nested content belongs to a chapter
- **WHEN** a chapter contains level-2 or level-3 headings and linked paragraphs
- **THEN** the 5W1H summary uses that nested chapter context along with the full video context
