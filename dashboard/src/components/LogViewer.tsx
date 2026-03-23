'use client';
import { useEffect, useRef } from 'react';

interface LogViewerProps {
  lines: string[];
}

// Very simple ANSI colour → Tailwind class parser
function colorLine(line: string) {
  if (/\[ERROR\]|error:|exception/i.test(line)) return 'text-[#ef4444]';
  if (/\[WARN\]|warn:/i.test(line)) return 'text-[#f59e0b]';
  if (/\[INFO\]|info:/i.test(line)) return 'text-[#3b82f6]';
  if (/✓|success|ok\b/i.test(line)) return 'text-[#10b981]';
  return 'text-[#8fa8c8]';
}

export default function LogViewer({ lines }: LogViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="glass overflow-hidden">
      <div className="px-4 py-2 border-b border-[rgba(59,130,246,0.12)] flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] pulse-green" />
        <span className="text-xs text-[#5c7a9e] font-mono">pm2 logs — ao vivo</span>
      </div>
      <div className="font-mono text-xs p-4 h-96 overflow-y-auto space-y-0.5 bg-[#040710]">
        {lines.map((line, i) => (
          <div key={i} className={`leading-5 whitespace-pre-wrap break-all ${colorLine(line)}`}>
            {line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
