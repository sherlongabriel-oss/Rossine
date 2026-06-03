export interface Company {
  id: string;
  name: string;
  slug: string;
  aiEnabled: boolean;
  openaiApiKey?: string;
  settingsJson?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  whatsappAccess: boolean;
  active: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  companyId: string;
  externalId: string;
  customerName?: string;
  customerPhone?: string;
  attendantName?: string;
  status: string;
  subject?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: string;
  body: string;
  messageType: string;
  direction: string;
  timestamp: string;
}

export interface KnowledgeItem {
  id: string;
  companyId: string;
  title: string;
  answer: string;
  category?: string;
  approved: boolean;
  confidence: number;
  sourceConversationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmbeddingRecord {
  id: string;
  companyId: string;
  sourceType: string;
  sourceId: string;
  content: string;
  vectorJson: string;
  createdAt: string;
}

export interface DataStore {
  company: Company | null;
  users: User[];
  conversations: Conversation[];
  knowledge: KnowledgeItem[];
  embeddings: EmbeddingRecord[];
}
