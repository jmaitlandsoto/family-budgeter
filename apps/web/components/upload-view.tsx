"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatementDropzone } from "@/components/statement-dropzone";
import { StatementPreviewList } from "@/components/statement-preview-list";

interface Props {
  onCreateBudget: (files: File[]) => void;
}

export function UploadView({ onCreateBudget }: Props) {
  const [files, setFiles] = useState<File[]>([]);

  function addFiles(newFiles: File[]) {
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const deduped = newFiles.filter((f) => !seen.has(`${f.name}:${f.size}`));
      return [...prev, ...deduped];
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload statements</CardTitle>
        <CardDescription>PDF bank statements only. Each upload replaces the sheet&apos;s contents.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <StatementDropzone onFilesAdded={addFiles} />
        <StatementPreviewList files={files} onRemove={removeFile} />
        <Button type="button" disabled={files.length === 0} onClick={() => onCreateBudget(files)}>
          Create budget
        </Button>
      </CardContent>
    </Card>
  );
}
