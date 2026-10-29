import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, setUnauthorizedHandler, tokenStore } from "./api/client";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  isSupervisor: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // False until we've checked whether a saved token is still valid.
  const [ready, setReady] = useState(!tokenStore.get());

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api
      .me()
      .then(setUser)
      .catch(logout)
      .finally(() => setReady(true));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    tokenStore.set(res.access_token);
    setUser(res.user);
  };

  if (!ready) return <div className="splash" aria-label="Loading" />;
  return (
    <AuthContext.Provider value={{ user, isSupervisor: user?.role === "supervisor", login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  return useAuth().user ? <>{children}</> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
