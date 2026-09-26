import { request } from "./api";

export type AssistantConfig = { model: string; endpoint: "" | "chat_completions" | "responses"; virtualKeyId: string };
export type AssistantSettingsResponse = { revision: string; settings: AssistantConfig };
export type AssistantChoices = { models: { id: string; provider: string; name: string }[]; virtualKeys: { id: string; name: string }[] };
export type AssistantDraft = { id: string; name: string; creator: string; family: string; provider: string; nativeModel: string };
export type AssistantResponse = { proposal: { referenceId?: unknown; fields?: Record<string, unknown> }; source: "ai"; model: string; endpoint: string };

export const getAssistantSettings = () => request<AssistantSettingsResponse>("assistant/settings");
export const getAssistantChoices = (virtualKeyId = "") => request<AssistantChoices>(`assistant/models${virtualKeyId ? `?virtualKeyId=${encodeURIComponent(virtualKeyId)}` : ""}`);
export const canSaveAssistantSettings = (settings: AssistantConfig, revision: string, choices: AssistantChoices | null, discoveryBlocked: boolean) =>
  !!revision && (!settings.model && !settings.endpoint && !settings.virtualKeyId ||
    !discoveryBlocked && !!choices && !!settings.endpoint && choices.models.some(model => model.id === settings.model) && choices.virtualKeys.some(key => key.id === settings.virtualKeyId));
export const putAssistantSettings = (settings: AssistantConfig, revision: string) => request<AssistantSettingsResponse>("assistant/settings", {
  method: "PUT", headers: { "Content-Type": "application/json", "If-Match": revision }, body: JSON.stringify(settings),
});
export const suggestModel = (draft: AssistantDraft) => request<AssistantResponse>("assistant/suggest", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft }),
});
