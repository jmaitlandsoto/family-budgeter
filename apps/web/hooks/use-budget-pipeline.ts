"use client";

import { useCallback, useReducer, useRef } from "react";
import type {
  AggregateResult,
  CategorizedTransaction,
  PendingTransaction,
  ProgressEvent,
} from "@/lib/progress-events";

export type ChatEntry = {
  id: string;
  kind: "stage" | "text" | "warning" | "error";
  text: string;
};

export type PipelineRow = PendingTransaction | CategorizedTransaction;

export interface PipelineState {
  phase: "idle" | "running" | "done" | "error";
  chat: ChatEntry[];
  transactions: PipelineRow[];
  aggregate: AggregateResult | null;
  warnings: string[];
  jobId: string | null;
  errorMessage: string | null;
}

const initialState: PipelineState = {
  phase: "idle",
  chat: [],
  transactions: [],
  aggregate: null,
  warnings: [],
  jobId: null,
  errorMessage: null,
};

type Action = { kind: "reset" } | { kind: "event"; event: ProgressEvent };

let nextChatId = 0;
function chatEntry(kind: ChatEntry["kind"], text: string): ChatEntry {
  nextChatId += 1;
  return { id: `chat-${nextChatId}`, kind, text };
}

const STAGE_LABEL: Record<string, string> = {
  extraction: "Extraction",
  categorization: "Categorization",
  verification: "Verification",
};

function reducer(state: PipelineState, action: Action): PipelineState {
  if (action.kind === "reset") {
    return initialState;
  }

  const event = action.event;
  switch (event.type) {
    case "stage_start":
      return { ...state, chat: [...state.chat, chatEntry("stage", event.message)] };
    case "stage_complete":
      return {
        ...state,
        chat: [...state.chat, chatEntry("stage", `${STAGE_LABEL[event.stage] ?? event.stage} complete.`)],
      };
    case "chat":
      return { ...state, chat: [...state.chat, chatEntry("text", event.text)] };
    case "transactions_extracted":
      return {
        ...state,
        transactions: event.transactions,
        warnings: [...state.warnings, ...event.warnings],
      };
    case "transaction_categorized":
      return {
        ...state,
        transactions: state.transactions.map((tx, i) =>
          i === event.index ? { ...tx, category: event.category } : tx,
        ),
      };
    case "aggregate_update":
      return { ...state, aggregate: event.result };
    case "warning":
      return {
        ...state,
        warnings: [...state.warnings, event.message],
        chat: [...state.chat, chatEntry("warning", event.message)],
      };
    case "done":
      return {
        ...state,
        phase: "done",
        jobId: event.jobId,
        transactions: event.transactions,
        aggregate: event.result,
        warnings: event.warnings,
        chat: [...state.chat, chatEntry("stage", "Done — ready to export.")],
      };
    case "error":
      return {
        ...state,
        phase: "error",
        errorMessage: event.message,
        chat: [...state.chat, chatEntry("error", event.message)],
      };
    default:
      return state;
  }
}

interface ValidationErrorBody {
  ok: false;
  error: string;
  stage?: string;
}

export function useBudgetPipeline() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const runIdRef = useRef(0);

  const start = useCallback(async (files: File[]) => {
    const runId = ++runIdRef.current;
    dispatch({ kind: "reset" });

    const formData = new FormData();
    for (const file of files) {
      formData.append("statements", file);
    }

    let response: Response;
    try {
      response = await fetch("/api/upload", { method: "POST", body: formData });
    } catch {
      if (runIdRef.current !== runId) return;
      dispatch({
        kind: "event",
        event: { type: "error", stage: "unknown", message: "Could not reach the server. Check your connection and try again." },
      });
      return;
    }

    if (runIdRef.current !== runId) return;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream") || !response.body) {
      const data = (await response.json().catch(() => null)) as ValidationErrorBody | null;
      dispatch({
        kind: "event",
        event: {
          type: "error",
          stage: "unknown",
          message: data?.error ?? "Upload failed before processing could start.",
        },
      });
      return;
    }

    dispatch({ kind: "event", event: { type: "stage_start", stage: "extraction", message: "Starting…" } });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawTerminalEvent = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (runIdRef.current !== runId) return;

        buffer += decoder.decode(value, { stream: true });
        let sepIndex: number;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue; // e.g. ": ping" keep-alive comments
          const event = JSON.parse(dataLine.slice(6)) as ProgressEvent;
          if (event.type === "done" || event.type === "error") sawTerminalEvent = true;
          dispatch({ kind: "event", event });
        }
      }
    } catch {
      if (runIdRef.current !== runId) return;
      dispatch({
        kind: "event",
        event: { type: "error", stage: "unknown", message: "Connection lost while processing — please try again." },
      });
      return;
    }

    if (runIdRef.current !== runId) return;
    if (!sawTerminalEvent) {
      dispatch({
        kind: "event",
        event: { type: "error", stage: "unknown", message: "Connection lost while processing — please try again." },
      });
    }
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    dispatch({ kind: "reset" });
  }, []);

  return { state, start, reset };
}
