import type { AggregateResult, CategorizedTransaction, PipelineUsage, Transaction } from "./types.js";

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
