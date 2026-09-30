"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChatPanel } from "@/components/chat-panel";
import { TransactionsTable } from "@/components/transactions-table";
import { ExportButton } from "@/components/export-button";
import type { PipelineState } from "@/hooks/use-budget-pipeline";

interface Props {
  state: PipelineState;
  onRetry: () => void;
  onStartOver: () => void;
}

export function ProcessingView({ state, onRetry, onStartOver }: Props) {
  return (
    <div className="flex h-screen flex-col">
      {state.phase === "error" && (
        <Alert variant="destructive" className="m-4 mb-0">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{state.errorMessage}</span>
            <span className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onStartOver}>
                Start over
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <div className="min-h-0 rounded-lg border">
          <ChatPanel entries={state.chat} />
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Transactions</h2>
            {state.phase === "done" && state.jobId && <ExportButton jobId={state.jobId} />}
          </div>
          <div className="min-h-0 flex-1 rounded-lg border">
            <TransactionsTable transactions={state.transactions} />
          </div>
        </div>
      </div>
    </div>
  );
}
