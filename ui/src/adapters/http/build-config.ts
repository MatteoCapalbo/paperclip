import type { CreateConfigValues } from "../../components/AgentConfigForm";

export function buildHttpConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.url) ac.url = v.url;
  ac.method = "POST";
  ac.timeoutMs = 15000;
  for (const [key, raw] of [["headers", v.headersJson], ["payloadTemplate", v.payloadTemplateJson]] as const) {
    if (!raw?.trim()) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ac[key] = parsed;
    } catch {
      // Keep invalid drafts out of the persisted adapter configuration.
    }
  }
  return ac;
}
