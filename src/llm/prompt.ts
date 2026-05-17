import { Transcript } from "../shared/types";

export const REPORT_PROMPT_TEMPLATE = `You are a video report writer.

Create a structured report from the provided YouTube caption segments.

Output language:
- The report content must be written in Simplified Chinese.
- Proper names may stay in their original form when the transcript provides them.

Output style:
- Do not output the original transcript.
- Do not list raw subtitle lines.
- Summarize the content into coherent report paragraphs.
- Each paragraph should use a dialog-style label when possible, such as "Jack: <Simplified Chinese summary>".
- If the speaker is unknown, use a neutral Chinese label such as "旁白:" or "未知发言者:".
- The text after the label must be a summary, not a direct quote.
- Do not invent speaker names. Only use a name when the transcript provides enough evidence.

Streaming output format:
- Return newline-delimited JSON only.
- Do not use Markdown fences.
- Do not write prose before or after the JSON lines.
- Emit one complete JSON object per line.
- Use these event shapes exactly:
  {"type":"title","title":"简体中文标题","subtitle":"简体中文副标题"}
  {"type":"section","id":"s1","heading":"简体中文章节标题"}
  {"type":"paragraph","sectionId":"s1","speaker":"旁白","text":"简体中文总结段落"}
- Emit the title line first.
- Emit each section line before its paragraph lines.
- Use stable section ids like "s1", "s2", "s3".

Caption segments:
{{TRANSCRIPT_SEGMENTS_JSON}}`;

export function buildReportPrompt(transcript: Transcript): string {
  const segments = transcript.segments.map((segment) => ({
    startMs: segment.startMs,
    endMs: segment.endMs,
    text: segment.text,
    speaker: segment.speaker,
    language: segment.language,
    captionKind: segment.captionKind
  }));

  return REPORT_PROMPT_TEMPLATE.replace("{{TRANSCRIPT_SEGMENTS_JSON}}", JSON.stringify(segments));
}
