import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest, clearStoredToken, getStoredToken, setStoredToken } from "@/lib/api";
import type { AuthResponse, MeResponse } from "@/lib/api-types";

type AuthContextValue = {
  activeCompany: AuthResponse["activeCompany"] | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  memberships: AuthResponse["memberships"];
  switchCompany: (companyId: string) => Promise<void>;
  user: AuthResponse["user"] | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [activeCompany, setActiveCompany] = useState<AuthResponse["activeCompany"] | null>(null);
  const [memberships, setMemberships] = useState<AuthResponse["memberships"]>([]);
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
        setActiveCompany(payload.activeCompany);
        setMemberships(payload.memberships);
      })
      .catch(() => {
        clearStoredToken();
        if (!active) {
          return;
        }

        setUser(null);
        setActiveCompany(null);
        setMemberships([]);
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
    setActiveCompany(payload.activeCompany);
    setMemberships(payload.memberships);
    await queryClient.invalidateQueries();
  };

  const switchCompany = async (companyId: string) => {
    const payload = await apiRequest<AuthResponse>("/auth/switch-company", {
      method: "POST",
      body: { companyId }
    });

    setStoredToken(payload.token);
    setUser(payload.user);
    setActiveCompany(payload.activeCompany);
    setMemberships(payload.memberships);
    await queryClient.invalidateQueries();
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
    setActiveCompany(null);
    setMemberships([]);
    void queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        activeCompany,
        isReady,
        login,
        logout,
        memberships,
        switchCompany,
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
