const storageKey = "qi_api_base";

export function getApiBase() {
  const fromStorage = localStorage.getItem(storageKey);
  if (fromStorage) return fromStorage.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  return (fromEnv || "http://localhost:4000").replace(/\/$/, "");
}

export function setApiBase(url: string) {
  localStorage.setItem(storageKey, url.replace(/\/$/, ""));
}

export function getToken() {
  return localStorage.getItem("token");
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Erro ${res.status}`);
  }
  return data as T;
}
