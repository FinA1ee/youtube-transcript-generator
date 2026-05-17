import { AppError, Report, Transcript } from "../shared/types";

const SIMPLIFIED_ONLY_HINTS = /[後臺與個們說這為會來時國]/;
const CJK_PATTERN = /[\u3400-\u9fff]/;

export function validateReport(report: Report, transcript: Transcript): Report {
  const allText = [
    report.title,
    report.subtitle,
    ...report.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs.map((paragraph) => paragraph.text)
    ])
  ];

  if (report.sections.length === 0 || allText.some((text) => text.trim().length === 0)) {
    throw new AppError("generation_validation_error", "Generated report is incomplete.", 502);
  }

  if (!allText.every((text) => CJK_PATTERN.test(text))) {
    throw new AppError("generation_validation_error", "Generated report must be Chinese.", 502);
  }

  if (allText.some((text) => SIMPLIFIED_ONLY_HINTS.test(text))) {
    throw new AppError(
      "generation_validation_error",
      "Generated report must use Simplified Chinese.",
      502
    );
  }

  const transcriptLines = transcript.segments
    .map((segment) => segment.text.trim())
    .filter((text) => text.length >= 12);

  for (const paragraph of report.sections.flatMap((section) => section.paragraphs)) {
    if (!paragraph.text.includes(":") && !paragraph.text.includes("：")) {
      throw new AppError(
        "generation_validation_error",
        "Generated paragraphs must use speaker labels.",
        502
      );
    }

    if (transcriptLines.some((line) => paragraph.text.includes(line))) {
      throw new AppError(
        "generation_validation_error",
        "Generated report repeats transcript text too directly.",
        502
      );
    }
  }

  return report;
}
