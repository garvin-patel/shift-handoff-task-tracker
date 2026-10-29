import { createContext, useContext, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "./types";
import { api } from "./api/client";

interface Ctx { user: User | null; login: (u: string, p: string) => Promise<void>; logout: () => void; }
const AuthContext = createContext<Ctx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem("user") || "null"));
  const login = async (u: string, p: string) => {
    const res = await api.login(u, p);
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
  };
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); setUser(null); };
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
export function RequireAuth({ children }: { children: ReactNode }) {
  return useAuth().user ? <>{children}</> : <Navigate to="/login" replace />;
}
