import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { loadQuickReplies } from "../utils/quickReplies";

interface Message {
  id: string;
  body: string;
  direction: string;
  sender: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  status: string;
  customer?: { name: string; phone: string };
  messages: Message[];
}


export default function ConversationChatPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [text, setText] = useState("");
  const [aiText, setAiText] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showReplies, setShowReplies] = useState(false);

  const load = async () => {
    if (!id) return;
    const data = await api<{ conversation: Conversation }>(`/api/conversations/${id}`);
    setConversation(data.conversation);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  useEffect(() => {
    setShowReplies(text.includes("/"));
  }, [text]);

  const getReplyToken = (value: string) => {
    const last = value.split(/\s+/).pop() || "";
    if (!last.startsWith("/")) return "";
    return last.slice(1).toLowerCase();
  };

  const replyToken = getReplyToken(text);
  const quickReplies = loadQuickReplies();
  const filteredReplies = replyToken
    ? quickReplies.filter((r) => r.key.startsWith(replyToken))
    : quickReplies.slice(0, 6);

  const applyQuickReply = (replyText: string) => {
    const parts = text.split(/\s+/);
    if (parts.length === 0) {
      setText(replyText);
      return;
    }
    const last = parts[parts.length - 1] || "";
    if (last.startsWith("/")) {
      parts[parts.length - 1] = replyText;
      setText(parts.join(" "));
    } else {
      setText(text.trim() ? `${text} ${replyText}` : replyText);
    }
    setShowReplies(false);
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !id) return;
    setLoading(true);
    try {
      await api(`/api/conversations/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setText("");
      await load();
    } finally {
      setLoading(false);
    }
  };

  const askAi = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api<{ answer: string }>(`/api/conversations/${id}/ai-assist`, {
        method: "POST",
        body: JSON.stringify({ question: aiText || "Sugira resposta para o cliente" }),
      });
      setText(data.answer);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "IA indisponível");
    }
    setLoading(false);
  };

  const closeChat = async () => {
    if (!id || !confirm("Encerrar esta conversa?")) return;
    await api(`/api/conversations/${id}/close`, { method: "PATCH" });
    await load();
  };

  if (!conversation) {
    return <p className="text-center text-slate-500">Carregando conversa...</p>;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-2 flex items-center gap-2">
        <Link to="/conversas" className="text-blue-600 text-sm">
          ← Voltar
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="truncate font-semibold">{conversation.customer?.name || "Cliente"}</h2>
          <p className="text-xs text-slate-500">{conversation.customer?.phone}</p>
        </div>
        {conversation.status === "OPEN" && (
          <button type="button" onClick={closeChat} className="text-xs text-red-600">
            Encerrar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl bg-slate-200/50 p-3 space-y-2">
        {conversation.messages.map((m) => {
          const isAttendant = m.direction === "attendant";
          return (
            <div key={m.id} className={`flex ${isAttendant ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  isAttendant ? "bg-blue-600 text-white" : "bg-white text-slate-900 shadow-sm"
                }`}
              >
                <p className="text-[10px] opacity-70">{m.sender}</p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="mt-2 rounded-xl border bg-amber-50 p-2">
        <p className="text-xs font-medium text-amber-900">Assistente ERP (CFOP/ICMS)</p>
        <div className="mt-1 flex gap-2">
          <input
            className="flex-1 rounded-lg border p-2 text-sm"
            placeholder="Pergunta à IA..."
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
          />
          <button
            type="button"
            onClick={askAi}
            disabled={loading}
            className="rounded-lg bg-amber-600 px-3 text-sm text-white"
          >
            IA
          </button>
        </div>
      </div>

      {conversation.status === "OPEN" && (
        <form onSubmit={send} className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <textarea
              className="w-full rounded-xl border p-3 text-sm resize-none"
              rows={2}
              placeholder={`Responder como ${user?.name}...`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setShowReplies(text.includes("/"))}
              onBlur={() => setTimeout(() => setShowReplies(false), 150)}
            />
            {showReplies && filteredReplies.length > 0 && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 rounded-xl border bg-white p-2 shadow-lg">
                <p className="px-2 pb-1 text-[10px] uppercase text-slate-400">Atalhos</p>
                <div className="max-h-40 overflow-y-auto">
                  {filteredReplies.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => applyQuickReply(r.text)}
                      className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <span className="font-mono text-xs text-slate-500">/{r.key}</span>
                      <span className="ml-2 text-slate-800">{r.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="self-end rounded-xl bg-slate-900 px-4 py-3 text-white disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}
