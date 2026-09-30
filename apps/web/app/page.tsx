"use client";

import { useState } from "react";
import { UploadView } from "@/components/upload-view";
import { ProcessingView } from "@/components/processing-view";
import { useBudgetPipeline } from "@/hooks/use-budget-pipeline";

export default function Home() {
  const [phase, setPhase] = useState<"select" | "processing">("select");
  const [lastFiles, setLastFiles] = useState<File[]>([]);
  const pipeline = useBudgetPipeline();

  function handleCreateBudget(files: File[]) {
    setLastFiles(files);
    setPhase("processing");
    void pipeline.start(files);
  }

  function handleRetry() {
    void pipeline.start(lastFiles);
  }

  function handleStartOver() {
    pipeline.reset();
    setPhase("select");
  }

  if (phase === "processing") {
    return <ProcessingView state={pipeline.state} onRetry={handleRetry} onStartOver={handleStartOver} />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Family Budgeter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your bank statement PDFs to update the shared budget sheet.
        </p>
      </div>
      <UploadView onCreateBudget={handleCreateBudget} />
    </main>
  );
}
