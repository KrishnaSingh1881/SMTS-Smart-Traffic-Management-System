"use client";

/**
 * AIAnalystPanel
 * Collapsible panel that streams AI traffic insights via SSE.
 * Requirements: 13.1, 13.2, 13.5, 13.7, 13.8, 13.11, 13.12
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import type { AIInsight } from "@/lib/simulation/types";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Max tokens (words) to display before truncating the streaming response */
const MAX_TOKENS = 200;

/** Max insights to retain in history */
const MAX_HISTORY = 5;

// ─────────────────────────────────────────────
// SSE event payloads
// ─────────────────────────────────────────────

interface TokenPayload {
  token: string;
  insightId: string;
}

interface InsightCompletePayload {
  insightId: string;
  insight: AIInsight;
}

interface InsightErrorPayload {
  insightId?: string;
  message: string;
  offline?: boolean;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function countTokens(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function truncateToTokens(text: string, max: number): { text: string; truncated: boolean } {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return { text, truncated: false };
  return { text: words.slice(0, max).join(" "), truncated: true };
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function TriggerBadge({ trigger }: { trigger: AIInsight["trigger"] }) {
  const styles: Record<AIInsight["trigger"], string> = {
    scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    scenario: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    gridlock_alert: "bg-red-500/15 text-red-400 border-red-500/30",
    manual: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border",
        styles[trigger]
      )}
    >
      {trigger.replace("_", " ")}
    </span>
  );
}

interface InsightCardProps {
  insight: AIInsight;
}

function InsightCard({ insight }: InsightCardProps) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/4 p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <TriggerBadge trigger={insight.trigger} />
        <span className="font-mono text-[10px] text-white/30">{insight.simulatedTime}</span>
      </div>
      <p className="text-xs text-white/75 leading-relaxed">{insight.text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function AIAnalystPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingTruncated, setStreamingTruncated] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const currentInsightIdRef = useRef<string | null>(null);
  const streamingTextRef = useRef("");

