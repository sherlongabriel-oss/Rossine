import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import WhatsAppBar from "./WhatsAppBar";

const nav = [
  { to: "/conversas", label: "Conversas", icon: "💬" },
  { to: "/conhecimento", label: "Base", icon: "📚" },
  { to: "/configuracoes", label: "Config", icon: "⚙️" },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-slate-100 pb-20">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 backdrop-blur px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <img src="/logo.svg" alt="QI" className="h-10 w-10 rounded-xl object-contain bg-white shadow" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900">QI Support AI</h1>
            <p className="truncate text-xs text-slate-500">
              {user?.name} · {user?.company?.name}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Sair
          </button>
        </div>
      </header>

      <WhatsAppBar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur safe-bottom">
        <div className="mx-auto flex max-w-4xl">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center py-2.5 text-xs ${
                  isActive ? "text-blue-700 font-semibold" : "text-slate-500"
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          {user?.role === "ADMIN" && (
            <NavLink
              to="/usuarios"
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center py-2.5 text-xs ${
                  isActive ? "text-blue-700 font-semibold" : "text-slate-500"
                }`
              }
            >
              <span className="text-lg">👥</span>
              Usuários
            </NavLink>
          )}
        </div>
      </nav>
    </div>
  );
}
