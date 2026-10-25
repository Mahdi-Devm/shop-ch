import type { AuthSession } from "../assets/@types/auth.types";

const STORAGE_KEY = "flash-sale.session";

type Listener = () => void;

const listeners = new Set<Listener>();
let currentSession: AuthSession | null = null;
let hasLoaded = false;

function readPersistedSession(): AuthSession | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    return typeof parsed.token === "string" && typeof parsed.userId === "string"
      ? { token: parsed.token, userId: parsed.userId }
      : null;
  } catch {
    return null;
  }
}

function persist(session: AuthSession | null): void {
  try {
    if (session) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    return;
  }
}

export function getSession(): AuthSession | null {
  if (!hasLoaded && typeof window !== "undefined") {
    currentSession = readPersistedSession();
    hasLoaded = true;
  }
  return currentSession;
}

export function getServerSession(): AuthSession | null {
  return null;
}

export function setSession(session: AuthSession | null): void {
  currentSession = session;
  hasLoaded = true;
  persist(session);
  listeners.forEach((listener) => listener());
}

export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
