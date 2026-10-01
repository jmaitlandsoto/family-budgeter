"use client";

import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatEntry } from "@/hooks/use-budget-pipeline";
import type { PipelineUsage } from "@/lib/progress-events";

interface Props {
  entries: ChatEntry[];
  usage?: PipelineUsage | null;
}

const KIND_STYLES: Record<ChatEntry["kind"], string> = {
  stage: "text-muted-foreground text-xs uppercase tracking-wide",
  text: "text-sm",
  warning: "text-sm text-amber-600 dark:text-amber-400",
  error: "text-sm text-destructive",
};

function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

function formatTokens(count: number): string {
  return count.toLocaleString();
}

// TypeSafe's systemOne only reports token usage, with no pricing exposed by
// the SDK — so the grand total below is the Agent SDK's extraction cost only,
// and is labeled as such rather than implying it covers every stage.
function UsageSummary({ usage }: { usage: PipelineUsage }) {
  return (
    <div className="mt-2 rounded-md border bg-muted/40 p-3 text-xs">
      <p className="mb-2 font-medium uppercase tracking-wide text-muted-foreground">Usage & cost</p>
      <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1.5">
        <span className="font-medium">OCR</span>
        <span className="text-muted-foreground">{usage.ocr.pages} pages processed</span>
        <span className="text-muted-foreground">n/a</span>

        <span className="font-medium">Extraction</span>
        <span className="text-muted-foreground">
          {formatTokens(usage.extraction.inputTokens)} in / {formatTokens(usage.extraction.outputTokens)} out tokens
          {usage.extraction.cacheReadInputTokens + usage.extraction.cacheCreationInputTokens > 0 && (
            <> ({formatTokens(usage.extraction.cacheReadInputTokens)} cache read)</>
          )}
        </span>
        <span className="tabular-nums">{formatUsd(usage.extraction.costUsd)}</span>

        <span className="font-medium">Categorization</span>
        <span className="text-muted-foreground">
          {usage.categorization.calls} calls · {formatTokens(usage.categorization.inputTokens)} in /{" "}
          {formatTokens(usage.categorization.outputTokens)} out tokens
        </span>
        <span className="text-muted-foreground">n/a</span>

        <span className="font-medium">Verification</span>
        <span className="text-muted-foreground">
          {usage.verification.calls} calls · {formatTokens(usage.verification.inputTokens)} in /{" "}
          {formatTokens(usage.verification.outputTokens)} out tokens
        </span>
        <span className="text-muted-foreground">n/a</span>
      </div>
      <p className="mt-2 border-t pt-2 text-muted-foreground">
        Total: <span className="font-medium tabular-nums text-foreground">{formatUsd(usage.extraction.costUsd)}</span> — extraction
        only (Agent SDK reports estimated cost; TypeSafe&rsquo;s SDK reports tokens but no pricing).
      </p>
    </div>
  );
}

export function ChatPanel({ entries, usage }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length]);

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-4">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Waiting to start…</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2">
            {entry.kind !== "stage" && (
              <Avatar size="sm">
                <AvatarFallback>
                  <Bot className="size-3.5" />
                </AvatarFallback>
              </Avatar>
            )}
            <p className={cn(KIND_STYLES[entry.kind], entry.kind === "stage" && "pl-8")}>{entry.text}</p>
          </div>
        ))}
        {usage && <UsageSummary usage={usage} />}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
