"use client";

import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  files: File[];
  onRemove: (index: number) => void;
}

export function StatementPreviewList({ files, onRemove }: Props) {
  if (files.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {files.map((file, index) => (
        <li
          key={`${file.name}-${file.size}-${index}`}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{file.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${file.name}`}
            onClick={() => onRemove(index)}
          >
            <X className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
