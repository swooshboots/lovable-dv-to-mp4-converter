import type { ExportSettings as Settings } from "@/lib/converter/buildFfmpegArgs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface Props {
  value: Settings;
  onChange: (s: Settings) => void;
  disabled?: boolean;
}

export function ExportSettingsPanel({ value, onChange, disabled }: Props) {
  return (
    <div className="terminal-options">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="resolution">RESOLUTION:</Label>
          <Select
            value={value.resolution}
            onValueChange={(v) =>
              onChange({ ...value, resolution: v as Settings["resolution"] })
            }
            disabled={disabled}
          >
            <SelectTrigger id="resolution" className="terminal-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">KEEP ORIGINAL</SelectItem>
              <SelectItem value="1080">1920 × 1080</SelectItem>
              <SelectItem value="720">1280 × 720</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="frame-rate">FRAME RATE:</Label>
          <Select
            value={value.frameRate}
            onValueChange={(v) =>
              onChange({ ...value, frameRate: v as Settings["frameRate"] })
            }
            disabled={disabled}
          >
            <SelectTrigger id="frame-rate" className="terminal-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">KEEP ORIGINAL</SelectItem>
              <SelectItem value="30">30 FPS</SelectItem>
              <SelectItem value="60">60 FPS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="quality">QUALITY: CRF {value.crf}</Label>
            <span className="text-xs text-muted-foreground">
              18: HIGH / 30: COMPACT
            </span>
          </div>
          <Slider
            id="quality"
            aria-label="Quality CRF"
            className="terminal-slider"
            min={18}
            max={30}
            step={1}
            value={[value.crf]}
            onValueChange={([v]) => onChange({ ...value, crf: v })}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            LOWER = BETTER QUALITY + BIGGER FILE. 23 IS A GOOD DEFAULT.
          </p>
        </div>

        <div className="flex items-center justify-between sm:col-span-2">
          <div>
              <Label htmlFor="deinterlace">DEINTERLACE:</Label>
            <p className="text-xs text-muted-foreground">
              YADIF / INTERLACED DV
            </p>
          </div>
          <Button
            variant="ghost"
            className="terminal-command"
            id="deinterlace"
            role="switch"
            aria-checked={value.deinterlace}
            aria-label="Deinterlace"
            onClick={() => onChange({ ...value, deinterlace: !value.deinterlace })}
            disabled={disabled}
          >[ {value.deinterlace ? "YES" : "NO"} ]</Button>
        </div>

      </div>
    </div>
  );
}
