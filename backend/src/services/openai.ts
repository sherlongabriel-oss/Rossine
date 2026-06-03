import OpenAI from "openai";
import { getOpenAiKey, isOpenAiConfigured } from "../config/loadSecrets";
import { getCompany, updateCompany } from "../storage/fileStore";
import { getCompanySettings } from "./companySettings";
import { DEFAULT_ERP_SYSTEM_PROMPT, DEFAULT_AI_MODEL } from "../constants/erpPrompt";
import { appendAiLog } from "../storage/aiLogs";

const FALLBACK_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];

let cachedClient: OpenAI | null = null;
let cachedKey = "";

export function ensureOpenAiKeyOnCompany() {
  const key = getOpenAiKey();
  if (!key) return;
  const company = getCompany();
  if (company && !company.openaiApiKey) {
    updateCompany({ openaiApiKey: key });
  }
}

function resolveApiKey(): string {
  ensureOpenAiKeyOnCompany();
  const key = getOpenAiKey() || getCompany()?.openaiApiKey;
  if (!key) throw new Error("Chave OpenAI nao encontrada em config/secrets.env");
  return key;
}

function getClient(): OpenAI {
  const apiKey = resolveApiKey();
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new OpenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

interface AiOptions {
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  instructions: string;
}

async function getAiOptions(companyId?: string): Promise<AiOptions> {
  const settings = companyId ? await getCompanySettings(companyId) : {};
  return {
    systemPrompt: settings.ai?.systemPrompt || DEFAULT_ERP_SYSTEM_PROMPT,
    model: settings.ai?.model || DEFAULT_AI_MODEL,
    temperature: settings.ai?.temperature ?? 0.3,
    maxTokens: settings.ai?.maxTokens ?? 500,
    instructions: settings.ai?.instructions || "",
  };
}

export async function testOpenAiConnection(companyId?: string) {
  if (!isOpenAiConfigured() && !getCompany()?.openaiApiKey) {
    return {
      ok: false,
      message: "Chave nao carregada. Verifique config/secrets.env ao lado do programa.",
    };
  }
  try {
    const text = await createCompletion(
      "Responda apenas: OK",
      20,
      companyId,
      "Voce e um assistente de teste."
    );
    if (text.toLowerCase().includes("ok")) {
      return { ok: true, message: "IA conectada e funcionando." };
    }
    return { ok: true, message: `IA respondeu: ${text.slice(0, 80)}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg.includes("401") ? "Chave invalida ou expirada." : msg };
  }
}

export async function getClientForCompany(_companyId?: string) {
  return getClient();
}

export async function createEmbedding(text: string, _companyId?: string) {
  const client = getClient();
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  appendAiLog({
    action: "embedding",
    inputPreview: text.slice(0, 120),
    outputPreview: "vetor gerado",
    success: true,
  });
  return response.data[0]?.embedding ?? [];
}

export async function createCompletion(
  userPrompt: string,
  maxTokens = 350,
  companyId?: string,
  systemPromptOverride?: string
): Promise<string> {
  const client = getClient();
  const options = await getAiOptions(companyId);

  let systemPrompt = systemPromptOverride || options.systemPrompt;
  if (options.instructions) {
    systemPrompt += `\n\nInstrucoes adicionais do administrador:\n${options.instructions}`;
  }

  const modelsToTry = [options.model, ...FALLBACK_MODELS.filter((m) => m !== options.model)];
  let lastError: unknown;

  for (const model of modelsToTry) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens || options.maxTokens,
        temperature: options.temperature,
      });
      const content = response.choices[0]?.message?.content || "";
      appendAiLog({
        action: "completion",
        inputPreview: userPrompt.slice(0, 150),
        outputPreview: content.slice(0, 150),
        success: true,
        detail: `modelo: ${model}`,
      });
      return content;
    } catch (e) {
      lastError = e;
    }
  }

  const errMsg = lastError instanceof Error ? lastError.message : "Erro OpenAI";
  appendAiLog({
    action: "completion",
    inputPreview: userPrompt.slice(0, 150),
    outputPreview: "",
    success: false,
    detail: errMsg,
  });
  throw lastError;
}
