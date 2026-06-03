import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface Conversation {
  id: string;
  status: string;
  externalId: string;
  updatedAt: string;
  customer?: { name: string; phone: string };
  messages?: { body: string; direction: string }[];
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState<"OPEN" | "CLOSED" | "">("OPEN");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${filter}` : "";
      const data = await api<{ conversations: Conversation[] }>(`/api/conversations${q}`);
      setConversations(data.conversations);
    } catch {
      setConversations([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Conversas</h2>
        <button type="button" onClick={load} className="text-sm text-blue-600">
          Atualizar
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        {(["OPEN", "CLOSED", ""] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === s ? "bg-slate-900 text-white" : "bg-white border"
            }`}
          >
            {s === "OPEN" ? "Abertas" : s === "CLOSED" ? "Fechadas" : "Todas"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-center text-slate-500">Carregando...</p>
      ) : conversations.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed bg-white p-6 text-center text-slate-500">
          Nenhuma conversa. Conecte o WhatsApp ou use simulação em Configurações.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {conversations.map((c) => {
            const last = c.messages?.[0];
            return (
              <li key={c.id}>
                <Link
                  to={`/conversas/${c.id}`}
                  className="block rounded-2xl border bg-white p-4 shadow-sm active:bg-slate-50"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{c.customer?.name || "Cliente"}</span>
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${
                        c.status === "OPEN" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100"
                      }`}
                    >
                      {c.status === "OPEN" ? "Aberta" : "Fechada"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{c.customer?.phone}</p>
                  {last && (
                    <p className="mt-2 truncate text-sm text-slate-700">{last.body}</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
