import type { ReactNode } from "react";

export function TerminalFrame({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`terminal-frame ${className}`} aria-label={title}>
      {title && <h2 className="terminal-frame-title">[ {title} ]</h2>}
      <div className="terminal-frame-body">
        {children}
      </div>
    </section>
  );
}
