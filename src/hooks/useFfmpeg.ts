import { useCallback, useRef } from "react";
import { buildFfmpegArgs, type ExportSettings } from "@/lib/converter/buildFfmpegArgs";

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
const MOUNT_DIR = "/mnt";

type FFmpegInstance = {
  load: (opts: { coreURL: string; wasmURL: string }) => Promise<boolean>;
  on: (event: string, cb: (data: unknown) => void) => void;
  off: (event: string, cb: (data: unknown) => void) => void;
  writeFile: (name: string, data: Uint8Array) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array>;
  deleteFile: (name: string) => Promise<void>;
  createDir: (path: string) => Promise<void>;
  mount: (type: string, opts: unknown, path: string) => Promise<void>;
  unmount: (path: string) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  terminate: () => void;
};

export function useFfmpeg() {
  const ffmpegRef = useRef<FFmpegInstance | null>(null);
  const loadingRef = useRef<Promise<FFmpegInstance> | null>(null);

  const getInstance = useCallback(async (): Promise<FFmpegInstance> => {
    if (ffmpegRef.current) return ffmpegRef.current;
    if (loadingRef.current) return loadingRef.current;

    loadingRef.current = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ff = new FFmpeg() as unknown as FFmpegInstance;
      const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript");
      const wasmURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm");
      await ff.load({ coreURL, wasmURL });
      ffmpegRef.current = ff;
      return ff;
    })().catch((err) => {
      loadingRef.current = null;
      throw err;
    });
    return loadingRef.current;
  }, []);

  const convert = useCallback(
    async (
      file: File,
      settings: ExportSettings,
      onProgress: (ratio: number) => void,
    ): Promise<Blob> => {
      const logLines: string[] = [];
      const appendDiagnostic = (message: string, err?: unknown) => {
        const parts = [message];
        if (err instanceof Error && err.message) parts.push(err.message);
        else if (typeof err === "string" && err) parts.push(err);
        else if (err !== undefined) {
          try {
            parts.push(JSON.stringify(err));
          } catch {
            parts.push(String(err));
          }
        }
        if (logLines.length > 0) {
          parts.push(`--- ffmpeg stdout/stderr ---\n${logLines.join("\n")}`);
        } else {
          parts.push("--- ffmpeg stdout/stderr ---\nNo ffmpeg output was emitted before the failure.");
        }
        return new Error(parts.filter(Boolean).join("\n\n"));
      };

      const ff = await getInstance().catch((err) => {
        throw appendDiagnostic("Failed to load ffmpeg.wasm.", err);
      });
      const outputName = "output.mp4";

      // Mount the File via WORKERFS so ffmpeg reads it directly without
      // copying the bytes into the wasm heap (critical for large files).
      try {
        await ff.createDir(MOUNT_DIR);
      } catch {
        // already exists
      }

      const progressHandler = (event: unknown) => {
        const e = event as { progress?: number };
        if (typeof e.progress === "number" && isFinite(e.progress)) {
          onProgress(Math.min(1, Math.max(0, e.progress)));
        }
      };

      // Capture ffmpeg log so we can surface the real stdout/stderr.
      const logHandler = (event: unknown) => {
        const e = event as { type?: string; message?: string };
        if (e.message) {
          logLines.push(e.type ? `[${e.type}] ${e.message}` : e.message);
          if (logLines.length > 200) logLines.shift();
        }
      };

      ff.on("progress", progressHandler);
      ff.on("log", logHandler);

      try {
        await ff.mount("WORKERFS", { files: [file] }, MOUNT_DIR).catch((err) => {
          throw appendDiagnostic("Failed to mount the selected file in ffmpeg.wasm.", err);
        });
        const inputPath = `${MOUNT_DIR}/${file.name}`;
        const args = buildFfmpegArgs(inputPath, outputName, settings);
        logLines.push(`$ ffmpeg ${args.join(" ")}`);
        const code = await ff.exec(args).catch((err) => {
          throw appendDiagnostic("ffmpeg.wasm crashed or rejected the conversion.", err);
        });
        if (code !== 0) {
          throw appendDiagnostic(`ffmpeg exited with code ${code}`);
        }
        const out = await ff.readFile(outputName).catch((err) => {
          throw appendDiagnostic("ffmpeg finished but the MP4 output could not be read.", err);
        });
        const copy = new Uint8Array(out);
        await ff.deleteFile(outputName).catch(() => {});
        return new Blob([copy], { type: "video/mp4" });
      } finally {
        ff.off("progress", progressHandler);
        ff.off("log", logHandler);
        await ff.unmount(MOUNT_DIR).catch(() => {});
      }
    },
    [getInstance],
  );

  const cancel = useCallback(() => {
    if (ffmpegRef.current) {
      ffmpegRef.current.terminate();
      ffmpegRef.current = null;
      loadingRef.current = null;
    }
  }, []);

  return { convert, cancel, preload: getInstance };
}
