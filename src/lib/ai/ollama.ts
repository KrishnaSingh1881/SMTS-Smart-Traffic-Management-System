/**
 * Ollama REST client
 * Requirements: 3.1, 10.3
 *
 * Provides a simple interface to the Ollama API for generating AI responses.
 * Implements graceful degradation: returns null on failure to allow the system
 * to continue operating in manual mode.
 */

import { emitSSE } from "@/lib/sse/emitter";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama2";
const OLLAMA_TIMEOUT_MS = 10000; // 10 seconds

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

/**
 * Generate a response from Ollama AI.
 * Returns null on failure (network error, timeout, invalid response).
 * Emits system:ai-unavailable SSE event on failure.
 */
export async function ollamaGenerate(
  prompt: string
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
      } satisfies OllamaGenerateRequest),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[Ollama] HTTP error ${response.status}: ${response.statusText}`
      );
      emitSSE("system:ai-unavailable", {
        reason: `HTTP ${response.status}`,
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    if (!data.response || typeof data.response !== "string") {
      console.error("[Ollama] Invalid response format:", data);
      emitSSE("system:ai-unavailable", {
        reason: "Invalid response format",
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    return data.response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.error("[Ollama] Request timeout");
      } else {
        console.error("[Ollama] Network error:", error.message);
      }
    } else {
      console.error("[Ollama] Unknown error:", error);
    }

    emitSSE("system:ai-unavailable", {
      reason: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });

    return null;
  }
}
