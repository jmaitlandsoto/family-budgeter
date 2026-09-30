"use client";

import Script from "next/script";
import { useRef, useState, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DriveFolderPicker } from "@/components/drive-folder-picker";

type UploadResponse =
  | { ok: true; sheetUrl: string; warnings: string[] }
  | { ok: false; error: string; stage?: string };

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly";

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<UploadResponse | null>(null);

  const [gisReady, setGisReady] = useState(false);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const [driveAuth, setDriveAuth] = useState<{ accessToken: string } | null>(null);
  const [driveFolder, setDriveFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);

  function handleSelectFolder() {
    if (driveAuth) {
      setFolderDialogOpen(true);
      return;
    }
    tokenClientRef.current?.requestAccessToken();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const files = inputRef.current?.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    if (driveFolder && driveAuth) {
      formData.append("driveFolderId", driveFolder.id);
      formData.append("driveAccessToken", driveAuth.accessToken);
    }
    for (const file of files) {
      formData.append("statements", file);
    }

    setStatus("loading");
    setResult(null);

    try {
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = (await response.json()) as UploadResponse;
      setResult(data);
      setStatus(data.ok ? "done" : "error");
    } catch {
      setResult({ ok: false, error: "Could not reach the server. Check your connection and try again." });
      setStatus("error");
    }
  }

  return (
    <Card className="w-full">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          const google = window.google;
          const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
          if (!google || !clientId) return;
          tokenClientRef.current = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: DRIVE_SCOPE,
            callback: (response) => {
              if (response.error) return;
              setDriveAuth({ accessToken: response.access_token });
              setFolderDialogOpen(true);
            },
          });
          setGisReady(true);
        }}
      />
      <CardHeader>
        <CardTitle>Upload statements</CardTitle>
        <CardDescription>PDF bank statements only. Each upload replaces the sheet&apos;s contents.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Destination</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!gisReady || status === "loading"}
                onClick={handleSelectFolder}
              >
                Select Google Drive folder
              </Button>
              {driveFolder && (
                <span className="text-sm text-muted-foreground">
                  Saving to: {driveFolder.name}{" "}
                  <button type="button" className="underline" onClick={() => setDriveFolder(null)}>
                    Clear
                  </button>
                </span>
              )}
            </div>
            {!driveFolder && (
              <p className="text-xs text-muted-foreground">No folder selected — will use the default configured sheet.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="statements">Statement PDFs</Label>
            <Input
              id="statements"
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              required
              disabled={status === "loading"}
            />
          </div>
          <Button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Processing…" : "Upload"}
          </Button>
        </form>

        {status === "loading" && <Progress value={null} />}

        {result?.ok && (
          <Alert>
            <AlertTitle>Done</AlertTitle>
            <AlertDescription>
              <a href={result.sheetUrl} target="_blank" rel="noreferrer">
                Open your budget sheet
              </a>
              {result.warnings.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-xs">
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        {result && !result.ok && (
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <DriveFolderPicker
        accessToken={driveAuth?.accessToken ?? ""}
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        onSelect={(folder) => {
          setDriveFolder(folder);
          setFolderDialogOpen(false);
        }}
      />
    </Card>
  );
}
