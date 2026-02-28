# MOG Custom Client (Workbench)

Barebones scaffold to reimplement MOG client logic step-by-step:

- React 19 + TypeScript + Vite
- TanStack Query for server state
- Abstract Global Wallet SDK integration
- Clean module boundaries (`app`, `features`, `lib`)
- Initial SIWE auth flow (`profile` -> `nonce` -> sign -> `verify` -> `session`)
- Serialized action queue helper for race-condition control

## Start

```bash
cp .env.example .env
npm install
npm run dev
```

Dev note:
- Vite proxies `/api/*` to `https://mog.onchainheroes.xyz/*` (`vite.config.ts`) to avoid browser CORS issues in local development.

## Current Scope

- Wallet connect/disconnect via `useLoginWithAbstract`
- Public profile probe via `GET /api/profile/:address`
- Game probes:
  - `GET /api/status`
  - `GET /api/runs/active`
  - `GET /api/keys/balance`
- SIWE auth path:
  - `GET /api/auth/nonce`
  - sign SIWE message with wallet
  - `POST /api/auth/verify`
  - `GET /api/auth/user`
- `gameActionQueue`: serial async queue to enforce one action at a time

## Structure

```text
src/
  app/                 # app config + providers
  features/
    auth/              # auth api + query + panel
    game/              # game status/active/balance queries + panel
    realtime/          # action queue instance
  lib/
    http/              # fetch wrapper + ApiError
    queue/             # serial queue primitive
  pages/
    workbench-page.tsx # single barebones page
```

## Next Step

Implement game runtime modules on top of authenticated session:

1. run bootstrap (`/api/runs/active` + create)
2. action mutations with strict queue (`move`, `upgrade_selected`, etc.)
3. real-time sync (chat/events/websocket)
4. deterministic state reducer by `runId + turnNumber`
