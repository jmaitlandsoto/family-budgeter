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

export type PipelineStage = "extraction" | "categorization" | "verification";

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
    }
  | { type: "error"; stage: PipelineStage | "sheet_write" | "unknown"; message: string };
