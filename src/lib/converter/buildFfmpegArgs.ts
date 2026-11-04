export type Resolution = "keep" | "1080" | "720";
export type FrameRate = "keep" | "25" | "30" | "50" | "60";

export interface ExportSettings {
  resolution: Resolution;
  frameRate: FrameRate;
  crf: number;
  deinterlace: boolean;
  filenameTemplate: string;
}

export const DEFAULT_SETTINGS: ExportSettings = {
  resolution: "keep",
  frameRate: "keep",
  crf: 23,
  deinterlace: true,
  filenameTemplate: "{name}.mp4",
};

/**
 * Build an output filename from a template. Supports {name} (original basename
 * without extension) and {ext} (always "mp4"). Sanitizes illegal characters.
 */
export function resolveFilename(template: string, originalName: string): string {
  const baseName = originalName.replace(/\.[^.]+$/, "");
  let out = (template || "{name}.mp4")
    .replace(/\{name\}/g, baseName)
    .replace(/\{ext\}/g, "mp4")
    .trim();
  // Strip path separators and illegal filename chars
  out = out.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_");
  if (!out) out = `${baseName}.mp4`;
  if (!/\.mp4$/i.test(out)) out += ".mp4";
  return out;
}

export function buildFfmpegArgs(
  inputName: string,
  outputName: string,
  settings: ExportSettings,
): string[] {
  const filters: string[] = [];
  if (settings.deinterlace) filters.push(settings.frameRate === "25" ? "yadif=0" : "yadif=1");
  if (settings.resolution === "1080") filters.push("scale=1920:1080");
  else if (settings.resolution === "720") filters.push("scale=1280:720");
  if (settings.frameRate !== "keep") filters.push(`fps=${settings.frameRate}`);

  const args = ["-i", inputName];
  if (filters.length > 0) args.push("-vf", filters.join(","));
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    String(settings.crf),
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputName,
  );
  return args;
}
