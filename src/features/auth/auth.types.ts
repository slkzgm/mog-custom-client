export type AuthStatus = "authenticated" | "anonymous";

export interface AuthUser {
  address: string;
  userId: string | null;
  chainId: number | null;
  expirationTime: string | null;
  isAuthenticated: boolean;
  raw: Record<string, unknown>;
}

export interface AuthSession {
  status: AuthStatus;
  user: AuthUser | null;
  ok: boolean;
  message: string | null;
  checkedAtIso: string;
}

export interface PublicProfile {
  profileName: string | null;
  profilePictureUrl: string | null;
  source: string | null;
}

export interface SiwePayload {
  message: string;
  signature: string;
}

export interface AuthSignInResult {
  profile: PublicProfile | null;
  nonce: string;
  message: string;
  signature: string;
  verifyOk: boolean;
  session: AuthSession;
}
