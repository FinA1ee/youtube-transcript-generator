# youtube-input Specification

## Purpose
TBD - created by archiving change build-streaming-youtube-report-app. Update Purpose after archive.
## Requirements
### Requirement: Accept YouTube video URLs
The system SHALL accept user-submitted YouTube video URLs from the web UI and normalize supported URL forms into a canonical video identifier before report generation starts.

#### Scenario: Standard watch URL is accepted
- **WHEN** a user submits `https://www.youtube.com/watch?v=VIDEO_ID`
- **THEN** the system accepts the input and extracts `VIDEO_ID` as the canonical video identifier

#### Scenario: Short URL is accepted
- **WHEN** a user submits `https://youtu.be/VIDEO_ID`
- **THEN** the system accepts the input and extracts `VIDEO_ID` as the canonical video identifier

### Requirement: Reject unsupported input
The system SHALL reject non-YouTube URLs, malformed URLs, missing video identifiers, and unsupported YouTube URL forms before opening a transcript or Gemini request.

#### Scenario: Non-YouTube URL is rejected
- **WHEN** a user submits a URL whose host is not a supported YouTube host
- **THEN** the system reports an input validation error without calling YouTube or Gemini

#### Scenario: Missing video identifier is rejected
- **WHEN** a user submits a supported YouTube host URL without a video identifier
- **THEN** the system reports an input validation error without calling YouTube or Gemini

### Requirement: Preserve safe request metadata
The system SHALL create a report generation request containing the canonical video identifier and safe request options only, without storing API keys, cookies, or raw credentials in the request payload.

#### Scenario: Request metadata is built
- **WHEN** a valid YouTube URL is submitted
- **THEN** the system creates a request with the canonical video identifier and no secret values

