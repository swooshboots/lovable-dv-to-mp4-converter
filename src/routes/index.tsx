import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { DropZone } from "@/components/converter/DropZone";
import { ExportSettingsPanel } from "@/components/converter/ExportSettings";
import { QueueList, type QueueItem } from "@/components/converter/QueueList";
import { Button } from "@/components/ui/button";
import { useFfmpeg } from "@/hooks/useFfmpeg";
import {
  DEFAULT_SETTINGS,
  resolveFilename,
  type ExportSettings,
} from "@/lib/converter/buildFfmpegArgs";
import { TerminalFrame } from "@/components/converter/TerminalFrame";
import { track } from "@/lib/track";

function formatConversionError(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  try {
    const serialized = JSON.stringify(err, null, 2);
    if (serialized) return serialized;
  } catch {
    // fall through to String()
  }
  return String(err || "Conversion failed");
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DV to MP4 Converter — Convert DV footage in your browser" },
      {
        name: "description",
        content:
          "Convert DV video files to MP4 (H.264) locally in your browser. Batch queue, deinterlace, resolution and quality controls. No upload required.",
      },
      { property: "og:title", content: "DV to MP4 Converter" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Convert DV footage to MP4 locally with deinterlace and quality controls.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const cancelCurrentRef = useRef<(() => void) | null>(null);
  const stopRef = useRef(false);
  const { convert, cancel } = useFfmpeg();
  useEffect(() => track("pageview"), []);

  const addFiles = useCallback((files: File[]) => {
    setItems((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: "queued" as const,
        progress: 0,
      })),
    ]);
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const cancelItem = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      if (item.status === "running") {
        stopRef.current = true;
        cancelCurrentRef.current?.();
        cancel();
        updateItem(id, { status: "canceled", progress: 0 });
      }
    },
    [items, cancel, updateItem],
  );

  const startQueue = useCallback(async () => {
    if (running) return;
    setRunning(true);
    stopRef.current = false;

    // Snapshot settings at start time
    const snapshot = { ...settings };

    // Capture queued items at this moment
    const queued = items.filter((i) => i.status === "queued");
    for (const item of queued) {
      if (stopRef.current) break;
      updateItem(item.id, { status: "running", progress: 0 });
      let canceledThisItem = false;
      cancelCurrentRef.current = () => {
        canceledThisItem = true;
      };
      track("convert_start");
      try {
        const blob = await convert(item.file, snapshot, (p) => {
          updateItem(item.id, { progress: p });
        });
        if (canceledThisItem) continue;
        track("convert_done");
        updateItem(item.id, {
          status: "done",
          progress: 1,
          resultBlob: blob,
          resultName: resolveFilename(snapshot.filenameTemplate, item.file.name),
        });
      } catch (err) {
        if (canceledThisItem) continue;
        track("convert_fail");
        updateItem(item.id, {
          status: "error",
          error: formatConversionError(err),
        });
      } finally {
        cancelCurrentRef.current = null;
      }
    }

    setRunning(false);
  }, [running, settings, items, convert, updateItem]);

  const clearCompleted = useCallback(() => {
    setItems((prev) => {
      return prev.filter(
        (i) => i.status !== "done" && i.status !== "canceled" && i.status !== "error",
      );
    });
  }, []);

  const markDownloadError = useCallback(
    (id: string, error: string) => {
      updateItem(id, { error });
    },
    [updateItem],
  );

  const hasQueued = items.some((i) => i.status === "queued");
  const hasCompleted = items.some(
    (i) => i.status === "done" || i.status === "canceled" || i.status === "error",
  );

  return (
    <main className="terminal-screen min-h-screen bg-background">
      <div className="terminal-shell">
        <TerminalFrame className="terminal-header">
          <header className="py-4">
            <h1 className="text-xl font-bold text-primary sm:text-2xl">DV-TO-MP4 CONVERTER <span className="inline-block text-sm">v1.0</span></h1>
          </header>
        </TerminalFrame>

        <div className="mt-6 space-y-5">
          <TerminalFrame title="FILE SELECT"><DropZone onFiles={addFiles} disabled={running} /></TerminalFrame>
          <TerminalFrame title="OPTIONS"><ExportSettingsPanel value={settings} onChange={setSettings} disabled={running} /></TerminalFrame>

          <TerminalFrame title="STATUS">
            <div className="terminal-status-header">
              <h2 className="text-sm text-muted-foreground">QUEUE: <span className="text-primary">{String(items.length).padStart(2, "0")}</span> FILE(S)</h2>
              <div className="flex flex-wrap gap-2">
                {hasCompleted && (
                  <Button className="terminal-command" variant="ghost" size="sm" onClick={clearCompleted}>
                    [ CLEAR ]
                  </Button>
                )}
                <Button className="terminal-command terminal-command-primary" onClick={startQueue} disabled={!hasQueued || running} size="sm">
                  {running ? "[ CONVERTING... ]" : "[ < CONVERT > ]"}
                </Button>
              </div>
            </div>
            <QueueList
              items={items}
              onCancel={cancelItem}
              onRemove={removeItem}
              onDownloadError={markDownloadError}
            />
          </TerminalFrame>

          <footer className="terminal-footer">
            <div className="flex flex-wrap justify-between gap-3"><span className="text-primary">&gt; {running ? "PROCESSING" : !hasQueued && items.some((i) => i.status === "done") ? "COMPLETE" : "SYSTEM READY"}</span><span>PARADISE RESEARCH STUDIO · <a href="https://github.com/swooshboots/lovable-dv-to-mp4-converter" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">VIEW SOURCE ON GITHUB</a></span></div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              PRIVACY: YOUR VIDEOS NEVER LEAVE YOUR DEVICE. ALL CONVERSION HAPPENS LOCALLY IN YOUR BROWSER. NOTHING IS UPLOADED, STORED, OR VIEWED BY US. CLOSE THE TAB AND IT'S GONE.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
