// Data most screens need: the current shift, the handoff it received, and the staff list.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "./api/client";
import type { Handoff, Shift, User } from "./types";

interface AppData {
  shift: Shift | null;
  incoming: Handoff | null;
  users: User[];
  departments: string[];
  loaded: boolean;
  refresh: () => Promise<void>;
}

const AppDataContext = createContext<AppData>(null!);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [shift, setShift] = useState<Shift | null>(null);
  const [incoming, setIncoming] = useState<Handoff | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, h, u] = await Promise.all([api.currentShift(), api.incomingHandoff(), api.users()]);
      setShift(s);
      setIncoming(h);
      setUsers(u);
    } finally {
      setLoaded(true);
    }
  }, []);

  const departments = useMemo(
    () => [...new Set(users.map((u) => u.department).filter((d): d is string => !!d))].sort(),
    [users],
  );

  return (
    <AppDataContext.Provider value={{ shift, incoming, users, departments, loaded, refresh }}>
      {children}
    </AppDataContext.Provider>
  );
}

export const useAppData = () => useContext(AppDataContext);
