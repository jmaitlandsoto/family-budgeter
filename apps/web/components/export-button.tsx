"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DriveFolderPicker } from "@/components/drive-folder-picker";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly";

type ExportResponse = { ok: true; sheetUrl: string } | { ok: false; error: string };

interface Props {
  jobId: string;
}

export function ExportButton({ jobId }: Props) {
  const [gisReady, setGisReady] = useState(false);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const [driveAuth, setDriveAuth] = useState<{ accessToken: string } | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "exporting" | "done" | "error">("idle");
  const [result, setResult] = useState<ExportResponse | null>(null);

  function handleClick() {
    if (driveAuth) {
      setFolderDialogOpen(true);
      return;
    }
    tokenClientRef.current?.requestAccessToken();
  }

  async function handleFolderSelected(folder: { id: string; name: string }) {
    setFolderDialogOpen(false);
    if (!driveAuth) return;

    setStatus("exporting");
    setResult(null);

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, driveFolderId: folder.id, driveAccessToken: driveAuth.accessToken }),
      });
      const data = (await response.json()) as ExportResponse;
      setResult(data);
      setStatus(data.ok ? "done" : "error");
    } catch {
      setResult({ ok: false, error: "Could not reach the server. Check your connection and try again." });
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
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
      <Button type="button" disabled={!gisReady || status === "exporting"} onClick={handleClick}>
        {status === "exporting" ? "Exporting…" : "Export to Google Drive"}
      </Button>

      {result?.ok && (
        <Alert className="max-w-sm">
          <AlertTitle>Exported</AlertTitle>
          <AlertDescription>
            <a href={result.sheetUrl} target="_blank" rel="noreferrer">
              Open your budget sheet
            </a>
          </AlertDescription>
        </Alert>
      )}
      {result && !result.ok && (
        <Alert variant="destructive" className="max-w-sm">
          <AlertTitle>Export failed</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}

      <DriveFolderPicker
        accessToken={driveAuth?.accessToken ?? ""}
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        onSelect={handleFolderSelected}
      />
    </div>
  );
}
