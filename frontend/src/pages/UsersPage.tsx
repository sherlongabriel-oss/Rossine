import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  whatsappAccess: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ATTENDANT");
  const [message, setMessage] = useState("");

  const load = async () => {
    const data = await api<{ users: UserRow[] }>("/api/users");
    setUsers(data.users);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({ name, login, password, role, whatsappAccess: true }),
      });
      setName("");
      setLogin("");
      setPassword("");
      setMessage("Usuário criado — pode entrar e responder conversas no mesmo WhatsApp.");
      load();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Erro ao criar");
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold">Atendentes</h2>
      <p className="text-sm text-slate-600 mt-1">
        Sem e-mail: apenas login e senha. Todos respondem na mesma conversa WhatsApp da empresa.
      </p>

      {message && (
        <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm">{message}</div>
      )}

      <form onSubmit={create} className="mt-4 space-y-2 rounded-2xl border bg-white p-4">
        <input className="w-full rounded-xl border p-2 text-sm" placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="w-full rounded-xl border p-2 text-sm" placeholder="Login (ex: maria)" value={login} onChange={(e) => setLogin(e.target.value)} required />
        <input type="password" className="w-full rounded-xl border p-2 text-sm" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <select className="w-full rounded-xl border p-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="ATTENDANT">Atendente</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <button type="submit" className="w-full rounded-xl bg-slate-900 py-2 text-sm text-white">
          Criar atendente
        </button>
      </form>

      <ul className="mt-4 space-y-2">
        {users.map((u) => (
          <li key={u.id} className="rounded-2xl border bg-white p-4">
            <div className="font-medium">{u.name}</div>
            <div className="text-sm text-slate-600">Login: {u.email}</div>
            <div className="text-xs text-slate-500 mt-1">{u.role}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
