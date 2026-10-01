import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { AgentExtractionError } from "../errors.js";
import { ExtractionResultSchema, type AgentStageUsage, type ExtractionResult } from "../types.js";
import type { OcrPage } from "./ocr.js";

export interface ExtractionOutcome {
  result: ExtractionResult;
  usage: AgentStageUsage;
}

const EXTRACTION_PROMPT = `You are given OCR-extracted text from one or more bank statement PDFs. Extract every transaction from every statement into a single combined list.

For each transaction, record:
- date (ISO 8601, YYYY-MM-DD)
- description (the merchant/payee text as it appears on the statement)
- amount (signed: negative for money leaving the account, positive for money arriving)
- account (the account name or last 4 digits, if identifiable)
- sourceFile (the filename this transaction came from)

The OCR text can be garbled, out of order, or missing sections. If a file's text is unreadable,
empty, or doesn't look like a bank statement, do not guess — add a note to "warnings" explaining
which file and why, and still extract what you can from the rest.`;

// The Claude Code CLI's --json-schema flag rejects a top-level "$schema" key
// (it tries to resolve it as a $ref and fails to find a registered schema for
// the draft URI), so strip the one zod's toJSONSchema() adds by default.
const { $schema: _unusedSchemaDialect, ...outputJsonSchema } = z.toJSONSchema(ExtractionResultSchema);

async function* buildPrompt(pages: OcrPage[]): AsyncGenerator<SDKUserMessage> {
  yield {
    type: "user",
    parent_tool_use_id: null,
    message: {
      role: "user",
      content: [
        { type: "text", text: EXTRACTION_PROMPT },
        ...pages.map((page) => ({
          type: "text" as const,
          text: `=== ${page.filename} ===\n${page.text}`,
        })),
      ],
    },
  };
}

export async function extractTransactions(
  pages: OcrPage[],
  onNarration?: (text: string) => void,
): Promise<ExtractionOutcome> {
  let structuredOutput: unknown;
  let failureReason: string | undefined;
  let usage: AgentStageUsage = {
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  };

  for await (const message of query({
    prompt: buildPrompt(pages),
    options: {
      tools: [],
      permissionMode: "bypassPermissions",
      maxTurns: 5,
      // Document AI already did the OCR; this call only structures clean(ish)
      // text into JSON, so the cheaper aliased model is sufficient.
      model: "haiku",
      outputFormat: { type: "json_schema", schema: outputJsonSchema },
    },
  })) {
    if (message.type === "result") {
      // modelUsage/total_cost_usd cover the whole query() call (main loop + any
      // subagent/internal model calls), so this replaces rather than accumulates
      // across the result messages this single query() emits.
      usage = {
        costUsd: message.total_cost_usd,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      };
      for (const modelUsage of Object.values(message.modelUsage)) {
        usage.inputTokens += modelUsage.inputTokens;
        usage.outputTokens += modelUsage.outputTokens;
        usage.cacheReadInputTokens += modelUsage.cacheReadInputTokens;
        usage.cacheCreationInputTokens += modelUsage.cacheCreationInputTokens;
      }

      if (message.subtype === "success") {
        structuredOutput = message.structured_output;
      } else {
        failureReason = "errors" in message && message.errors.length > 0 ? message.errors.join("; ") : message.subtype;
      }
    } else if (message.type === "assistant") {
      // Only narrate plain text blocks — thinking blocks are internal reasoning,
      // not meant for end-user display.
      for (const block of message.message.content) {
        if (block.type === "text" && block.text.trim()) {
          onNarration?.(block.text);
        }
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

  return { result: parsed.data, usage };
}
