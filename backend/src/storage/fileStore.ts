import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getDataDir, getMessagesDir } from "../config/paths";
import { DEFAULT_ERP_SYSTEM_PROMPT, DEFAULT_AI_MODEL } from "../constants/erpPrompt";
import { getOpenAiKey } from "../config/loadSecrets";
import {
  Company,
  Conversation,
  DataStore,
  EmbeddingRecord,
  KnowledgeItem,
  Message,
  User,
} from "./types";

const STORE_FILE = "dados.json";

function storePath() {
  return path.join(getDataDir(), STORE_FILE);
}

function readStore(): DataStore {
  const p = storePath();
  if (!fs.existsSync(p)) {
    return { company: null, users: [], conversations: [], knowledge: [], embeddings: [] };
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as DataStore;
}

function writeStore(data: DataStore) {
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), "utf8");
}

function messageTxtPath(conversationId: string) {
  return path.join(getMessagesDir(), `${conversationId}.txt`);
}

export function appendMessageToTxt(
  conversationId: string,
  direction: string,
  sender: string,
  body: string,
  timestamp: string
) {
  const line = `[${timestamp}] | ${direction} | ${sender} | ${body.replace(/\r?\n/g, " ")}\n`;
  fs.appendFileSync(messageTxtPath(conversationId), line, "utf8");
}

export function readMessagesFromTxt(conversationId: string): Message[] {
  const file = messageTxtPath(conversationId);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  return lines.map((line) => {
    const match = line.match(/^\[(.+?)\] \| (\w+) \| (.+?) \| (.+)$/);
    if (!match) {
      return {
        id: randomUUID(),
        conversationId,
        sender: "?",
        body: line,
        messageType: "text",
        direction: "customer",
        timestamp: new Date().toISOString(),
      };
    }
    return {
      id: randomUUID(),
      conversationId,
      sender: match[3],
      body: match[4],
      messageType: "text",
      direction: match[2],
      timestamp: match[1],
    };
  });
}

export async function initializeStore(): Promise<void> {
  const data = readStore();
  if (data.company && data.users.length > 0) return;

  const companyId = randomUUID();
  const now = new Date().toISOString();
  const defaultSettings = {
    ai: {
      systemPrompt: DEFAULT_ERP_SYSTEM_PROMPT,
      model: DEFAULT_AI_MODEL,
      temperature: 0.3,
      maxTokens: 400,
    },
    whatsapp: { provider: "webhook", webhookToken: "local-dev" },
    externalDb: null,
  };

  const openaiKey = getOpenAiKey();
  const company: Company = {
    id: companyId,
    name: "QI Support AI",
    slug: "qi-support",
    aiEnabled: true,
    openaiApiKey: openaiKey,
    settingsJson: JSON.stringify({
      ...defaultSettings,
      whatsapp: { provider: "local", botEnabled: false, connected: false, lastStatus: "iniciando" },
      server: { bindHost: "0.0.0.0", port: 4000 },
    }),
    createdAt: now,
    updatedAt: now,
  };

  const adminHash = await bcrypt.hash("admin", 10);
  const admin: User = {
    id: randomUUID(),
    companyId,
    name: "Administrador",
    email: "admin",
    passwordHash: adminHash,
    role: "ADMIN",
    whatsappAccess: true,
    active: true,
    createdAt: now,
  };

  writeStore({
    company,
    users: [admin],
    conversations: [],
    knowledge: [],
    embeddings: [],
  });
}

export function getCompany(): Company | null {
  return readStore().company;
}

export function updateCompany(patch: Partial<Company>): Company {
  const data = readStore();
  if (!data.company) throw new Error("Empresa não configurada");
  data.company = { ...data.company, ...patch, updatedAt: new Date().toISOString() };
  writeStore(data);
  return data.company;
}

export function findUserByLogin(login: string): (User & { company: Company }) | null {
  const data = readStore();
  if (!data.company) return null;
  const normalized = login.trim().toLowerCase();
  const user = data.users.find(
    (u) => u.email.toLowerCase() === normalized || u.email.toLowerCase() === `${normalized}@local`
  );
  if (!user || !user.active) return null;
  return { ...user, company: data.company };
}

export function getUserById(id: string): (User & { company: Company }) | null {
  const data = readStore();
  if (!data.company) return null;
  const user = data.users.find((u) => u.id === id);
  if (!user) return null;
  return { ...user, company: data.company };
}

export function listUsers(companyId: string): User[] {
  return readStore().users.filter((u) => u.companyId === companyId);
}

export async function createUser(
  companyId: string,
  input: { name: string; email: string; password: string; role: string; whatsappAccess?: boolean }
): Promise<User> {
  const data = readStore();
  const exists = data.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase());
  if (exists) throw new Error("E-mail/login já cadastrado");

  const user: User = {
    id: randomUUID(),
    companyId,
    name: input.name,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 10),
    role: input.role,
    whatsappAccess: input.whatsappAccess ?? true,
    active: true,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  writeStore(data);
  return user;
}

