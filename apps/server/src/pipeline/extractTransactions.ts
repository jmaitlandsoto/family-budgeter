import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { AgentExtractionError } from "../errors.js";
import { ExtractionResultSchema, type ExtractionResult } from "../types.js";

export interface StatementFile {
  filename: string;
  base64: string;
}

const EXTRACTION_PROMPT = `You are given one or more bank statement PDFs. Extract every transaction from every statement into a single combined list.

For each transaction, record:
- date (ISO 8601, YYYY-MM-DD)
- description (the merchant/payee text as it appears on the statement)
- amount (signed: negative for money leaving the account, positive for money arriving)
- account (the account name or last 4 digits, if identifiable)
- sourceFile (the filename this transaction came from)

If a file is a scanned image, unreadable, or not a bank statement, do not guess — add a note to
"warnings" explaining which file and why, and still extract what you can from the rest.`;

// The Claude Code CLI's --json-schema flag rejects a top-level "$schema" key
// (it tries to resolve it as a $ref and fails to find a registered schema for
// the draft URI), so strip the one zod's toJSONSchema() adds by default.
const { $schema: _unusedSchemaDialect, ...outputJsonSchema } = z.toJSONSchema(ExtractionResultSchema);

async function* buildPrompt(files: StatementFile[]): AsyncGenerator<SDKUserMessage> {
  yield {
    type: "user",
    parent_tool_use_id: null,
    message: {
      role: "user",
      content: [
        { type: "text", text: EXTRACTION_PROMPT },
        ...files.map((file) => ({
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: file.base64 },
          title: file.filename,
        })),
      ],
    },
  };
}

export async function extractTransactions(files: StatementFile[]): Promise<ExtractionResult> {
  let structuredOutput: unknown;
  let failureReason: string | undefined;

  for await (const message of query({
    prompt: buildPrompt(files),
    options: {
      tools: [],
      permissionMode: "bypassPermissions",
      maxTurns: 5,
      outputFormat: { type: "json_schema", schema: outputJsonSchema },
    },
  })) {
    if (message.type === "result") {
      if (message.subtype === "success") {
        structuredOutput = message.structured_output;
      } else {
        failureReason = "errors" in message && message.errors.length > 0 ? message.errors.join("; ") : message.subtype;
      }
    }
  }

  if (failureReason) {
    throw new AgentExtractionError(`Extraction agent failed: ${failureReason}`);
  }

  if (structuredOutput === undefined) {
    throw new AgentExtractionError("Extraction agent finished without producing structured output");
  }

  const parsed = ExtractionResultSchema.safeParse(structuredOutput);
  if (!parsed.success) {
    throw new AgentExtractionError(`Extraction agent output did not match the expected schema: ${parsed.error.message}`);
  }

  return parsed.data;
}
