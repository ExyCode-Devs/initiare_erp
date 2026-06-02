import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest, clearStoredToken, getStoredToken, setStoredToken } from "@/lib/api";
import type { AuthResponse, MeResponse } from "@/lib/api-types";

type AuthContextValue = {
  company: AuthResponse["company"] | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  user: AuthResponse["user"] | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [company, setCompany] = useState<AuthResponse["company"] | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    const token = getStoredToken();

    if (!token) {
      setIsReady(true);
      return;
    }

    void apiRequest<MeResponse>("/auth/me", {
      tokenOverride: token
    })
      .then((payload) => {
        if (!active) {
          return;
        }

        setUser(payload.user);
        setCompany(payload.company);
      })
      .catch(() => {
        clearStoredToken();
        if (!active) {
          return;
        }

        setUser(null);
        setCompany(null);
      })
      .finally(() => {
        if (active) {
          setIsReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const payload = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password }
    });

    setStoredToken(payload.token);
    setUser(payload.user);
    setCompany(payload.company);
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
    setCompany(null);
  };

  return (
    <AuthContext.Provider
      value={{
        company,
        isReady,
        login,
        logout,
        user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
