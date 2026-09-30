import { z } from "zod";

export const TransactionSchema = z.object({
  date: z.string().describe("ISO 8601 date (YYYY-MM-DD) the transaction posted"),
  description: z.string().describe("Merchant/payee description as it appears on the statement"),
  amount: z.number().describe("Signed amount: negative for money out (expenses), positive for money in (income/credits)"),
  account: z.string().optional().describe("Account name or last 4 digits, if identifiable from the statement"),
  sourceFile: z.string().optional().describe("Which uploaded file this transaction came from"),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const ExtractionResultSchema = z.object({
  transactions: z.array(TransactionSchema),
  warnings: z
    .array(z.string())
    .describe("Human-readable notes about pages/files that were unreadable, scanned images, or otherwise uncertain"),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export type CategorizedTransaction = Transaction & { category: string };

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

export interface AggregateResult {
  categoryTotals: CategoryTotal[];
  totalIncome: number;
  totalExpenses: number;
  net: number;
}

// Agent SDK reports an actual estimated USD cost per query() call; TypeSafe's
// systemOne only reports token usage, with no pricing exposed by the SDK, so
// the categorization/verification stages carry tokens only (no costUsd).
export interface AgentStageUsage {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface TypeSafeStageUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface PipelineUsage {
  extraction: AgentStageUsage;
  categorization: TypeSafeStageUsage;
  verification: TypeSafeStageUsage;
}
