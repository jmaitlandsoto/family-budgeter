// Hand-duplicated wire types — must be kept structurally in sync with
// apps/server/src/types.ts and apps/server/src/progressEvents.ts. There is
// no shared workspace package between apps/web and apps/server (see
// CLAUDE.md), matching the existing duplication convention this app already
// used for its old UploadResponse type.

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  account?: string;
  sourceFile?: string;
}

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

// Document AI's API reports pages processed, not a dollar cost, same reasoning
// as TypeSafeStageUsage having no costUsd.
export interface OcrStageUsage {
  pages: number;
}

export interface PipelineUsage {
  ocr: OcrStageUsage;
  extraction: AgentStageUsage;
  categorization: TypeSafeStageUsage;
  verification: TypeSafeStageUsage;
}

export type PipelineStage = "ocr" | "extraction" | "categorization" | "verification";

export type PendingTransaction = Transaction & { category: null };

export type ProgressEvent =
  | { type: "stage_start"; stage: PipelineStage; message: string }
  | { type: "stage_complete"; stage: PipelineStage }
  | { type: "chat"; text: string }
  | { type: "transactions_extracted"; transactions: PendingTransaction[]; warnings: string[] }
  | { type: "transaction_categorized"; index: number; category: string }
  | { type: "aggregate_update"; result: AggregateResult }
  | { type: "warning"; stage: PipelineStage; message: string }
  | {
      type: "done";
      jobId: string;
      transactions: CategorizedTransaction[];
      result: AggregateResult;
      warnings: string[];
      usage: PipelineUsage;
    }
  | { type: "error"; stage: PipelineStage | "sheet_write" | "unknown"; message: string };
