import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, setToken, tryRefresh } from './api';

export type Rol = 'SUPER_ADMIN' | 'ADMIN_PARQUE' | 'ADMIN_BODEGA' | 'VIGILANCIA';

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  parqueId: string | null;
  bodegaId: string | null;
  mfaHabilitado?: boolean;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (await tryRefresh()) {
        try {
          setUser(await api.get<User>('/auth/me'));
        } catch {
          /* sesión no válida */
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string, totpCode?: string) => {
    const r = await api.post<{ accessToken: string; usuario: User }>(
      '/auth/login',
      { email, password, totpCode },
    );
    setToken(r.accessToken);
    setUser(r.usuario);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignora */
    }
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => setUser(await api.get<User>('/auth/me'));

  return (
    <Ctx.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(Ctx);
