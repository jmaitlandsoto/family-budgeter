"use client";

import { useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onFilesAdded: (files: File[]) => void;
}

export function StatementDropzone({ onFilesAdded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const pdfs = Array.from(fileList).filter((file) => file.type === "application/pdf");
    if (pdfs.length > 0) onFilesAdded(pdfs);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    addFiles(event.dataTransfer.files);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
        isDragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
      )}
    >
      <UploadCloud className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">Drop bank statement PDFs here</p>
      <p className="text-xs text-muted-foreground">or click to browse</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
