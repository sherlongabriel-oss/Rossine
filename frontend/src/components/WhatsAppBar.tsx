import { useEffect, useState } from "react";
import { getApiBase } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function WhatsAppBar() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Conectando...");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const refresh = async () => {
    try {
      console.log("[WhatsApp Bar] Buscando status...");
      const baseUrl = getApiBase();
      
      const statusRes = await fetch(`${baseUrl}/api/public/whatsapp/status`);
      const s = await statusRes.json();
      console.log("[WhatsApp Bar] Status:", s);
      
      setConnected(s.connected);
      setStatus(s.connected ? "✓ WhatsApp conectado" : s.state === "qr" ? "📱 Escaneie o QR Code" : `Status: ${s.state}`);
      
      // Enquanto não conectado, sempre tentamos buscar o QR. Mesmo que o estado ainda não seja "qr",
      // o backend pode gerar o código após alguns segundos, então mantemos o polling ativo.
      if (!s.connected) {
        try {
          console.log("[WhatsApp Bar] Buscando QR code...");
          const qrRes = await fetch(`${baseUrl}/api/public/whatsapp/qrcode`);
          const q = await qrRes.json();
          console.log("[WhatsApp Bar] QR recebido:", q.qrcode ? "Sim" : "Não");
          
          if (q.qrcode) {
            setQrCode(q.qrcode.startsWith("data:") ? q.qrcode : `data:image/png;base64,${q.qrcode}`);
            setExpanded(true);
          }
        } catch (qrErr) {
          console.log("[WhatsApp Bar] Erro ao buscar QR:", qrErr);
        }
      } else {
        setQrCode(null);
        if (s.connected) setExpanded(false);
      }
    } catch (err) {
      console.log("[WhatsApp Bar] Erro no refresh:", err);
      setStatus("Iniciando WhatsApp...");
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    console.log("[WhatsApp Bar] Iniciando polling...");
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div
      className={`border-b ${
        connected ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
      }`}
    >
      <div className="mx-auto max-w-4xl px-4 py-2 flex items-center gap-3">
        <span className="text-lg">{connected ? "✓" : "📱"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800">{status}</p>
          <p className="text-xs text-slate-500">
            {connected
              ? "Clientes no WhatsApp · atendentes respondem no painel"
              : "Somente o admin conecta o número da empresa"}
          </p>
        </div>
        {!connected && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs font-medium text-blue-700 shrink-0"
          >
            {expanded ? "Ocultar QR" : "Mostrar QR"}
          </button>
        )}
      </div>
      {!connected && expanded && qrCode && (
        <div className="pb-3 flex justify-center">
          <img src={qrCode} alt="QR Code WhatsApp" className="max-w-[200px] rounded-xl border-2 border-white shadow-lg" />
        </div>
      )}
    </div>
  );
}
