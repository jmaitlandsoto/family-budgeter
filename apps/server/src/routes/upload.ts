import type { FastifyInstance } from "fastify";
import type { MultipartFields } from "@fastify/multipart";
import { aggregate } from "../pipeline/aggregate.js";
import { categorizeTransactions } from "../pipeline/categorize.js";
import { extractTransactions, type StatementFile } from "../pipeline/extractTransactions.js";
import { verifyExtraction } from "../pipeline/verifyExtraction.js";
import { writeSheet, type DriveTarget } from "../pipeline/writeSheet.js";
import { PipelineError } from "../errors.js";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 10;

function readMultipartField(fields: MultipartFields, name: string): string | undefined {
  const field = fields[name];
  if (field && !Array.isArray(field) && field.type === "field") return String(field.value);
  return undefined;
}

export async function registerUploadRoute(app: FastifyInstance): Promise<void> {
  app.post("/upload", async (request, reply) => {
    const files: StatementFile[] = [];
    let lastFields: MultipartFields | undefined;

    for await (const part of request.files({ limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES } })) {
      if (part.mimetype !== "application/pdf") {
        return reply.code(400).send({ ok: false, stage: "validation", error: `${part.filename} is not a PDF` });
      }
      const buffer = await part.toBuffer();
      files.push({ filename: part.filename, base64: buffer.toString("base64") });
      lastFields = part.fields;
    }

    if (files.length === 0) {
      return reply.code(400).send({ ok: false, stage: "validation", error: "No PDF files were uploaded" });
    }

    const driveFolderId = lastFields ? readMultipartField(lastFields, "driveFolderId") : undefined;
    const driveAccessToken = lastFields ? readMultipartField(lastFields, "driveAccessToken") : undefined;
    const driveTarget: DriveTarget | undefined =
      driveFolderId && driveAccessToken ? { folderId: driveFolderId, accessToken: driveAccessToken } : undefined;

    try {
      const extraction = await extractTransactions(files);
      const [categorized, verificationWarnings] = await Promise.all([
        categorizeTransactions(extraction.transactions),
        verifyExtraction(extraction.transactions),
      ]);
      const result = aggregate(categorized);
      const sheetUrl = await writeSheet(categorized, result, driveTarget);
      return reply.send({
        ok: true,
        sheetUrl,
        warnings: [...extraction.warnings, ...verificationWarnings],
      });
    } catch (err) {
      if (err instanceof PipelineError) {
        request.log.error({ err, stage: err.stage }, "pipeline stage failed");
        return reply.code(502).send({ ok: false, stage: err.stage, error: err.message });
      }
      request.log.error({ err }, "unexpected pipeline failure");
      return reply.code(500).send({ ok: false, stage: "unknown", error: "Unexpected server error" });
    }
  });
}
