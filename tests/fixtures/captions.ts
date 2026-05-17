import { CaptionTrack, Report, Transcript } from "../../src/shared/types";

export const manualTrack: CaptionTrack = {
  baseUrl: "https://example.test/manual.xml",
  languageCode: "en",
  name: "English",
  kind: "manual",
  isDefault: true
};

export const autoTrack: CaptionTrack = {
  baseUrl: "https://example.test/auto.xml",
  languageCode: "en",
  name: "English auto-generated",
  kind: "auto_generated",
  isDefault: false
};

export const captionXml = `<transcript>
  <text start="0" dur="2.5">Hello and welcome to the product discussion.</text>
  <text start="2.5" dur="3">Jack explains the goal and expected outcome.</text>
</transcript>`;

export const transcript: Transcript = {
  videoId: "abc123XYZ",
  language: "en",
  captionKind: "manual",
  durationSeconds: 320,
  segments: [
    {
      startMs: 0,
      endMs: 2500,
      text: "Hello and welcome to the product discussion.",
      language: "en",
      captionKind: "manual"
    },
    {
      startMs: 2500,
      endMs: 5500,
      text: "Jack explains the goal and expected outcome.",
      language: "en",
      captionKind: "manual"
    }
  ]
};

export const report: Report = {
  title: "产品讨论总结",
  subtitle: "本视频概述了产品目标和预期结果。",
  captionKind: "manual",
  sections: [
    {
      id: "section-1",
      heading: "开场与目标",
      paragraphs: [
        {
          id: "p-1",
          text: "Jack: 这一段总结了产品讨论的背景、目标以及后续希望达成的结果。",
          sourceRange: { startMs: 0, endMs: 5500 }
        }
      ]
    }
  ]
};
