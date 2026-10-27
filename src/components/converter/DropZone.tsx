import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFiles, disabled }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={`terminal-drop ${over ? "bg-accent text-accent-foreground" : ""} ${disabled ? "opacity-50" : ""}`}
    >
      <div className="space-y-3">
        <p className="text-muted-foreground">SELECT INPUT FILE: <span className="text-primary">*.DV</span></p>
        <Button className="terminal-command" variant="ghost" disabled={disabled} onClick={() => inputRef.current?.click()}>[ &lt; UPLOAD DV FILE &gt; ]</Button>
        <p className="text-xs text-muted-foreground">OR DROP DV FILES HERE</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".dv,video/dv,video/x-dv"
        multiple
        aria-label="Select DV files"
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
