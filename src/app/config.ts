import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1).optional(),
  VITE_ENABLE_ENCOUNTER_CATALOG: z.string().optional(),
  VITE_ENABLE_MAP_FOG_MEMORY: z.string().optional(),
  VITE_ENABLE_MAP_SNAPSHOT_PROBE: z.string().optional(),
  VITE_PUSHER_APP_KEY: z.string().min(1).optional(),
  VITE_PUSHER_CLUSTER: z.string().min(1).optional(),
  VITE_PUSHER_CHANNEL: z.string().min(1).optional(),
  VITE_SIWE_DOMAIN: z.string().min(1).optional(),
  VITE_SIWE_URI: z.string().url().optional(),
  VITE_SIWE_STATEMENT: z.string().min(1).optional(),
  VITE_SIWE_EXPIRATION_DAYS: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(import.meta.env);
if (!parsedEnv.success) {
  console.error("Invalid Vite env configuration", parsedEnv.error.flatten().fieldErrors);
}

const env = parsedEnv.success ? parsedEnv.data : {};

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeApiBaseUrl(rawBaseUrl: string | undefined): string {
  if (!rawBaseUrl) return "/api/";

  const value = rawBaseUrl.trim();
  if (!value) return "/api/";

  if (/^https?:\/\//.test(value)) {
    if (import.meta.env.DEV) {
      try {
        const parsed = new URL(value);
        if (parsed.hostname === "mog.onchainheroes.xyz") {
          console.warn(
            "VITE_API_BASE_URL points to mog.onchainheroes.xyz in DEV. Falling back to /api/ to avoid CORS.",
          );
          return "/api/";
        }
      } catch {
        return "/api/";
      }
    }

    return ensureTrailingSlash(value);
  }

  if (value.startsWith("/")) {
    return ensureTrailingSlash(value);
  }

  return ensureTrailingSlash(`/${value}`);
}

function parseSiweExpirationDays(rawValue: string | undefined): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return 7;
  const integer = Math.floor(parsed);
  if (integer < 1) return 1;
  if (integer > 30) return 30;
  return integer;
}

function parseFeatureFlag(rawValue: string | undefined, defaultValue: boolean): boolean {
  if (rawValue === undefined) return defaultValue;

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  return defaultValue;
}

export const appConfig = {
  apiBaseUrl: normalizeApiBaseUrl(env.VITE_API_BASE_URL),
  features: {
    encounterCatalog: parseFeatureFlag(env.VITE_ENABLE_ENCOUNTER_CATALOG, import.meta.env.DEV),
    mapFogMemory: parseFeatureFlag(env.VITE_ENABLE_MAP_FOG_MEMORY, true),
    mapSnapshotProbe: parseFeatureFlag(env.VITE_ENABLE_MAP_SNAPSHOT_PROBE, import.meta.env.DEV),
  },
  pusher: {
    appKey: env.VITE_PUSHER_APP_KEY ?? "d21f2a24538872113358",
    cluster: env.VITE_PUSHER_CLUSTER ?? "mt1",
    channel: env.VITE_PUSHER_CHANNEL ?? "game-chat",
  },
  auth: {
    chainId: 2741,
    siwe: {
      domain: env.VITE_SIWE_DOMAIN ?? "mog.onchainheroes.xyz",
      uri: env.VITE_SIWE_URI ?? "https://mog.onchainheroes.xyz",
      statement: env.VITE_SIWE_STATEMENT ?? "Sign in with Ethereum to the app.",
      version: "1",
      expirationDays: parseSiweExpirationDays(env.VITE_SIWE_EXPIRATION_DAYS),
    },
  },
} as const;
