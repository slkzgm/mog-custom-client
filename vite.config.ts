import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

const DEV_ENCOUNTER_CATALOG_PATH = path.resolve(__dirname, "docs/dev-encounter-catalog.json");

function devEncounterCatalogPlugin(): Plugin {
  return {
    name: "dev-encounter-catalog",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/encounter-catalog", async (request, response) => {
        response.setHeader("content-type", "application/json");

        if (request.method === "GET") {
          try {
            const raw = await readFile(DEV_ENCOUNTER_CATALOG_PATH, "utf8");
            response.end(JSON.stringify({ filePath: "docs/dev-encounter-catalog.json", catalog: JSON.parse(raw) }));
          } catch {
            response.statusCode = 200;
            response.end(
              JSON.stringify({
                filePath: "docs/dev-encounter-catalog.json",
                catalog: null,
              }),
            );
          }
          return;
        }

        if (request.method === "POST") {
          try {
            const chunks: Uint8Array[] = [];
            for await (const chunk of request) {
              chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }

            const body = Buffer.concat(chunks).toString("utf8");
            const payload = JSON.parse(body);

            await mkdir(path.dirname(DEV_ENCOUNTER_CATALOG_PATH), { recursive: true });
            await writeFile(DEV_ENCOUNTER_CATALOG_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

            response.statusCode = 200;
            response.end(JSON.stringify({ filePath: "docs/dev-encounter-catalog.json" }));
          } catch (error) {
            response.statusCode = 500;
            response.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : "Could not persist encounter catalog.",
              }),
            );
          }
          return;
        }

        response.statusCode = 405;
        response.end(JSON.stringify({ error: "Method not allowed." }));
      });
    },
  };
}

function parseFeatureFlag(rawValue: string | undefined, defaultValue: boolean): boolean {
  if (rawValue === undefined) return defaultValue;

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  return defaultValue;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isEncounterCatalogEnabled = parseFeatureFlag(env.VITE_ENABLE_ENCOUNTER_CATALOG, mode !== "production");

  return {
    plugins: [react(), ...(isEncounterCatalogEnabled ? [devEncounterCatalogPlugin()] : [])],
    server: {
      proxy: {
        "/api": {
          target: "https://mog.onchainheroes.xyz",
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
