export type PipelineStage = "extraction" | "categorization" | "sheet_write" | "verification";

export class PipelineError extends Error {
  readonly stage: PipelineStage;

  constructor(stage: PipelineStage, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PipelineError";
    this.stage = stage;
  }
}

export class AgentExtractionError extends PipelineError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("extraction", message, options);
    this.name = "AgentExtractionError";
  }
}
