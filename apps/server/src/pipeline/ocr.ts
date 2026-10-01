import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { config } from "../config.js";
import { OcrError } from "../errors.js";
import type { OcrStageUsage } from "../types.js";

export interface StatementFile {
  filename: string;
  base64: string;
}

export interface OcrPage {
  filename: string;
  text: string;
}

export interface OcrOutcome {
  pages: OcrPage[];
  warnings: string[];
  usage: OcrStageUsage;
}

const client = new DocumentProcessorServiceClient({
  credentials: config.googleServiceAccountKeyRaw ? JSON.parse(config.googleServiceAccountKeyRaw) : undefined,
  keyFilename: config.googleServiceAccountKeyRaw ? undefined : config.googleServiceAccountKeyPath,
});

// The synchronous processDocument API tops out around 15 pages per document
// (higher with imagelessMode, but still bounded) — fine for ordinary monthly
// bank statements. A statement beyond that limit surfaces as an OcrError
// rather than being silently truncated; the batch/async GCS-based API would
// be the fix if that's ever actually hit.
export async function runOcr(files: StatementFile[]): Promise<OcrOutcome> {
  const warnings: string[] = [];
  const usage: OcrStageUsage = { pages: 0 };

  try {
    const pages = await Promise.all(
      files.map(async (file): Promise<OcrPage> => {
        const [response] = await client.processDocument({
          name: config.documentAiProcessorName,
          rawDocument: { content: file.base64, mimeType: "application/pdf" },
        });

        usage.pages += response.document?.pages?.length ?? 0;

        const text = response.document?.text ?? "";
        if (text.trim() === "") {
          warnings.push(`${file.filename}: OCR produced no readable text — possibly a blank, corrupted, or unsupported PDF.`);
        }
        return { filename: file.filename, text };
      }),
    );

    return { pages, warnings, usage };
  } catch (err) {
    throw new OcrError(`Document AI OCR failed: ${(err as Error).message}`, { cause: err });
  }
}
