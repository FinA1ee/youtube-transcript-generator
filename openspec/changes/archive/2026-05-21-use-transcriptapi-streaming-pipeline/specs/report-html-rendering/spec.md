## MODIFIED Requirements

### Requirement: Render report input and status
The system SHALL render an English-language Hono/Worker-served HTML page where users can submit a YouTube URL, test Gemini setup separately, and see current generation or diagnostic status without navigating away.

#### Scenario: Page loads
- **WHEN** a user opens the application root page
- **THEN** the Hono app displays a YouTube URL input, a submit control, a Gemini test control, and an empty report area

#### Scenario: Generation status updates
- **WHEN** the browser receives report progress events
- **THEN** the page updates the visible English report status for the current generation step

#### Scenario: Submit starts state notifications
- **WHEN** a user submits a YouTube URL
- **THEN** the page immediately displays a generation state notification before report content is available

#### Scenario: Backend state changes
- **WHEN** the browser receives report state or progress events for validation, transcript fetching, transcript preparation, Gemini generation, streaming, completion, retry, or errors
- **THEN** the page displays a simple English loading state before report content renders and concise English completion, cancellation, retry, or error notifications afterward

#### Scenario: Caption kind is known
- **WHEN** the selected caption track kind is known to be manually authored or auto-generated
- **THEN** the page displays an English label indicating whether captions are manual or auto-generated

#### Scenario: Caption kind is unknown
- **WHEN** the transcript adapter cannot determine whether captions are manual or auto-generated
- **THEN** the page does not invent a caption kind

### Requirement: Render streamed Simplified Chinese summary structure
The system SHALL progressively render Simplified Chinese report title, subtitle, sections, and speaker-labeled summary paragraphs as typed stream events arrive.

#### Scenario: Title and subtitle arrive
- **WHEN** the browser receives title and subtitle report events
- **THEN** the page renders Simplified Chinese title and subtitle content immediately in the report header area

#### Scenario: Section content arrives
- **WHEN** the browser receives section report events
- **THEN** the page appends or updates Simplified Chinese section headings immediately in report order

#### Scenario: Summary paragraph arrives
- **WHEN** the browser receives summary paragraph events
- **THEN** the page renders each paragraph as a speaker-labeled Simplified Chinese summary of transcript content rather than original transcript lines

#### Scenario: Partial summary content arrives
- **WHEN** the browser receives partial Gemini-derived report content before generation is complete
- **THEN** the page renders the available content without waiting for the complete report

### Requirement: Use typewriter-style incremental rendering
The system SHALL display streamed report text with a typewriter-style effect as content arrives, without waiting for the complete report.

#### Scenario: First report content arrives
- **WHEN** the browser receives the first summary paragraph event
- **THEN** the page begins displaying that paragraph incrementally before receiving a complete event

#### Scenario: Stream arrives faster than rendering
- **WHEN** report events arrive faster than the typewriter effect can display them
- **THEN** the page queues the content and renders it in order without dropping report content

#### Scenario: Reduced motion is preferred
- **WHEN** the user environment indicates reduced motion preference
- **THEN** the page disables or shortens the typewriter effect while still rendering streamed content incrementally

#### Scenario: User skips animation
- **WHEN** the user clicks the skip animation control
- **THEN** the page immediately renders queued report content and disables the typewriter effect for the current report

