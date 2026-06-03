import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { loadQuickReplies, saveQuickReplies, normalizeQuickReplies, QuickReply } from "../utils/quickReplies";

type Tab = "geral" | "servidor" | "armazenamento" | "whatsapp" | "ia" | "logs" | "banco";

interface ConnInfo {
  publicUrl?: string;
  localUrls?: string[];
  webhookUrl?: string;
  evolutionWebhookUrl?: string;
  storagePath?: string;
  openaiConfigured?: boolean;
}

interface AiLog {
  id: string;
  timestamp: string;
  action: string;
  inputPreview: string;
  outputPreview: string;
  success: boolean;
  detail?: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [tab, setTab] = useState<Tab>("geral");
  const [message, setMessage] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [botEnabled, setBotEnabled] = useState(false);
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const [aiApiKey, setAiApiKey] = useState("");
  const [conn, setConn] = useState<ConnInfo>({});
  const [waConnected, setWaConnected] = useState(false);
  const [waStatus, setWaStatus] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [qrKey, setQrKey] = useState("");
  const [qrText, setQrText] = useState("");
  const [importName, setImportName] = useState("Cliente");
  const [importPhone, setImportPhone] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [server, setServer] = useState({ publicUrl: "", port: 4000, bindHost: "0.0.0.0" });
  const [storage, setStorage] = useState({ mode: "files", dataPath: "data/" });
  const [db, setDb] = useState({ type: "postgresql", host: "", port: 5432, database: "", user: "", password: "", enabled: false });
  const [ai, setAi] = useState({ systemPrompt: "", model: "gpt-4o-mini", temperature: 0.3, maxTokens: 500, instructions: "" });
  const [wa, setWa] = useState({ provider: "evolution", apiUrl: "", instance: "qi-support", apiKey: "", webhookToken: "" });
  const [simPhone, setSimPhone] = useState("5511999999999");
  const [simMessage, setSimMessage] = useState("Dúvida sobre CFOP 5102");

