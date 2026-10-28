import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, asNumber, parseObject } from "../utils.js";
import { guardedHttpAdapterFetch } from "./remote-fetch.js";

export function parseStructuredHttpResult(responseText: string): Record<string, unknown> | undefined {
  if (!responseText.trim()) return undefined;
  if (responseText.length > 64 * 1024) {
    throw new Error("HTTP adapter response exceeds the 64 KiB result limit");
  }
  try {
    const parsed = JSON.parse(responseText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, runId, agent, context } = ctx;
  const url = asString(config.url, "");
  if (!url) throw new Error("HTTP adapter missing url");

  const method = asString(config.method, "POST");
  const timeoutMs = asNumber(config.timeoutMs, 0);
  const headers = parseObject(config.headers) as Record<string, string>;
  const bearerTokenEnv = asString(config.bearerTokenEnv, "");
  if (bearerTokenEnv && !/^[A-Z_][A-Z0-9_]*$/.test(bearerTokenEnv)) {
    throw new Error("HTTP adapter bearerTokenEnv must be an uppercase environment variable name");
  }
  const bearerToken = bearerTokenEnv ? process.env[bearerTokenEnv]?.trim() : "";
  const payloadTemplate = parseObject(config.payloadTemplate);
  const body = {
    ...payloadTemplate,
    agentId: agent.id,
    runId,
    context,
    connectionInstructions: context.connectionInstructions ?? null,
    ...(ctx.runtimeTools ? { paperclipRuntimeTools: ctx.runtimeTools } : {}),
  };

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    // HTTP adapters have no child-process spawn event. Signal immediately
    // before starting the remote request so dispatch gates can release without
    // waiting for the endpoint to respond.
    ctx.onDispatch?.();
    const res = await guardedHttpAdapterFetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
        ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
      },
      body: JSON.stringify(body),
      ...(timer ? { signal: controller.signal } : {}),
    });

    if (!res.ok) {
      throw new Error(`HTTP invoke failed with status ${res.status}`);
    }

    const resultJson = parseStructuredHttpResult(await res.text());

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: `HTTP ${method} ${url}`,
      ...(resultJson ? { resultJson } : {}),
    };
  } catch (err) {
    if (timer && err instanceof Error && err.name === "AbortError") {
      return {
        exitCode: null,
        signal: null,
        timedOut: true,
        errorMessage: `HTTP ${method} ${url} timed out after ${timeoutMs}ms`,
        errorCode: "timeout",
      };
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
