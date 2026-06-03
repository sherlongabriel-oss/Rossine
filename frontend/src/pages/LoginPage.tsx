import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [userLogin, setUserLogin] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await login(userLogin, password);
      navigate("/conversas");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Erro no login");
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage:
          "linear-gradient(rgba(15,23,42,0.88), rgba(30,58,138,0.85)), url(/logo.svg)",
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white/95 backdrop-blur p-8 shadow-2xl border border-white/20">
        <div className="flex flex-col items-center text-center">
          <img src="/logo.svg" alt="QI Support AI" className="h-24 w-24 rounded-2xl object-contain shadow-lg bg-white p-1" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">QI Support AI</h1>
          <p className="mt-1 text-sm text-slate-500">Atendimento WhatsApp · estilo tawk.to</p>
          <p className="mt-2 text-xs text-emerald-700 font-medium">Pronto para uso — sem configurar porta</p>
        </div>

        {message && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-800">{message}</div>
        )}

        <form onSubmit={onLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500">Usuário</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-3"
              value={userLogin}
              onChange={(e) => setUserLogin(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Senha</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-200 p-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-blue-700 py-3.5 font-semibold text-white shadow-lg hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar no painel"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">Padrão: admin / admin</p>
      </div>
    </div>
  );
}
