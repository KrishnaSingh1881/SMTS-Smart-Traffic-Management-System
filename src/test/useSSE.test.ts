/**
 * Unit tests for useSSE hook
 * Requirements: 21.4, 21.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSSE } from "@/lib/sse/useSSE";

// ── Mock EventSource ──────────────────────────────────────────────────────────

type ESHandler = ((event: Event) => void) | null;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onopen: ESHandler = null;
  onmessage: ESHandler = null;
  onerror: ESHandler = null;
  readyState = 0;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  /** Test helper: simulate a successful connection */
  simulateOpen() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  /** Test helper: simulate an incoming message */
  simulateMessage(data: string) {
    const event = new MessageEvent("message", { data });
    this.onmessage?.(event);
  }

  /** Test helper: simulate a connection error */
  simulateError() {
    this.onerror?.(new Event("error"));
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.useFakeTimers();
  // @ts-expect-error — replace global EventSource with mock
  global.EventSource = MockEventSource;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useSSE", () => {
  it("creates an EventSource on mount", () => {
    const onMessage = vi.fn();
    renderHook(() => useSSE({ url: "/api/test", onMessage }));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/test");
  });

  it("calls onMessage when a message arrives", () => {
    const onMessage = vi.fn();
    renderHook(() => useSSE({ url: "/api/test", onMessage }));
    const es = MockEventSource.instances[0];
    es.simulateMessage(JSON.stringify({ type: "segment:update", data: {} }));
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("closes EventSource on unmount", () => {
    const onMessage = vi.fn();
    const { unmount } = renderHook(() =>
      useSSE({ url: "/api/test", onMessage })
    );
    const es = MockEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
  });

  it("resets retry count on successful open", async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useSSE({ url: "/api/test", onMessage })
    );
    const es = MockEventSource.instances[0];

    // Trigger one error (retry 1)
    act(() => es.simulateError());
    // Advance past 1s delay
    await act(async () => vi.advanceTimersByTime(1100));

    // New ES created — simulate open (success)
    const es2 = MockEventSource.instances[1];
    act(() => es2.simulateOpen());

    // Toast should be null (no connection lost)
    expect(result.current.toast).toBeNull();
  });

  it("retries with exponential backoff: 1s, 2s, 4s", async () => {
    const onMessage = vi.fn();
    renderHook(() => useSSE({ url: "/api/test", onMessage, maxRetries: 3 }));

    // Error 1 → retry after 1s
    act(() => MockEventSource.instances[0].simulateError());
    expect(MockEventSource.instances).toHaveLength(1); // not yet retried
    await act(async () => vi.advanceTimersByTime(1000));
    expect(MockEventSource.instances).toHaveLength(2);

    // Error 2 → retry after 2s
    act(() => MockEventSource.instances[1].simulateError());
    await act(async () => vi.advanceTimersByTime(2000));
    expect(MockEventSource.instances).toHaveLength(3);

    // Error 3 → retry after 4s
    act(() => MockEventSource.instances[2].simulateError());
    await act(async () => vi.advanceTimersByTime(4000));
    expect(MockEventSource.instances).toHaveLength(4);
  });

  it("shows 'Connection lost' toast after maxRetries failures", async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useSSE({ url: "/api/test", onMessage, maxRetries: 3 })
    );

    // Exhaust all 3 retries
    await act(async () => {
      MockEventSource.instances[0].simulateError();
      vi.advanceTimersByTime(1000);
    });

    await act(async () => {
      MockEventSource.instances[1].simulateError();
      vi.advanceTimersByTime(2000);
    });

    await act(async () => {
      MockEventSource.instances[2].simulateError();
      vi.advanceTimersByTime(4000);
    });

    // 4th error — no more retries → show toast
    await act(async () => {
      MockEventSource.instances[3].simulateError();
    });

    expect(result.current.toast?.message).toBe("Connection lost");
    expect(result.current.toast?.type).toBe("error");
    expect(result.current.toast?.action?.label).toBe("Reconnect");
  });

  it("reconnect() resets retry count and creates a new EventSource", async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useSSE({ url: "/api/test", onMessage, maxRetries: 3 })
    );

    // Exhaust retries to get the toast
    await act(async () => {
      MockEventSource.instances[0].simulateError();
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      MockEventSource.instances[1].simulateError();
      vi.advanceTimersByTime(2000);
    });
    await act(async () => {
      MockEventSource.instances[2].simulateError();
      vi.advanceTimersByTime(4000);
    });
    await act(async () => {
      MockEventSource.instances[3].simulateError();
    });

    expect(result.current.toast).not.toBeNull();

    const countBefore = MockEventSource.instances.length;

    // Manually reconnect
    act(() => result.current.reconnect());

    expect(MockEventSource.instances.length).toBe(countBefore + 1);
    expect(result.current.toast).toBeNull();
  });

  it("dismissToast() clears the toast", async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useSSE({ url: "/api/test", onMessage, maxRetries: 3 })
    );

    // Exhaust retries
    await act(async () => {
      MockEventSource.instances[0].simulateError();
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      MockEventSource.instances[1].simulateError();
      vi.advanceTimersByTime(2000);
    });
    await act(async () => {
      MockEventSource.instances[2].simulateError();
      vi.advanceTimersByTime(4000);
    });
    await act(async () => {
      MockEventSource.instances[3].simulateError();
    });

    expect(result.current.toast).not.toBeNull();

    act(() => result.current.dismissToast());
    expect(result.current.toast).toBeNull();
  });

  it("calls onError callback on each error", async () => {
    const onMessage = vi.fn();
    const onError = vi.fn();
    renderHook(() =>
      useSSE({ url: "/api/test", onMessage, onError, maxRetries: 1 })
    );

    act(() => MockEventSource.instances[0].simulateError());
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
