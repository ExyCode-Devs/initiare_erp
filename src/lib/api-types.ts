export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
}

export interface AuthCompany {
  id: string;
  name: string;
  domain: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  company: AuthCompany;
}

export interface MeResponse {
  user: AuthUser;
  company: AuthCompany;
}
