import { configFieldsForSection } from "../config-sections";
import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  help,
} from "../../components/agent-config-primitives";
import { PayloadTemplateJsonField } from "../runtime-json-fields";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function HttpConfigFields({
  section,
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return configFieldsForSection(section, (
    <div className="space-y-4">
      <Field label="Webhook URL" hint={help.webhookUrl}>
        <DraftInput
          value={
            isCreate
              ? values!.url
              : eff("adapterConfig", "url", String(config.url ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ url: v })
              : mark("adapterConfig", "url", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="https://..."
        />
      </Field>
      <PayloadTemplateJsonField isCreate={isCreate} values={values} set={set} config={config} mark={mark} />
      <Field label="Extra headers JSON" hint="Optional JSON object merged into the HTTP request headers. Use this for a bearer token or an internal bridge token.">
        <DraftInput
          value={isCreate ? values?.headersJson ?? "" : JSON.stringify(config.headers ?? {}, null, 2)}
          onCommit={(value) => {
            if (isCreate) {
              set?.({ headersJson: value });
              return;
            }
            const trimmed = value.trim();
            if (!trimmed) {
              mark("adapterConfig", "headers", undefined);
              return;
            }
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) mark("adapterConfig", "headers", parsed);
            } catch {
              // Keep invalid drafts local until the JSON is valid.
            }
          }}
          immediate
          className={inputClass}
          placeholder='{"Authorization":"Bearer …"}'
        />
      </Field>
      <Field label="Bearer token environment variable" hint="Optional uppercase environment variable name. Paperclip reads the token at run time and never stores its value in the agent configuration.">
        <DraftInput
          value={isCreate ? values?.bearerTokenEnv ?? "" : String(config.bearerTokenEnv ?? "")}
          onCommit={(value) =>
            isCreate
              ? set?.({ bearerTokenEnv: value })
              : mark("adapterConfig", "bearerTokenEnv", value.trim() || undefined)
          }
          immediate
          className={inputClass}
          placeholder="AGENT_ORCHESTRATOR_LOCAL_TOKEN"
        />
      </Field>
    </div>
  ));
}
