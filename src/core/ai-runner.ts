import { spawn } from "node:child_process";
import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { AIProviderConfig, AIProviderType } from "./settings";

const DEFAULT_MODELS: Record<AIProviderType, string> = {
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-pro",
  openai: "gpt-4o",
  "openai-compatible": "gpt-4o",
};

function buildModel(provider: AIProviderConfig) {
  const modelId = provider.model ?? DEFAULT_MODELS[provider.type];
  switch (provider.type) {
    case "anthropic":
      return createAnthropic({ apiKey: provider.apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: provider.apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey: provider.apiKey }).chat(modelId);
    case "openai-compatible":
      return createOpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL }).chat(modelId);
  }
}

/**
 * Stream AI response via Vercel AI SDK if provider given, else fall back to claude CLI.
 * Calls onChunk for each text chunk, onDone when finished, onError on failure.
 */
export function streamAIResponse(
  prompt: string,
  provider: AIProviderConfig | null,
  repoRoot: string,
  send: (data: object) => void,
  finish: () => void
): void {
  if (!provider) {
    // Fallback: claude CLI
    const proc = spawn("claude", ["--print", "--output-format", "stream-json", "--verbose"], {
      cwd: repoRoot,
      env: { ...process.env },
    });

    proc.stdin.write(prompt);
    proc.stdin.end();

    let buffer = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "assistant") {
            for (const block of event.message?.content ?? []) {
              if (block.type === "text") send({ type: "text", text: block.text });
            }
          }
        } catch { /* skip */ }
      }
    });

    proc.stderr.on("data", (_chunk: Buffer) => {});
    proc.on("close", finish);
    proc.on("error", (err: Error) => {
      send({ type: "error", error: err.message });
      finish();
    });
    return;
  }

  // Vercel AI SDK path
  const model = buildModel(provider);
  (async () => {
    try {
      const result = await streamText({ model, prompt, maxRetries: 0 });
      for await (const chunk of result.textStream) {
        send({ type: "text", text: chunk });
      }
    } catch (err) {
      // Extract clean message — Vercel AI SDK errors are verbose objects
      const e = err as any;
      const msg = e?.responseBody
        ? (() => { try { return JSON.parse(e.responseBody)?.error?.message ?? e.message; } catch { return e.message; } })()
        : (e?.message ?? String(err));
      send({ type: "error", error: msg });
    } finally {
      finish();
    }
  })();
}
