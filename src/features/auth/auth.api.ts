import { apiRequest } from "../../lib/http/api-client";
import { ApiError } from "../../lib/http/api-error";
import type { AuthSession, AuthUser, PublicProfile, SiwePayload } from "./auth.types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickFirstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const rawValue = source[key];
    if (typeof rawValue === "string" && rawValue.trim()) {
      return rawValue.trim();
    }
  }

  return null;
}

function pickFirstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const rawValue = source[key];
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      return rawValue;
    }
  }

  return null;
}

function toAuthUser(payload: unknown): AuthUser | null {
  const root = asRecord(payload);
  if (!root) return null;

  const nestedUser = asRecord(root.user);
  const source = nestedUser ?? root;
  const address = pickFirstString(source, ["address", "walletAddress"]);
  if (!address) return null;

  return {
    address,
    userId: pickFirstString(source, ["userId"]),
    chainId: pickFirstNumber(source, ["chainId"]),
    expirationTime: pickFirstString(source, ["expirationTime"]),
    isAuthenticated: source.isAuthenticated === true,
    raw: source,
  };
}

function toPublicProfile(payload: unknown): PublicProfile | null {
  const source = asRecord(payload);
  if (!source) return null;

  return {
    profileName: pickFirstString(source, ["profileName"]),
    profilePictureUrl: pickFirstString(source, ["profilePictureUrl"]),
    source: pickFirstString(source, ["source"]),
  };
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

export async function fetchPublicProfile(address: string): Promise<PublicProfile | null> {
  let payload: unknown;
  try {
    payload = await apiRequest<unknown>(`profile/${address}`, {
      method: "GET",
      credentials: "omit",
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 410)) {
      return null;
    }
    throw error;
  }

  return toPublicProfile(payload);
}

export async function fetchAuthNonce(): Promise<string> {
  const payload = await apiRequest<unknown>("auth/nonce", {
    method: "GET",
    credentials: "include",
  });

  if (typeof payload === "string") return payload;

  const source = asRecord(payload);
  if (!source) return "";
  return pickFirstString(source, ["nonce"]) ?? "";
}

export async function verifyAuthSignature(payload: SiwePayload): Promise<boolean> {
  const response = await apiRequest<unknown>("auth/verify", {
    method: "POST",
    credentials: "include",
    body: payload,
  });

  const source = asRecord(response);
  if (!source) return false;
  return toBoolean(source.ok);
}

export async function fetchAuthSession(): Promise<AuthSession> {
  const payload = await apiRequest<unknown>("auth/user", {
    method: "GET",
    credentials: "include",
  });
  const source = asRecord(payload);
  const user = toAuthUser(payload);
  const ok = Boolean(source && source.ok === true && user);
  const message =
    (source && pickFirstString(source, ["message"])) ?? (ok ? null : "No user session found.");

  return {
    status: ok ? "authenticated" : "anonymous",
    user: ok ? user : null,
    ok,
    message,
    checkedAtIso: new Date().toISOString(),
  };
}
