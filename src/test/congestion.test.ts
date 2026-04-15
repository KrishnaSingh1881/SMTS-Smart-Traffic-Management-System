/**
 * Unit tests for congestion utility and SSE emitter
 * Requirements: 7.5
 */

import { describe, it, expect, vi } from "vitest";
import { computeCongestionLevel } from "@/lib/utils/congestion";
import { emitSSE, sseEmitter } from "@/lib/sse/emitter";

// ─────────────────────────────────────────────
// computeCongestionLevel
// ─────────────────────────────────────────────

describe("computeCongestionLevel", () => {
  it('returns "Free" for low count and high speed (5, 60)', () => {
    expect(computeCongestionLevel(5, 60)).toBe("Free");
  });

  it('returns "Moderate" for mid count and moderate speed (30, 40)', () => {
    expect(computeCongestionLevel(30, 40)).toBe("Moderate");
  });

  it('returns "Heavy" for high count and low speed (60, 20)', () => {
    expect(computeCongestionLevel(60, 20)).toBe("Heavy");
  });

  it('returns "Gridlock" for very high count and very low speed (80, 10)', () => {
    expect(computeCongestionLevel(80, 10)).toBe("Gridlock");
  });

  it('returns "Gridlock" when both conditions are extreme (85, 5)', () => {
    expect(computeCongestionLevel(85, 5)).toBe("Gridlock");
  });

  it('returns "Free" for zero vehicles and high speed (0, 80)', () => {
    expect(computeCongestionLevel(0, 80)).toBe("Free");
  });
});

// ─────────────────────────────────────────────
// SSE emitter
// ─────────────────────────────────────────────

describe("emitSSE", () => {
  it("emits an event with the correct type and data on sseEmitter", () => {
    const listener = vi.fn();
    sseEmitter.on("sse", listener);

    emitSSE("segment:update", { segmentId: "test-id" });

    expect(listener).toHaveBeenCalledOnce();
    const [event] = listener.mock.calls[0];
    expect(event.type).toBe("segment:update");
    expect(event.data).toEqual({ segmentId: "test-id" });

    sseEmitter.off("sse", listener);
  });
});
