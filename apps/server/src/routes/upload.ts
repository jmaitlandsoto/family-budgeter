import type { FastifyInstance } from "fastify";
import { aggregate } from "../pipeline/aggregate.js";
import { categorizeTransactions } from "../pipeline/categorize.js";
import { extractTransactions } from "../pipeline/extractTransactions.js";
import { runOcr, type StatementFile } from "../pipeline/ocr.js";
import { verifyExtraction } from "../pipeline/verifyExtraction.js";
import { PipelineError } from "../errors.js";
import { createJob } from "../jobStore.js";
import type { CategorizedTransaction } from "../types.js";
import type { PendingTransaction, ProgressEvent } from "../progressEvents.js";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 10;
const PING_INTERVAL_MS = 15000;

export async function registerUploadRoute(app: FastifyInstance): Promise<void> {
  app.post("/upload", async (request, reply) => {
    const files: StatementFile[] = [];

    for await (const part of request.files({ limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES } })) {
      if (part.mimetype !== "application/pdf") {
        return reply.code(400).send({ ok: false, stage: "validation", error: `${part.filename} is not a PDF` });
      }
      const buffer = await part.toBuffer();
      files.push({ filename: part.filename, base64: buffer.toString("base64") });
    }

    if (files.length === 0) {
      return reply.code(400).send({ ok: false, stage: "validation", error: "No PDF files were uploaded" });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const send = (event: ProgressEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const keepAlive = setInterval(() => {
      reply.raw.write(": ping\n\n");
    }, PING_INTERVAL_MS);

    try {
      await runPipeline(files, send);
    } catch (err) {
      if (err instanceof PipelineError) {
        request.log.error({ err, stage: err.stage }, "pipeline stage failed");
        send({ type: "error", stage: err.stage, message: err.message });
      } else {
        request.log.error({ err }, "unexpected pipeline failure");
        send({ type: "error", stage: "unknown", message: "Unexpected server error" });
      }
    } finally {
      clearInterval(keepAlive);
      reply.raw.end();
    }
  });
}

async function runPipeline(files: StatementFile[], send: (event: ProgressEvent) => void): Promise<void> {
  send({ type: "stage_start", stage: "ocr", message: "Reading bank statement PDFs…" });
  const ocr = await runOcr(files);
  send({ type: "stage_complete", stage: "ocr" });

  send({ type: "stage_start", stage: "extraction", message: "Extracting transactions…" });
  const extraction = await extractTransactions(ocr.pages, (text) => send({ type: "chat", text }));
  send({ type: "stage_complete", stage: "extraction" });

  const { transactions, warnings: extractionWarnings } = extraction.result;
  const pending: PendingTransaction[] = transactions.map((tx) => ({ ...tx, category: null }));
  send({ type: "transactions_extracted", transactions: pending, warnings: extractionWarnings });

  send({ type: "stage_start", stage: "categorization", message: "Categorizing transactions…" });
  send({ type: "stage_start", stage: "verification", message: "Double-checking extracted transactions…" });

  const partial: (CategorizedTransaction | undefined)[] = new Array(transactions.length);
  const CATEGORIZE_BATCH_SIZE = 20;

  const [categorizeOutcome, verifyOutcome] = await Promise.all([
    categorizeTransactions(transactions, (index, category) => {
      partial[index] = { ...transactions[index], category };
      send({ type: "transaction_categorized", index, category });
      const isBatchBoundary = (index + 1) % CATEGORIZE_BATCH_SIZE === 0 || index === transactions.length - 1;
      if (isBatchBoundary) {
        const settled = partial.filter((tx): tx is CategorizedTransaction => tx !== undefined);
        send({ type: "aggregate_update", result: aggregate(settled) });
      }
    }),
    verifyExtraction(transactions, (_index, warning) => {
      if (warning) send({ type: "warning", stage: "verification", message: warning });
    }),
  ]);

  send({ type: "stage_complete", stage: "categorization" });
  send({ type: "stage_complete", stage: "verification" });

  const categorized = categorizeOutcome.transactions;
  const result = aggregate(categorized);
  send({ type: "aggregate_update", result });

  const warnings = [...ocr.warnings, ...extractionWarnings, ...verifyOutcome.warnings];
  const jobId = createJob(categorized, result);
  send({
    type: "done",
    jobId,
    transactions: categorized,
    result,
    warnings,
    usage: {
      ocr: ocr.usage,
      extraction: extraction.usage,
      categorization: categorizeOutcome.usage,
      verification: verifyOutcome.usage,
    },
  });
}
