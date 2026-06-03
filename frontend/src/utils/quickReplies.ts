export interface QuickReply {
  key: string;
  text: string;
}

const STORAGE_KEY = "qi_quick_replies";

const DEFAULT_REPLIES: QuickReply[] = [
  { key: "btb", text: "Boa tarde! Tudo bem?" },
  { key: "btvc", text: "Boa tarde! Tudo bem e com voce?" },
  { key: "bdtb", text: "Bom dia! Tudo bem?" },
  { key: "bdvc", text: "Bom dia! Tudo bem e com voce?" },
  { key: "cl", text: "Claro, so um instante" },
  { key: "pea", text: "Precisando, estamos a disposicao." },
  { key: "prec", text: "Precisando estamos a disposicao!" },
  { key: "pn", text: "Por nada!" },
  { key: "vui", text: "Vou verificar, um instante" },
];

export function loadQuickReplies(): QuickReply[] {
  if (typeof window === "undefined") return DEFAULT_REPLIES;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_REPLIES;
  try {
    const parsed = JSON.parse(raw) as QuickReply[];
    const normalized = normalizeQuickReplies(parsed);
    return normalized.length > 0 ? normalized : DEFAULT_REPLIES;
  } catch {
    return DEFAULT_REPLIES;
  }
}

export function saveQuickReplies(list: QuickReply[]) {
  if (typeof window === "undefined") return;
  const normalized = normalizeQuickReplies(list);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function normalizeQuickReplies(list: QuickReply[]): QuickReply[] {
  const seen = new Set<string>();
  return list
    .map((r) => ({
      key: String(r.key || "").trim().toLowerCase(),
      text: String(r.text || "").trim(),
    }))
    .filter((r) => r.key && r.text)
    .filter((r) => {
      if (seen.has(r.key)) return false;
      seen.add(r.key);
      return true;
    });
}