  const notify = (text: string, ok = true) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 5000);
  };

  const load = async () => {
    const data = await api<{
      company: { id: string };
      settings: {
        aiEnabled: boolean;
        botEnabled: boolean;
        openaiConfigured: boolean;
        server: typeof server;
        storage: typeof storage;
        externalDb: typeof db | null;
        ai: typeof ai;
        whatsapp: typeof wa & { connected?: boolean; lastStatus?: string };
      };
    }>("/api/settings");
    setCompanyId(data.company.id);
    setAiEnabled(data.settings.aiEnabled);
    setBotEnabled(data.settings.botEnabled);
    setOpenaiConfigured(data.settings.openaiConfigured);
    if (data.settings.server) setServer((s) => ({ ...s, ...data.settings.server }));
    if (data.settings.storage) setStorage((s) => ({ ...s, ...data.settings.storage }));
    if (data.settings.externalDb) setDb((d) => ({ ...d, ...data.settings.externalDb }));
    if (data.settings.ai) setAi((a) => ({ ...a, ...data.settings.ai }));
    if (data.settings.whatsapp) {
      setWa((w) => ({ ...w, ...data.settings.whatsapp }));
      setWaConnected(!!data.settings.whatsapp.connected);
      setWaStatus(data.settings.whatsapp.lastStatus || "");
    }
    const c = await api<ConnInfo>("/api/settings/connection-info");
    setConn(c);
    if (!server.publicUrl && c.publicUrl) setServer((s) => ({ ...s, publicUrl: c.publicUrl || "" }));
    const logData = await api<{ logs: AiLog[] }>("/api/settings/ai-logs");
    setLogs(logData.logs);
  };

  useEffect(() => {
    load();
    setQuickReplies(loadQuickReplies());
  }, []);

  const persistQuickReplies = (list: QuickReply[]) => {
    const normalized = normalizeQuickReplies(list);
    setQuickReplies(normalized);
    saveQuickReplies(normalized);
  };

  const addQuickReply = (e: FormEvent) => {
    e.preventDefault();
    const next = [...quickReplies, { key: qrKey, text: qrText }];
    persistQuickReplies(next);
    setQrKey("");
    setQrText("");
  };

  const removeQuickReply = (key: string) => {
    const next = quickReplies.filter((r) => r.key !== key);
    persistQuickReplies(next);
  };

  const toggleAi = async () => {
    const data = await api<{ aiEnabled: boolean }>("/api/settings/ai", {
      method: "PATCH",
      body: JSON.stringify({ enabled: !aiEnabled }),
    });
    setAiEnabled(data.aiEnabled);
    notify(`IA ${data.aiEnabled ? "ativada" : "desativada"}`);
  };

  const toggleBot = async () => {
    const data = await api<{ botEnabled: boolean }>("/api/settings/bot", {
      method: "PATCH",
      body: JSON.stringify({ enabled: !botEnabled }),
    });
    setBotEnabled(data.botEnabled);
    notify(`Bot WhatsApp ${data.botEnabled ? "ativado" : "desativado"}`);
  };

  const testAi = async () => {
    const r = await api<{ ok: boolean; message: string }>("/api/settings/ai/test", { method: "POST" });
    notify(r.message, r.ok);
    load();
  };

  const saveServer = async (e: FormEvent) => {
    e.preventDefault();
    await api("/api/settings/server", { method: "PATCH", body: JSON.stringify(server) });
    notify("Servidor / URL pública salvo");
    load();
  };

  const saveStorage = async (e: FormEvent) => {
    e.preventDefault();
    await api("/api/settings/storage", { method: "PATCH", body: JSON.stringify(storage) });
    notify("Armazenamento salvo");
  };

  const saveAi = async (e: FormEvent) => {
    e.preventDefault();
    const payload = { ...ai, apiKey: aiApiKey ? aiApiKey : undefined };
    await api("/api/settings/ai-config", { method: "PATCH", body: JSON.stringify(payload) });
    notify("Prompt e instruções da IA salvos");
    setAiApiKey("");
  };

  const saveWa = async (e: FormEvent) => {
    e.preventDefault();
    await api("/api/settings/whatsapp", { method: "PATCH", body: JSON.stringify(wa) });
    notify("WhatsApp salvo");
  };

  const connectWa = async () => {
    await saveWa({ preventDefault: () => {} } as FormEvent);
    const r = await api<{ qrcode?: string; webhookUrl?: string; pairingCode?: string }>("/api/settings/whatsapp/connect", {
      method: "POST",
    });
    if (r.qrcode) setQrCode(r.qrcode.startsWith("data:") ? r.qrcode : `data:image/png;base64,${r.qrcode}`);
    notify(r.pairingCode ? `Código: ${r.pairingCode}` : "Conexão iniciada — escaneie o QR Code");
  };

  const refreshWaStatus = async () => {
    const s = await api<{ state: string; connected: boolean }>("/api/settings/whatsapp/status");
    setWaConnected(s.connected);
    setWaStatus(s.state);
    if (!s.connected) {
      const q = await api<{ qrcode?: string }>("/api/settings/whatsapp/qrcode");
      if (q.qrcode) setQrCode(q.qrcode.startsWith("data:") ? q.qrcode : `data:image/png;base64,${q.qrcode}`);
    } else setQrCode(null);
  };

  const simulate = async () => {
    await api("/api/bot/simulate", {
      method: "POST",
      body: JSON.stringify({ companyId, customerPhone: simPhone, customerName: "Cliente", message: simMessage }),
    });
    notify("Mensagem teste registrada em Conversas");
  };

  const importWhatsapp = async (e: FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      notify("Selecione um arquivo .txt", false);
      return;
    }
    setImporting(true);
    try {
      const text = await importFile.text();
      const result = await api<{ imported: number }>("/api/settings/whatsapp/import", {
        method: "POST",
        body: JSON.stringify({
          text,
          customerName: importName,
          customerPhone: importPhone,
        }),
      });
      notify(`Historico importado: ${result.imported} mensagens`);
      setImportFile(null);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Falha ao importar", false);
    } finally {
      setImporting(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "geral", label: "Geral" },
    { id: "servidor", label: "Servidor / Rede" },
    { id: "armazenamento", label: "Armazenamento" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "ia", label: "Prompt IA" },
    { id: "logs", label: "Logs IA" },
    { id: "banco", label: "Banco (futuro)" },
  ];

  return (
    <div className="pb-8">
      <h2 className="text-xl font-bold text-slate-900">Configurações</h2>
      <p className="text-sm text-slate-500">Painel administrativo — multinacional ready</p>

      {message && (
        <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
          {message}
        </div>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              tab === t.id ? "bg-blue-700 text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "geral" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">ID empresa</p>
            <p className="font-mono text-sm break-all">{companyId}</p>
          </div>

          <div className="rounded-2xl border bg-white p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">Inteligência Artificial (ERP)</p>
              <p className="text-xs text-slate-500">CFOP, ICMS, NF-e, SPED</p>
            </div>
            <button
              type="button"
              onClick={toggleAi}
              className={`rounded-full px-4 py-2 text-sm font-medium text-white ${aiEnabled ? "bg-red-600" : "bg-emerald-600"}`}
            >
              {aiEnabled ? "Desativar IA" : "Ativar IA"}
            </button>
          </div>

          <div className="rounded-2xl border bg-white p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">Bot WhatsApp</p>
              <p className="text-xs text-slate-500">Respostas automáticas quando conectado</p>
            </div>
            <button
              type="button"
              onClick={toggleBot}
              className={`rounded-full px-4 py-2 text-sm font-medium text-white ${botEnabled ? "bg-red-600" : "bg-emerald-600"}`}
            >
              {botEnabled ? "Desativar Bot" : "Ativar Bot"}
            </button>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <p className="font-medium">Status OpenAI</p>
            <p className={`mt-1 text-sm ${openaiConfigured ? "text-emerald-600" : "text-red-600"}`}>
              {openaiConfigured ? "✓ Chave configurada pelo sistema (secrets.env)" : "✗ Chave não detectada"}
            </p>
            <button type="button" onClick={testAi} className="mt-3 rounded-xl bg-blue-700 px-4 py-2 text-sm text-white">
              Testar conexão IA
            </button>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <p className="font-medium">Respostas rápidas (atalhos "/")</p>
            <p className="text-xs text-slate-500">Use no chat: /btb, /cl, /vui etc.</p>

            <form onSubmit={addQuickReply} className="mt-3 grid gap-2 sm:grid-cols-3">
              <input
                className="rounded-xl border p-2 text-sm"
                placeholder="atalho (ex: btb)"
                value={qrKey}
                onChange={(e) => setQrKey(e.target.value)}
              />
              <input
                className="rounded-xl border p-2 text-sm sm:col-span-2"
                placeholder="texto da resposta"
                value={qrText}
                onChange={(e) => setQrText(e.target.value)}
              />
              <button
                type="submit"
                className="sm:col-span-3 rounded-xl bg-slate-900 py-2 text-sm text-white"
              >
                Adicionar atalho
              </button>
            </form>

            {quickReplies.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nenhum atalho cadastrado.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {quickReplies.map((r) => (
                  <div key={r.key} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <span className="font-mono text-xs text-slate-500">/{r.key}</span>
                      <span className="ml-2 text-slate-800">{r.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuickReply(r.key)}
                      className="text-xs text-red-600"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "servidor" && isAdmin && (
        <form onSubmit={saveServer} className="mt-4 space-y-3 rounded-2xl border bg-white p-4">
          <p className="text-sm text-slate-600">
            O sistema escuta em todas as interfaces (0.0.0.0). Use a URL pública para acesso na internet ou rede da empresa.
          </p>
          {conn.localUrls?.map((u) => (
            <div key={u} className="rounded-lg bg-slate-50 p-2 text-sm font-mono break-all">
              {u}
            </div>
          ))}
          <label className="block text-sm font-medium">URL pública (domínio ou IP)</label>
          <input
            className="w-full rounded-xl border p-3 text-sm"
            placeholder="http://192.168.1.10:4000 ou https://suporte.empresa.com"
            value={server.publicUrl}
            onChange={(e) => setServer({ ...server, publicUrl: e.target.value })}
          />
          <p className="text-xs text-slate-500">Webhook bot: {conn.webhookUrl}</p>
          <p className="text-xs text-slate-500">Evolution: {conn.evolutionWebhookUrl}</p>
          <button type="submit" className="w-full rounded-xl bg-slate-900 py-3 text-white text-sm">
            Salvar servidor
          </button>
        </form>
      )}

      {tab === "armazenamento" && isAdmin && (
        <form onSubmit={saveStorage} className="mt-4 space-y-3 rounded-2xl border bg-white p-4">
          <p className="text-sm text-slate-600">
            Atualmente os dados ficam em arquivos locais até conectar um banco SQL.
          </p>
          <p className="text-sm font-mono bg-slate-50 p-2 rounded-lg">{conn.storagePath || storage.dataPath}</p>
          <p className="text-xs">Mensagens: data/mensagens/*.txt</p>
          <p className="text-xs">Configurações: data/dados.json</p>
          <select
            className="w-full rounded-xl border p-2"
            value={storage.mode}
            onChange={(e) => setStorage({ ...storage, mode: e.target.value })}
          >
            <option value="files">Arquivos locais (ativo)</option>
            <option value="database">Banco SQL (futuro)</option>
          </select>
          <button type="submit" className="w-full rounded-xl bg-slate-900 py-3 text-white text-sm">
            Salvar
          </button>
        </form>
      )}

      {tab === "whatsapp" && (
        <div className="mt-4 space-y-4">
          {isAdmin && (
            <div className="rounded-2xl border bg-white p-4 space-y-3">
              <h3 className="font-semibold">WhatsApp integrado</h3>
              <p className="text-sm text-slate-600">
                O QR Code aparece automaticamente na barra superior ao abrir o programa. Escaneie com
                WhatsApp → Aparelhos conectados. Apenas o admin conecta o número da empresa.
              </p>
              <button type="button" onClick={connectWa} className="w-full rounded-xl bg-emerald-600 py-2 text-sm text-white">
                Reconectar / atualizar QR
              </button>
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer">Evolution API (opcional)</summary>
                <form onSubmit={saveWa} className="mt-2 space-y-2">
                  <input
                    className="w-full rounded-xl border p-2 text-sm"
                    placeholder="URL API Evolution"
                    value={wa.apiUrl}
                    onChange={(e) => setWa({ ...wa, apiUrl: e.target.value, provider: "evolution" })}
                  />
                  <input
                    className="w-full rounded-xl border p-2 text-sm"
                    placeholder="Instância"
                    value={wa.instance}
                    onChange={(e) => setWa({ ...wa, instance: e.target.value })}
                  />
                  <input
                    type="password"
                    className="w-full rounded-xl border p-2 text-sm"
                    placeholder="API Key"
                    value={wa.apiKey}
                    onChange={(e) => setWa({ ...wa, apiKey: e.target.value })}
                  />
                  <button type="submit" className="w-full rounded-xl border py-2 text-sm">
                    Salvar Evolution
                  </button>
                </form>
              </details>
            </div>
          )}

          <div className="rounded-2xl border bg-white p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Status: {waConnected ? "Conectado" : waStatus || "Desconectado"}</span>
              <button type="button" onClick={refreshWaStatus} className="text-sm text-blue-600">
                Atualizar
              </button>
            </div>
            {qrCode && (
              <img src={qrCode} alt="QR Code WhatsApp" className="mx-auto mt-4 max-w-[240px] rounded-xl border" />
            )}
            <p className="mt-2 text-xs text-slate-500 text-center">Escaneie com WhatsApp → Aparelhos conectados</p>
          </div>

          <div className="rounded-2xl border bg-white p-4 space-y-2">
            <h3 className="font-medium">Teste sem WhatsApp</h3>
            <input className="w-full rounded-xl border p-2 text-sm" value={simPhone} onChange={(e) => setSimPhone(e.target.value)} />
            <textarea className="w-full rounded-xl border p-2 text-sm" rows={2} value={simMessage} onChange={(e) => setSimMessage(e.target.value)} />
            <button type="button" onClick={simulate} className="w-full rounded-xl bg-blue-700 py-2 text-sm text-white">
              Simular mensagem
            </button>
          </div>

          {isAdmin && (
            <form onSubmit={importWhatsapp} className="rounded-2xl border bg-white p-4 space-y-2">
              <h3 className="font-medium">Importar historico do WhatsApp (.txt)</h3>
              <p className="text-xs text-slate-500">
                Use a exportacao do WhatsApp com midia. O historico sera salvo localmente.
              </p>
              <input
                className="w-full rounded-xl border p-2 text-sm"
                placeholder="Nome do cliente"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
              />
              <input
                className="w-full rounded-xl border p-2 text-sm"
                placeholder="Telefone do cliente (opcional)"
                value={importPhone}
                onChange={(e) => setImportPhone(e.target.value)}
              />
              <input
                type="file"
                accept=".txt"
                className="w-full rounded-xl border p-2 text-sm"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
              <button
                type="submit"
                disabled={importing}
                className="w-full rounded-xl bg-slate-900 py-2 text-sm text-white disabled:opacity-50"
              >
                {importing ? "Importando..." : "Importar historico"}
              </button>
            </form>
          )}
        </div>
      )}

      {tab === "ia" && isAdmin && (
        <form onSubmit={saveAi} className="mt-4 space-y-3 rounded-2xl border bg-white p-4">
          <h3 className="font-semibold">Especialista ERP / Fiscal</h3>
          <label className="text-xs font-medium text-slate-500">Chave da IA (opcional)</label>
          <input
            type="password"
            className="w-full rounded-xl border p-2 text-sm"
            placeholder="Cole aqui a chave que deseja usar"
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            A chave substitui a do sistema e fica salva localmente.
          </p>
          <label className="text-xs font-medium text-slate-500">O que a IA deve fazer (instruções)</label>
          <textarea
            className="w-full rounded-xl border p-2 text-sm"
            rows={3}
            placeholder="Ex: Sempre cumprimentar, focar em QI Informática, escalar para humano se..."
            value={ai.instructions}
            onChange={(e) => setAi({ ...ai, instructions: e.target.value })}
          />
          <label className="text-xs font-medium text-slate-500">Prompt do sistema (CFOP, ICMS...)</label>
          <textarea
            className="w-full rounded-xl border p-2 text-xs font-mono"
            rows={10}
            value={ai.systemPrompt}
            onChange={(e) => setAi({ ...ai, systemPrompt: e.target.value })}
          />
          <input className="w-full rounded-xl border p-2 text-sm" value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} />
          <button type="submit" className="w-full rounded-xl bg-slate-900 py-3 text-white text-sm">
            Salvar prompt
          </button>
        </form>
      )}

      {tab === "logs" && (
        <div className="mt-4 space-y-2">
          <button type="button" onClick={load} className="text-sm text-blue-600">
            Atualizar logs
          </button>
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum registro ainda.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-xl border bg-white p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{log.action}</span>
                  <span className={log.success ? "text-emerald-600" : "text-red-600"}>
                    {log.success ? "OK" : "Erro"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString("pt-BR")}</p>
                <p className="mt-1 text-slate-600">Entrada: {log.inputPreview}</p>
                <p className="text-slate-600">Saída: {log.outputPreview || log.detail}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "banco" && isAdmin && (
        <div className="mt-4 rounded-2xl border bg-white p-4 text-sm text-slate-600">
          <p>Configure aqui para quando migrar de arquivos TXT para PostgreSQL/MySQL.</p>
          <p className="mt-2 text-emerald-700">Modo atual: arquivos em data/</p>
        </div>
      )}
    </div>
  );
}