export function listConversations(companyId: string, status?: string): Conversation[] {
  let list = readStore().conversations.filter((c) => c.companyId === companyId);
  if (status) list = list.filter((c) => c.status === status);
  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getConversationById(companyId: string, id: string): Conversation | null {
  return readStore().conversations.find((c) => c.companyId === companyId && c.id === id) || null;
}

export function getConversationByExternalId(externalId: string): Conversation | null {
  return readStore().conversations.find((c) => c.externalId === externalId) || null;
}

export function upsertConversation(input: {
  companyId: string;
  externalId: string;
  customerName?: string;
  customerPhone?: string;
  attendantName?: string;
  status?: string;
}): Conversation {
  const data = readStore();
  const now = new Date().toISOString();
  let conv = data.conversations.find((c) => c.externalId === input.externalId);
  if (conv) {
    conv.customerName = input.customerName ?? conv.customerName;
    conv.customerPhone = input.customerPhone ?? conv.customerPhone;
    conv.attendantName = input.attendantName ?? conv.attendantName;
    conv.status = input.status ?? conv.status;
    conv.updatedAt = now;
  } else {
    conv = {
      id: randomUUID(),
      companyId: input.companyId,
      externalId: input.externalId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      attendantName: input.attendantName,
      status: input.status || "OPEN",
      createdAt: now,
      updatedAt: now,
    };
    data.conversations.push(conv);
  }
  writeStore(data);
  return conv;
}

export function addMessage(input: {
  conversationId: string;
  sender: string;
  body: string;
  direction: string;
  messageType?: string;
  timestamp?: string;
}): Message {
  const ts = input.timestamp || new Date().toISOString();
  const msg: Message = {
    id: randomUUID(),
    conversationId: input.conversationId,
    sender: input.sender,
    body: input.body,
    messageType: input.messageType || "text",
    direction: input.direction,
    timestamp: ts,
  };
  appendMessageToTxt(input.conversationId, input.direction, input.sender, input.body, ts);

  const data = readStore();
  const conv = data.conversations.find((c) => c.id === input.conversationId);
  if (conv) conv.updatedAt = ts;
  writeStore(data);
  return msg;
}

export function updateConversationMeta(
  companyId: string,
  id: string,
  patch: Partial<Conversation>
): boolean {
  const data = readStore();
  const conv = data.conversations.find((c) => c.id === id && c.companyId === companyId);
  if (!conv) return false;
  Object.assign(conv, patch, { updatedAt: new Date().toISOString() });
  writeStore(data);
  return true;
}

export function closeConversation(companyId: string, id: string): boolean {
  const data = readStore();
  const conv = data.conversations.find((c) => c.id === id && c.companyId === companyId);
  if (!conv) return false;
  conv.status = "CLOSED";
  conv.updatedAt = new Date().toISOString();
  writeStore(data);
  return true;
}

export function listKnowledge(companyId: string, search?: string): KnowledgeItem[] {
  let items = readStore().knowledge.filter((k) => k.companyId === companyId);
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (k) => k.title.toLowerCase().includes(q) || k.answer.toLowerCase().includes(q)
    );
  }
  return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function createKnowledge(
  companyId: string,
  input: { title: string; answer: string; approved?: boolean; category?: string }
): KnowledgeItem {
  const data = readStore();
  const now = new Date().toISOString();
  const item: KnowledgeItem = {
    id: randomUUID(),
    companyId,
    title: input.title,
    answer: input.answer,
    category: input.category,
    approved: input.approved ?? false,
    confidence: 0.7,
    createdAt: now,
    updatedAt: now,
  };
  data.knowledge.push(item);
  writeStore(data);
  return item;
}

export function updateKnowledge(
  companyId: string,
  id: string,
  patch: Partial<KnowledgeItem>
): boolean {
  const data = readStore();
  const item = data.knowledge.find((k) => k.id === id && k.companyId === companyId);
  if (!item) return false;
  Object.assign(item, patch, { updatedAt: new Date().toISOString() });
  writeStore(data);
  return true;
}

export function deleteKnowledge(companyId: string, id: string): void {
  const data = readStore();
  data.knowledge = data.knowledge.filter((k) => !(k.id === id && k.companyId === companyId));
  data.embeddings = data.embeddings.filter((e) => e.sourceId !== id);
  writeStore(data);
}

export function addEmbedding(record: Omit<EmbeddingRecord, "id" | "createdAt">): EmbeddingRecord {
  const data = readStore();
  const emb: EmbeddingRecord = {
    ...record,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  data.embeddings.push(emb);
  writeStore(data);
  return emb;
}

export function listEmbeddings(companyId: string): EmbeddingRecord[] {
  return readStore().embeddings.filter((e) => e.companyId === companyId);
}

export async function setupCompany(input: {
  companyName: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}) {
  const data = readStore();
  if (data.company) throw new Error("Empresa já configurada. Exclua data/dados.json para refazer.");

  const companyId = randomUUID();
  const now = new Date().toISOString();
  const company: Company = {
    id: companyId,
    name: input.companyName,
    slug: input.slug,
    aiEnabled: false,
    settingsJson: JSON.stringify({
      ai: { systemPrompt: DEFAULT_ERP_SYSTEM_PROMPT, model: DEFAULT_AI_MODEL, temperature: 0.3, maxTokens: 400 },
      whatsapp: { provider: "webhook" },
    }),
    createdAt: now,
    updatedAt: now,
  };

  const admin: User = {
    id: randomUUID(),
    companyId,
    name: input.adminName,
    email: input.adminEmail,
    passwordHash: await bcrypt.hash(input.adminPassword, 10),
    role: "ADMIN",
    whatsappAccess: true,
    active: true,
    createdAt: now,
  };

  writeStore({ company, users: [admin], conversations: [], knowledge: [], embeddings: [] });
  return { company, admin };
}

export { bcrypt };
