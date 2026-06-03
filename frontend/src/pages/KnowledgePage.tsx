import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

interface KnowledgeItem {
  id: string;
  title: string;
  answer: string;
  approved: boolean;
  confidence: number;
  category?: { name: string };
}

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [answer, setAnswer] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    const data = await api<{ items: KnowledgeItem[] }>(`/api/knowledge${q}`);
    setItems(data.items);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !answer) return;
    await api("/api/knowledge", {
      method: "POST",
      body: JSON.stringify({ title, answer, approved: true }),
    });
    setTitle("");
    setAnswer("");
    load();
  };

  const searchAi = async () => {
    setLoading(true);
    try {
      const data = await api<{ answer: string }>("/api/ai/search", {
        method: "POST",
        body: JSON.stringify({ question: aiQuestion }),
      });
      setAiAnswer(data.answer);
    } catch (err: unknown) {
      setAiAnswer(err instanceof Error ? err.message : "Erro");
    }
    setLoading(false);
  };

  const toggleApprove = async (item: KnowledgeItem) => {
    await api(`/api/knowledge/${item.id}`, {
      method: "PUT",
      body: JSON.stringify({ approved: !item.approved }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Base de conhecimento</h2>

      <div className="rounded-2xl border bg-white p-4">
        <h3 className="font-medium">Consultar IA fiscal</h3>
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded-xl border p-2 text-sm"
            placeholder="Ex: CFOP 5102 com ST em MG..."
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
          />
          <button
            type="button"
            onClick={searchAi}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 text-sm text-white"
          >
            Buscar
          </button>
        </div>
        {aiAnswer && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm whitespace-pre-wrap">{aiAnswer}</div>
        )}
      </div>

      <form onSubmit={create} className="rounded-2xl border bg-white p-4 space-y-2">
        <h3 className="font-medium">Novo artigo</h3>
        <input className="w-full rounded-xl border p-2 text-sm" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full rounded-xl border p-2 text-sm" rows={3} placeholder="Resposta" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">
          Salvar aprovado
        </button>
      </form>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border p-2 text-sm"
          placeholder="Filtrar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" onClick={load} className="rounded-xl border px-4 text-sm">
          Filtrar
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border bg-white p-4">
            <div className="flex justify-between gap-2">
              <span className="font-medium">{item.title}</span>
              <button
                type="button"
                onClick={() => toggleApprove(item)}
                className={`text-xs rounded-full px-2 py-0.5 ${
                  item.approved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100"
                }`}
              >
                {item.approved ? "Aprovado" : "Pendente"}
              </button>
            </div>
            {item.category && <p className="text-xs text-slate-500">{item.category.name}</p>}
            <p className="mt-2 text-sm text-slate-700 line-clamp-3">{item.answer}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
