"use client";

import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatEntry } from "@/hooks/use-budget-pipeline";

interface Props {
  entries: ChatEntry[];
}

const KIND_STYLES: Record<ChatEntry["kind"], string> = {
  stage: "text-muted-foreground text-xs uppercase tracking-wide",
  text: "text-sm",
  warning: "text-sm text-amber-600 dark:text-amber-400",
  error: "text-sm text-destructive",
};

export function ChatPanel({ entries }: Props) {
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
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
