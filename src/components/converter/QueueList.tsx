import { Button } from "@/components/ui/button";

export type QueueStatus = "queued" | "running" | "done" | "error" | "canceled";

export interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  resultBlob?: Blob;
  resultName?: string;
  error?: string;
}

interface Props {
  items: QueueItem[];
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onDownloadError: (id: string, error: string) => void;
}

type SaveFilePickerWindow = Window &
  typeof globalThis & {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void> | void;
        close: () => Promise<void> | void;
        abort?: () => Promise<void> | void;
      }>;
    }>;
  };

type PreviewSaveWindow = SaveFilePickerWindow & {
  __convertedMp4Blob?: Blob;
  __convertedMp4Name?: string;
  __convertedMp4Url?: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function downloadConvertedFile(item: QueueItem) {
  const blob = item.resultBlob;

  if (!blob) {
    throw new Error("No converted file is available to download.");
  }

  await assertMp4Blob(blob);

  const filename = item.resultName ?? item.file.name.replace(/\.[^.]+$/, "") + ".mp4";
  // Ensure correct MIME so the browser renders the <video> element.
  const mp4Blob = blob.type === "video/mp4" ? blob : new Blob([blob], { type: "video/mp4" });

  // Download directly from this page, no pop-up needed.
  try {
    const url = URL.createObjectURL(mp4Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  } catch {
    // fall through to preview tab
  }

  if (!openPreviewTab(mp4Blob, filename)) {
    throw new Error("Your browser blocked the pop-up. Allow pop-ups for this site, then click Download again.");
  }
}

function openPreviewTab(blob: Blob, filename: string): boolean {
  try {
    // Open a blank tab first so the new document inherits our origin.
    // Blob URLs are scoped to the origin that created them, so the video URL
    // and the page document must share an origin for playback/download to work.
    const win = window.open("", "_blank");
    if (!win) return false;

    // Create the object URL inside the NEW window's context so it belongs to
    // that document and stays valid for as long as the tab is open.
    const previewWin = win as PreviewSaveWindow;
    const winUrlApi = previewWin.URL ?? URL;
    const videoUrl = winUrlApi.createObjectURL(blob);
    const safeName = filename.replace(/[<>&"']/g, "_");
    previewWin.__convertedMp4Blob = blob;
    previewWin.__convertedMp4Name = safeName;
    previewWin.__convertedMp4Url = videoUrl;
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${safeName}</title>
<style>
  :root{--background:oklch(1 0 0);--foreground:oklch(0 0 0);--primary:oklch(0 0 0);--border:oklch(0 0 0);--muted:oklch(0.45 0 0)}
  html,body{margin:0;height:100%;background:var(--background);color:var(--foreground);font-family:'Courier New',monospace}
  header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px;border-bottom:1px solid var(--border)}
  .actions{display:flex;flex-wrap:wrap;gap:8px}
  button.btn{background:var(--background);color:var(--primary);padding:8px 10px;border-radius:0;cursor:pointer;border:0;font:inherit}
  button.btn:hover,button.btn:focus-visible{background:var(--primary);color:var(--background);outline:none}
  button.btn:disabled{opacity:.5}
  main{display:flex;align-items:center;justify-content:center;height:calc(100% - 130px)}
  video{max-width:100%;max-height:100%;background:var(--background)}
  .name{font-size:14px;overflow-wrap:anywhere;min-width:0}
  #status{min-height:20px;padding:12px 16px;color:var(--muted);font-size:13px;text-transform:uppercase}
</style></head>
<body>
  <header>
    <div class="name">${safeName}</div>
    <div class="actions">
      <button class="btn" id="dl" type="button">[ &lt; SAVE MP4 &gt; ]</button>
      <button class="btn secondary" id="raw" type="button">[ OPEN RAW VIDEO ]</button>
    </div>
  </header>
  <div id="status">Use “Save MP4” to open your browser’s native save dialog.</div>
  <main>
    <video controls autoplay playsinline src="${videoUrl}"></video>
  </main>
  <script>
    (() => {
      const saveButton = document.getElementById("dl");
      const rawButton = document.getElementById("raw");
      const status = document.getElementById("status");
      const blob = window.__convertedMp4Blob;
      const filename = window.__convertedMp4Name || ${JSON.stringify(safeName)};
      const videoUrl = window.__convertedMp4Url || ${JSON.stringify(videoUrl)};

      const setStatus = (message) => {
        status.textContent = message;
      };

      const saveWithFilePicker = async () => {
        if (!blob) {
          throw new Error("The MP4 data is not available in this preview window.");
        }
        if (typeof window.showSaveFilePicker !== "function") {
          throw new Error("Native file saving is not available in this browser window.");
        }

        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "MP4 video",
              accept: { "video/mp4": [".mp4"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        try {
          await writable.write(blob);
          await writable.close();
        } catch (error) {
          try {
            await writable.abort?.();
          } catch (_) {}
          throw error;
        }
      };

      const tryAnchorDownload = () => {
        const link = document.createElement("a");
        link.href = videoUrl;
        link.download = filename;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
      };

      saveButton.addEventListener("click", async () => {
        saveButton.disabled = true;
        setStatus("Opening save dialog…");
        try {
          await saveWithFilePicker();
          setStatus("Saved.");
        } catch (error) {
          if (error && error.name === "AbortError") {
            setStatus("Save canceled.");
          } else {
            setStatus("Native save is blocked here, trying browser download…");
            tryAnchorDownload();
            window.setTimeout(() => {
              setStatus("If nothing downloaded, this preview window is blocking downloads. Use “Open raw video”, or open the app in a direct browser tab and convert again.");
            }, 1200);
          }
        } finally {
          saveButton.disabled = false;
        }
      });

      rawButton.addEventListener("click", () => {
        window.location.href = videoUrl;
      });
    })();
  </script>
</body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
  } catch {
    return false;
  }
}

async function assertMp4Blob(blob: Blob) {
  if (blob.size === 0) {
    throw new Error("The converted MP4 is empty, so there is nothing to save.");
  }

  const header = await blob.slice(0, 64).text().catch(() => "");
  const normalizedHeader = header.trimStart().toLowerCase();

  if (normalizedHeader.startsWith("<!doctype html") || normalizedHeader.startsWith("<html")) {
    throw new Error(
      "The converted file contains an HTML error page instead of MP4 video. Please refresh the app and convert the file again.",
    );
  }
}

function isInsideFrame() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function canUseAnchorFallback() {
  if (!isInsideFrame()) return true;

  try {
    const frame = window.frameElement;
    if (!(frame instanceof HTMLIFrameElement)) return true;
    const sandbox = frame.getAttribute("sandbox");
    if (!sandbox) return true;

    const permissions = sandbox.toLowerCase().split(/\s+/);
    return permissions.includes("allow-downloads");
  } catch {
    // Cross-origin frame access throws — assume it's allowed and let the
    // browser decide when we actually click the link.
    return true;
  }
}

async function tryNativeSave(blob: Blob, filename: string) {
  const showSaveFilePicker = (window as SaveFilePickerWindow).showSaveFilePicker;
  if (!showSaveFilePicker) return false;

  try {
    const handle = await showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: "MP4 video",
          accept: { "video/mp4": [".mp4"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    return false;
  }
}

function triggerBlobDownload(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return canUseAnchorFallback();
  } catch {
    return false;
  }
}

function openBlobInNewTab(blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return win !== null;
  } catch {
    return false;
  }
}

function formatDownloadError(err: unknown) {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "Download canceled.";
  }
  if (err instanceof Error && err.message) return `Download failed: ${err.message}`;
  return "Download failed. Your browser blocked the save action.";
}

export function QueueList({ items, onCancel, onRemove, onDownloadError }: Props) {
  if (items.length === 0) {
    return (
      <div className="terminal-empty text-sm text-muted-foreground">
        <p>&gt; NO INPUT FILES.</p>
        <p className="mt-2 text-xs">AWAITING DV MEDIA<span className="terminal-cursor" aria-hidden="true">_</span></p>
      </div>
    );
  }

  return (
    <ul className="terminal-queue" aria-live="polite">
      {items.map((item) => (
        <li
          key={item.id}
          className="terminal-queue-item flex flex-col gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StatusIcon status={item.status} />
              <span className="min-w-0 break-all font-medium">{item.file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(item.file.size)}
              </span>
            </div>
            {item.status === "running" && (
              <div className="mt-2 flex items-center gap-2">
                <AsciiProgress value={item.progress} />
              </div>
            )}
            {item.error && (
              <pre className="mt-2 max-h-48 overflow-y-auto p-2 text-xs text-destructive whitespace-pre-wrap break-all font-mono">
                {item.error}
              </pre>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {item.status === "done" && item.resultBlob && (
              <Button
                type="button"
                size="sm"
                className="terminal-command terminal-command-primary"
                onClick={() => {
                  void downloadConvertedFile(item).catch((err) => {
                    onDownloadError(item.id, formatDownloadError(err));
                  });
                }}
              >
                [ &lt; DOWNLOAD MP4 &gt; ]
              </Button>
            )}
            {item.status === "running" && (
              <Button className="terminal-command" size="sm" variant="ghost" onClick={() => onCancel(item.id)}>
                [ CANCEL ]
              </Button>
            )}
            {item.status !== "running" && (
              <Button
                size="sm"
                className="terminal-command"
                variant="ghost"
                onClick={() => onRemove(item.id)}
                aria-label="Remove"
              >
                [ X ]
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatusIcon({ status }: { status: QueueStatus }) {
  return <span className={`shrink-0 text-xs ${status === "error" ? "text-destructive" : status === "done" || status === "running" ? "text-primary" : "text-muted-foreground"}`}>[{status === "done" ? "OK" : status.toUpperCase()}]</span>;
}

function AsciiProgress({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  const filled = Math.round(percent / 5);
  return <div role="progressbar" aria-label="Conversion progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="text-sm text-primary tabular-nums whitespace-pre">[{"=".repeat(filled)}{filled < 20 ? ">" + " ".repeat(19 - filled) : ""}] {percent}%</div>;
}
