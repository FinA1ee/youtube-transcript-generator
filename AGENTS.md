# Repository Guidelines

## Project Structure & Module Organization

This repository is a Node.js project intended for deployment on Cloudflare Workers. Keep the layout predictable as implementation starts:

- `src/` for Worker application code and request handlers.
- `tests/unit/` for unit tests that mirror `src/` module names.
- `tests/e2e/` for end-to-end tests that exercise deployed or locally served Worker behavior.
- `assets/` for static samples, prompts, fixtures, or media metadata.
- `docs/` for design notes, API decisions, and user-facing setup notes.

For a YouTube subtitle/transcript generator, isolate external service access in dedicated modules, for example `src/youtube/`, `src/transcripts/`, `src/llm/`, and `src/worker/`, rather than mixing API calls into request handlers.

## Build, Test, and Development Commands

No package scripts are present yet. When adding tooling, document canonical commands in `README.md` and keep them stable. Expected command roles:

- `npm install`: install project dependencies.
- `npm run dev`: run the Cloudflare Worker locally, typically through Wrangler.
- `npm test`: run unit and e2e tests.
- `npm run test:unit`: run unit tests only.
- `npm run test:e2e`: run end-to-end tests only.
- `npm run lint` / `npm run format`: check and format source files.
- `npm run deploy`: deploy the Worker to Cloudflare after tests pass.

Prefer checked-in scripts over ad hoc commands so contributors and agents run the same workflow.

## Coding Style & Naming Conventions

Follow the formatter and linter configured by the project once added. Use 2-space indentation for JavaScript/TypeScript. Prefer TypeScript for Worker code when practical. Use descriptive names such as `fetchTranscript`, `parseCaptionTracks`, `youtubeClient`, and `geminiClient`. Keep modules focused on one responsibility and avoid embedding credentials, URLs, prompts, or test fixtures directly in business logic.

## Testing Guidelines

Write tests before production code. Every feature should start with unit tests for core logic and e2e tests for important Worker routes or user workflows. Place tests under `tests/unit/` or `tests/e2e/` and name them after the unit or route under test, for example `tests/unit/transcript-parser.test.ts` or `tests/e2e/generate-subtitles.test.ts`. Prefer fixture-based tests for subtitle parsing and mock network calls to YouTube, Gemini, and other third-party APIs. Run `npm test` before opening a pull request.

## Commit & Pull Request Guidelines

There is no existing commit history, so use concise, imperative commit messages such as `Add transcript parser` or `Add Worker e2e tests`. Push work to GitHub through feature branches. Pull requests should include a short summary, test results, linked issues when applicable, and screenshots or terminal output for user-visible CLI/UI changes. Call out new environment variables, Cloudflare settings, external API permissions, or migration steps explicitly.

## Security & Configuration Tips

Never commit API keys, cookies, OAuth tokens, downloaded private transcripts, Cloudflare credentials, Gemini AI Studio keys, or `.env` files. Use Cloudflare Worker secrets for deployment configuration and local `.dev.vars` or `.env` files that remain ignored by Git. Provide `.env.example` for required variable names only. LLM requests must use the free Gemini AI Studio API path unless the project owner explicitly approves another provider. Keep sample media or transcript fixtures small and license-safe.
