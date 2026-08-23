"use client";

import { useEffect, useRef, useState } from "react";

const MAX_LINES = 500;

export function LogViewer({ appId }: { appId: number }) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const boxRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const source = new EventSource(`/api/apps/${appId}/logs`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      setLines((prev) => [...prev, event.data].slice(-MAX_LINES));
    };
    return () => source.close();
  }, [appId]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [lines]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">실시간 로그</h2>
        <span className="text-xs text-black/50 dark:text-white/50">
          {connected ? "연결됨" : "연결 끊김"}
        </span>
      </div>
      <pre
        ref={boxRef}
        className="h-64 overflow-y-auto rounded-md bg-black text-white/90 text-xs p-3 whitespace-pre-wrap break-all"
      >
        {lines.length === 0 ? "로그를 기다리는 중…" : lines.join("\n")}
      </pre>
    </div>
  );
}
