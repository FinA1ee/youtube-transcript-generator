## MODIFIED Requirements

### Requirement: Render streamed Simplified Chinese summary structure
The system SHALL progressively render Simplified Chinese report title, subtitle, chapter-based hierarchical headings, and speaker-labeled summary paragraphs as typed stream events arrive.

#### Scenario: Title and subtitle arrive
- **WHEN** the browser receives title and subtitle report events
- **THEN** the page creates report header elements immediately
- **AND** renders their Simplified Chinese text incrementally through the stream renderer

#### Scenario: Chapter heading content arrives
- **WHEN** the browser receives a heading event with level 1
- **THEN** the page renders the heading as a report chapter title in report order
- **AND** renders heading text incrementally through the stream renderer
- **AND** prepares chapter-level actions when the report context id is available

#### Scenario: Nested heading content arrives
- **WHEN** the browser receives a heading event with level 2 or 3
- **THEN** the page renders the heading under the current chapter with visual hierarchy equivalent to h2 or h3
- **AND** renders heading text incrementally through the stream renderer

#### Scenario: Summary paragraph arrives
- **WHEN** the browser receives summary paragraph events linked to a heading
- **THEN** the page renders each paragraph as a speaker-labeled Simplified Chinese summary of transcript content rather than original transcript lines

## ADDED Requirements

### Requirement: Render chapter 5W1H controls
The system SHALL render a `[5W1H]` action next to each generated chapter title once that chapter can be summarized from server context.

#### Scenario: Chapter action is available
- **WHEN** a level-1 chapter heading is visible and the report context id is available
- **THEN** the page displays a `[5W1H]` button next to the chapter title

#### Scenario: Chapter summary request starts
- **WHEN** the user clicks a chapter `[5W1H]` button
- **THEN** the page sends a lightweight request containing the report context id and chapter id
- **AND** does not include the full generated article, transcript, or all report paragraphs

#### Scenario: Chapter summary is loading
- **WHEN** a chapter 5W1H request is in progress
- **THEN** the page shows a loading state for that chapter action without blocking the primary report content

### Requirement: Render chapter 5W1H summaries in fixed format
The system SHALL render returned chapter 5W1H summaries in a fixed format with Who, What, When, Where, Why, and How fields.

#### Scenario: Chapter summary is returned
- **WHEN** the backend returns structured 5W1H data for a chapter
- **THEN** the page displays six labeled rows for Who, What, When, Where, Why, and How near the selected chapter

#### Scenario: Chapter summary fails
- **WHEN** the backend returns a sanitized error for a chapter 5W1H request
- **THEN** the page displays the chapter-specific error without removing existing report content

#### Scenario: Chapter summary is requested again
- **WHEN** the user clicks `[5W1H]` for a chapter that already has a summary
- **THEN** the page reuses the existing displayed summary or refreshes it without duplicating fixed-format rows