  // ── Auto-scroll when streaming ────────────────────────────────────────────
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText, isStreaming]);

  // ── Auto-open triggers (scenario + gridlock) ─────────────────────────────
  const lastGridlockTriggerRef = useRef<number>(0);

  useEffect(() => {
    const es = new EventSource("/api/monitoring/sse");

    es.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as { type: string; data: unknown };

        // Req 13.9 — scenario update → auto-open + trigger AI
        if (event.type === "simulation:scenario_update") {
          setIsOpen(true);
          fetch("/api/ai/insight", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trigger: "scenario" }),
          }).catch(() => {/* ignore */});
        }

        // Req 13.10 — segment gridlock → auto-open + trigger AI (debounced 30s)
        if (event.type === "segment:update") {
          const data = event.data as { congestionLevel?: string };
          if (data?.congestionLevel === "Gridlock") {
            const now = Date.now();
            if (now - lastGridlockTriggerRef.current >= 30_000) {
              lastGridlockTriggerRef.current = now;
              setIsOpen(true);
              fetch("/api/ai/insight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ trigger: "gridlock_alert" }),
              }).catch(() => {/* ignore */});
            }
          }
        }
      } catch {
        // ignore malformed events
      }
    };

    return () => {
      es.close();
    };
  }, []);

  // ── SSE subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource("/api/ai/insight/stream");

    es.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as {
          type: string;
          data: unknown;
        };

        if (event.type === "ai:token") {
          const payload = event.data as TokenPayload;

          // Track which insight we're streaming
          if (currentInsightIdRef.current === null) {
            currentInsightIdRef.current = payload.insightId;
            setIsStreaming(true);
            setIsLoading(false);
            streamingTextRef.current = "";
          }

          if (currentInsightIdRef.current !== payload.insightId) return;

          // Append token and check truncation
          const next = streamingTextRef.current + payload.token;
          const tokenCount = countTokens(next);

          if (tokenCount >= MAX_TOKENS) {
            const { text } = truncateToTokens(next, MAX_TOKENS);
            streamingTextRef.current = text;
            setStreamingText(text);
            setStreamingTruncated(true);
            // Stop accepting more tokens for this insight
            currentInsightIdRef.current = "__truncated__";
          } else {
            streamingTextRef.current = next;
            setStreamingText(next);
          }
        } else if (event.type === "ai:insight_complete") {
          const payload = event.data as InsightCompletePayload;

          // Finalise streaming state
          setIsStreaming(false);
          setIsLoading(false);
          currentInsightIdRef.current = null;

          // Build the final insight text (may be truncated)
          const finalText = streamingTextRef.current || payload.insight?.text || "";
          const { text, truncated } = truncateToTokens(finalText, MAX_TOKENS);

          const finalInsight: AIInsight = {
            ...(payload.insight ?? {
              id: payload.insightId,
              trigger: "manual",
              simulatedTime: "--:--",
              createdAt: Date.now(),
            }),
            text: truncated ? text + "…" : text,
          };

          setInsights((prev) => {
            const next = [finalInsight, ...prev];
            return next.slice(0, MAX_HISTORY);
          });

          setStreamingText("");
          setStreamingTruncated(false);
          streamingTextRef.current = "";
        } else if (event.type === "ai:insight_error") {
          const payload = event.data as InsightErrorPayload;

          setIsStreaming(false);
          setIsLoading(false);
          currentInsightIdRef.current = null;

          if (payload.offline) {
            setIsOffline(true);
          }

          // If we had partial streaming text, save it with "…" suffix
          if (streamingTextRef.current.trim()) {
            const partial = streamingTextRef.current.trim() + "…";
            const partialInsight: AIInsight = {
              id: payload.insightId ?? `err-${Date.now()}`,
              trigger: "manual",
              text: partial,
              simulatedTime: "--:--",
              createdAt: Date.now(),
            };
            setInsights((prev) => [partialInsight, ...prev].slice(0, MAX_HISTORY));
          }

          setStreamingText("");
          setStreamingTruncated(false);
          streamingTextRef.current = "";
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      // If we were mid-stream, mark partial text with "…"
      if (streamingTextRef.current.trim()) {
        const partial = streamingTextRef.current.trim() + "…";
        const partialInsight: AIInsight = {
          id: `interrupted-${Date.now()}`,
          trigger: "manual",
          text: partial,
          simulatedTime: "--:--",
          createdAt: Date.now(),
        };
        setInsights((prev) => [partialInsight, ...prev].slice(0, MAX_HISTORY));
        streamingTextRef.current = "";
        setStreamingText("");
      }
      setIsStreaming(false);
      setIsLoading(false);
      currentInsightIdRef.current = null;
    };

    return () => {
      es.close();
    };
  }, []);

  // ── Ask AI handler ────────────────────────────────────────────────────────
  const handleAskAI = useCallback(async () => {
    if (isLoading || isStreaming) return;
    setIsLoading(true);
    setIsOffline(false);
    try {
      await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual" }),
      });
      // Response streams via SSE; loading state cleared on first token or error
    } catch {
      setIsLoading(false);
    }
  }, [isLoading, isStreaming]);

  // ── Derived display text ──────────────────────────────────────────────────
  const displayStreamingText = streamingTruncated
    ? streamingText + "…"
    : streamingText;

  return (
    <div className="flex flex-col h-full" aria-label="AI Analyst panel">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <BrainIcon />
          <h2 className="text-sm font-semibold text-white/90">AI Analyst</h2>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAskAI}
            disabled={isLoading || isStreaming || isOffline}
            aria-label="Ask AI for insight"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all duration-150",
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
              "hover:bg-emerald-500/20 hover:border-emerald-500/60",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <SparkleIcon />
            )}
            Ask AI
          </button>
          <button
            onClick={() => setIsOpen((o) => !o)}
            aria-label={isOpen ? "Collapse AI Analyst" : "Expand AI Analyst"}
            aria-expanded={isOpen}
            className="p-1 rounded text-white/40 hover:text-white/70 transition-colors"
          >
            {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Offline banner */}
          {isOffline && (
            <div className="mx-3 mt-3 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-400 font-medium">
              AI Analyst offline — operating in manual mode
            </div>
          )}

          {/* Streaming area */}
          {(isStreaming || isLoading) && (
            <div className="mx-3 mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              {isLoading && !isStreaming ? (
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
                  Generating insight…
                </div>
              ) : (
                <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
                  {displayStreamingText}
                  <span className="inline-block w-0.5 h-3.5 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
                </p>
              )}
            </div>
          )}

          {/* History */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0"
          >
            {insights.length === 0 && !isStreaming && !isLoading && (
              <p className="text-xs text-white/30 text-center py-6">
                No insights yet — click &ldquo;Ask AI&rdquo; to generate one
              </p>
            )}
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Inline SVG icons
// ─────────────────────────────────────────────

function BrainIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-violet-400"
      aria-hidden="true"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.98-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.98-3 2.5 2.5 0 0 0 1.32-4.24 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
