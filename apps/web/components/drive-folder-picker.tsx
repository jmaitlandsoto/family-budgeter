"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronRight, Folder, FolderPlus, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DriveFolder = { id: string; name: string };

const ROOT: DriveFolder = { id: "root", name: "My Drive" };

type Props = {
  accessToken: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (folder: DriveFolder) => void;
};

export function DriveFolderPicker({ accessToken, open, onOpenChange, onSelect }: Props) {
  const [path, setPath] = useState<DriveFolder[]>([ROOT]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const current = path[path.length - 1];
  const visibleFolders = folders.filter((folder) => folder.name.toLowerCase().includes(search.trim().toLowerCase()));

  // Reset to the root every time the dialog transitions from closed to open.
  // (React-recommended "adjust state during render" pattern, rather than an
  // effect, since this only needs to run in response to a render, not to
  // synchronize with anything external.)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPath([ROOT]);
  }

  useEffect(() => {
    if (!open || !accessToken) return;
    let cancelled = false;

    async function loadFolders() {
      // Yield a tick so state updates below happen outside the effect's
      // synchronous body (satisfies react-hooks/set-state-in-effect).
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        q: `'${current.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id,name)",
        orderBy: "name",
      });

      try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Your Google session expired — close this and click the button again."
              : `Drive API returned ${response.status}`,
          );
        }
        const data = (await response.json()) as { files?: DriveFolder[] };
        if (!cancelled) setFolders(data.files ?? []);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load folders.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFolders();

    return () => {
      cancelled = true;
    };
  }, [open, accessToken, current.id, reloadToken]);

  function drillInto(folder: DriveFolder) {
    setPath((prev) => [...prev, folder]);
    setSearch("");
    setCreatingFolder(false);
  }

  function jumpTo(index: number) {
    setPath((prev) => prev.slice(0, index + 1));
    setSearch("");
    setCreatingFolder(false);
  }

  async function handleCreateFolder(event: FormEvent) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name || createBusy) return;

    setCreateBusy(true);
    setCreateError(null);

    try {
      const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [current.id],
        }),
      });
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Your Google session expired — close this and click the button again."
            : `Drive API returned ${response.status}`,
        );
      }
      const created = (await response.json()) as DriveFolder;
      setNewFolderName("");
      drillInto({ id: created.id, name: created.name });
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Could not create the folder.");
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a Drive folder</DialogTitle>
          <DialogDescription>The new sheet will be created inside the folder you pick.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {path.map((segment, index) => (
            <span key={segment.id} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="size-3" />}
              <button
                type="button"
                className={index === path.length - 1 ? "font-medium text-foreground" : "underline"}
                disabled={index === path.length - 1}
                onClick={() => jumpTo(index)}
              >
                {segment.name}
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search this folder"
              className="pl-8"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="New folder"
            disabled={loading}
            onClick={() => {
              setCreatingFolder((prev) => !prev);
              setCreateError(null);
            }}
          >
            <FolderPlus className="size-4" />
          </Button>
        </div>

        {creatingFolder && (
          <form onSubmit={handleCreateFolder} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="New folder name"
                disabled={createBusy}
              />
              <Button type="submit" size="sm" disabled={createBusy || !newFolderName.trim()}>
                Create
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={createBusy}
                onClick={() => {
                  setCreatingFolder(false);
                  setNewFolderName("");
                  setCreateError(null);
                }}
              >
                Cancel
              </Button>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </form>
        )}

        <div className="h-64 overflow-y-auto rounded-md border">
          {loading && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
          {!loading && error && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-destructive">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setReloadToken((n) => n + 1)}>
                Retry
              </Button>
            </div>
          )}
          {!loading && !error && visibleFolders.length === 0 && (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {search ? "No folders match your search." : "No subfolders here."}
            </p>
          )}
          {!loading &&
            !error &&
            visibleFolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => drillInto(folder)}
              >
                <Folder className="size-4 text-muted-foreground" />
                {folder.name}
              </button>
            ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSelect(current)}>
            Select &ldquo;{current.name}&rdquo;
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
