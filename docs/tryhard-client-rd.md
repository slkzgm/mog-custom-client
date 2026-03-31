# MOG Tryhard Client: R&D Initiale

Date: 2026-03-31

## 1. Objectif produit

Construire un client custom "tryhard" pour Maze of Gains qui privilégie:

- la performance perçue
- la fluidité d'exécution
- la stabilité runtime
- le contrôle clavier
- la lisibilité tactique
- les données utiles au gameplay

Le bon benchmark n'est pas "faire un clone de l'officiel". Le bon benchmark est:

- input -> feedback instantané
- état de partie cohérent
- zéro surprise réseau
- zéro feature parasite pendant l'exécution d'une run

## 2. Ce que le repo actuel donne déjà

Le POC local est beaucoup plus avancé qu'une simple maquette:

- `Vite + React 19 + TypeScript`
- `TanStack Query` pour le server state
- `wagmi + viem + AGW` pour wallet / Abstract
- flow SIWE déjà présent
- mutations gameplay déjà présentes:
  - start run
  - move / attack / break / pass
  - reroll
  - select upgrade
- sérialisation des actions via `SerialActionQueue`
- hotkeys gameplay déjà branchées
- parsing défensif des payloads API

Conclusion:

- la base de protocole et d'intégration existe déjà
- le chantier principal n'est pas "rendre le jeu possible"
- le chantier principal est "rendre le client robuste, découpé, rapide, et pilotable"

## 3. Constats sur le POC local

### Points solides

- séparation `app / features / lib` saine
- discipline correcte côté appels réseau
- présence d'une queue sérielle, indispensable pour un client tryhard
- stratégie de fallback déjà esquissée quand l'état local diverge du serveur
- hotkeys clavier déjà traitées comme feature core

### Limites actuelles

- `GamePanel` concentre trop de responsabilités
  - fetching
  - orchestration runtime
  - validation gameplay
  - affichage
  - achat de clés
  - recovery
- la page workbench mélange auth, gameplay et debug
- pas de vraie architecture "run runtime" dédiée
- pas de store local spécialisé pour l'état de partie et les préférences UI
- pas de budget de performance ni d'instrumentation
- pas de split clair entre:
  - gameplay critique
  - métagame
  - social
  - commerce

### Baseline build locale

Build local du 2026-03-31:

- `dist/assets/index-BE9S7hQV.js`: `821.18 kB`
- gzip: `244.53 kB`

Pour un POC bare-bone, c'est encore acceptable. Pour une vraie version produit, il faudra découper.

## 4. Ce que montre le client officiel

Observations faites le 2026-03-31 sur `https://mog.onchainheroes.xyz/`.

### Stack visible

- Next.js App Router sur Vercel
- Phaser détecté dans les bundles
- Privy détecté dans le runtime
- `wagmi` / `viem`
- Pusher
- motion / animation runtime
- Sentry

### Chargement initial

Le HTML initial charge 33 assets `_next/static` distincts.

Somme des assets récupérés le 2026-03-31:

- environ `5971.7 KiB` non compressés

Ce chiffre n'est pas un "transfer size" navigateur exact, mais un bon proxy du poids total du front servi.

### Requêtes visibles au chargement

Le client officiel déclenche très tôt des requêtes non strictement nécessaires au gameplay de run:

- `/api/status`
- `/api/session-key/get-signer`
- `/api/profile/:address`
- `/api/auth/user`
- `/api/keys/balance`
- `/api/chat/history?limit=50`
- `/api/runs?mode=weekly&address=...`
- `/api/items/amber`
- `/api/items/world-keys`
- `/api/jackpot/pool`
- `/api/weekly-pool`
- `/api/claims`
- `/api/runs/active?runType=NORMAL`
- `/api/runs/active?runType=WORLD`
- `/api/runs/active`

### Realtime / polling

Le runtime observé laisse voir:

- connexion Pusher immédiate pour le chat
- répétition agressive des appels `/api/runs/active` pendant l'idle

Inference:

- l'officiel charge très tôt du social, du métagame et du commerce
- l'état gameplay semble soutenu par un polling non négligeable
- cette stratégie est probablement acceptable pour un front "tout-en-un", mais mauvaise pour un client tryhard

## 5. Direction recommandée

### Décision 1: ne pas cloner l'architecture de l'officiel

Je recommande de ne pas repartir sur un front type Next.js + moteur de jeu complet plein écran si votre objectif prioritaire est la réactivité de jeu.

Pourquoi:

- trop de surface produit embarquée d'entrée
- trop de JS non critique
- trop de risques de rerenders et d'effets secondaires
- trop de dépendance entre gameplay et métagame

### Décision 2: garder Vite + React

Je recommande de garder:

- Vite
- React 19
- TypeScript
- TanStack Query
- wagmi / viem / AGW

Pourquoi:

- la base existe déjà
- le temps de build et de dev reste court
- le gameplay n'a pas besoin d'un framework serveur
- le contrôle fin du bundle est plus simple

### Décision 3: ne pas faire de Phaser une dépendance core du MVP

L'officiel embarque Phaser, mais pour un client tryhard ce n'est pas forcément le bon centre de gravité.

Je recommande:

- renderer gameplay MVP en DOM/CSS grid, ou canvas léger maison
- contrat de renderer séparé du runtime
- possibilité de brancher un renderer plus visuel plus tard

Pourquoi:

- le jeu est piloté par tuiles, pas par physique temps réel
- le besoin principal est la lecture tactique
- les overlays data sont plus faciles à rendre en DOM
- le coût d'intégration et de debugging reste bien plus faible

Phaser ne doit être considéré que si vous voulez plus tard:

- skins avancés
- animations lourdes
- effets visuels complexes
- scène de jeu très illustrée

## 6. Architecture cible

### 6.1 Couches fonctionnelles

Je recommande 5 couches nettes:

1. `transport`
   - clients API
   - parsing Zod
   - mapping des payloads serveur vers des types stables

2. `server-state`
   - queries / mutations TanStack Query
   - cache invalidation
   - récupération / bootstrap

3. `run-runtime`
   - état de run courant
   - queue d'actions
   - reducer déterministe
   - recovery
   - latence / instrumentation

4. `ui-state`
   - préférences
   - keybinds
   - panneaux ouverts
   - mode compact / dense
   - options d'overlay

5. `presentation`
   - App shell
   - board
   - HUD
   - panneaux data
   - vues auth / shop / stash

### 6.2 Source of truth

La run doit avoir une seule vérité autoritaire côté client:

- `runId`
- `turnNumber`
- `gameState`

Le modèle recommandé:

- le serveur reste autoritaire
- le client applique localement les réponses de mutation immédiatement
- le client ne repoll pas agressivement tant que les mutations répondent
- en cas d'erreur ou de divergence, recovery explicite via `fetchRunState(runId)`

### 6.3 Store local

Je recommande d'ajouter un store externe léger pour le runtime et l'UI, plutôt que de tout laisser dans un gros composant React.

Options raisonnables:

- Zustand
- store custom basé sur `useSyncExternalStore`

Mon choix pragmatique:

- Zustand pour la vitesse d'implémentation

À garder dans TanStack Query:

- données serveur
- réponses API
- invalidation

À mettre dans le store runtime:

- snapshot courant actif
- statut de queue
- action en cours
- mesures de latence
- sélection locale
- overlays calculés
- préférences utilisateur

## 7. Règles de perf pour ce client

### Règle 1: gameplay first

La home et la vue de run ne doivent pas charger par défaut:

- chat
- claims
- jackpot
- historique
- boutique
- social feed
- prix fiat

Tout cela doit être:

- lazy
- on-demand
- ou chargé après idle

### Règle 2: zéro polling agressif par défaut

Pendant une run:

- priorité aux réponses de mutation
- recovery ponctuel seulement si nécessaire
- heartbeat lent uniquement si le backend l'impose

Hors run:

- pas de poll serré sur `activeRun`

Budget recommandé:

- hors run: pas plus d'1 requête de sync toutes les `15-30s`
- en run: zéro polling continu si les mutations sont suffisantes

### Règle 3: granularité des rerenders

Le board, le HUD, les overlays et les panneaux latéraux ne doivent pas dépendre du même state React brut.

Il faut:

- des subscriptions par slice
- des selectors dérivés
- des composants isolés

### Règle 4: séparer urgent et non urgent

À marquer comme non urgent:

- recalculs secondaires
- panneau analytics
- historique d'événements enrichi
- transitions de layout

React 19 doit être utilisé en ce sens:

- `startTransition`
- `useTransition`
- `useDeferredValue` pour certaines vues secondaires

### Règle 5: code splitting systématique

Il faut au minimum séparer:

- shell
- auth / wallet
- gameplay
- social / chat
- shop / stash / claims

Le gameplay doit être le premier chargement prioritaire.

### Règle 6: third-parties différés

Ne pas charger immédiatement:

- analytics
- monitoring riche
- chat runtime
- modules shop

Sentry ou équivalent peut rester, mais en mode minimal.

### Règle 7: calculs lourds hors thread principal

À moyen terme, basculer dans un worker:

- pathfinding
- danger map
- overlays de menace
- histogrammes / analytics de run
- comparaison de snapshots si le volume augmente

## 8. Features "tryhard" à viser

### V1 gameplay

- reprise de run fiable
- WASD + espace impeccables
- queue d'actions visible
- feedback instantané après mutation
- journal des derniers événements
- vue carte lisible
- panneau stats player / floor / ennemis
- flow upgrade rapide
- recovery manuel et auto en cas de désync

### V1.1 tryhard data

- distances aux ennemis
- menace par case
- prévision de contact / danger immédiat
- densité de loot et interactifs visibles
- historique des tours
- temps réel de run
- compteur de performance:
  - actions/min
  - temps par floor
  - latence mutation p50/p95

### V1.2 optimisation et confort

- profils de keybinds
- thèmes dense / minimal / stream-safe
- crosshair de mouvement
- mode "focus" sans modules parasites
- panneau side-by-side avec event log
- persistence locale des settings

### Plus tard seulement

- chat
- claims
- jackpot
- stash
- cosmetics
- économie complète

Ces modules sont utiles produit, mais pas core pour la promesse tryhard.

## 9. Propositions de composants

### Shell

- `AppShell`
- `RouteViewport`
- `TopStatusBar`
- `CommandPalette`

### Gameplay

- `RunRuntimeProvider`
- `GameBoard`
- `GameHud`
- `ActionQueuePanel`
- `EnemyInspector`
- `TileInspector`
- `UpgradeOverlay`
- `RunEventFeed`
- `RecoveryBanner`

### Data

- `ThreatOverlay`
- `RunMetricsPanel`
- `FloorSummaryPanel`
- `ActionLatencyPanel`

### Settings

- `InputSettingsPanel`
- `DisplaySettingsPanel`
- `DebugSettingsPanel`

## 10. Roadmap technique recommandée

### Phase 1: solidifier le coeur

- sortir le workbench
- découper `GamePanel`
- créer un module `run-runtime`
- centraliser les query keys et invalidations
- ajouter un vrai store runtime
- poser instrumentation simple

### Phase 2: shell produit

- App shell propre
- vue login
- vue lobby / launch
- vue gameplay
- lazy load des modules non critiques

### Phase 3: UX tryhard

- HUD dense
- inspectors
- overlays
- history feed
- settings persistés

### Phase 4: robustesse

- recovery automatique
- gestion offline / reconnexion
- garde-fous sur actions doublées
- test des cas d'erreur serveur

### Phase 5: métagame

- shop
- claims
- stash
- social

## 11. Budget cible

Je recommande de piloter le projet avec des budgets explicites:

- shell initial gameplay: `< 200 kB gzip` si possible
- payload JS total avant interaction gameplay: `< 300 kB gzip`
- input clavier -> feedback local: `< 16 ms`
- mutation -> application UI: viser `< 150 ms` perçu quand le réseau suit
- aucune tâche longue main thread > `50 ms` sur action standard

Ce sont des objectifs produit internes, pas des contraintes du jeu.

## 12. Choix concrets que je recommande maintenant

### À garder

- Vite
- React 19
- TypeScript
- TanStack Query
- wagmi / viem / AGW
- Zod

### À ajouter probablement

- Zustand
- `idb-keyval` ou équivalent léger pour persistance locale
- outil de mesure simple:
  - `performance.mark`
  - `performance.measure`

### À éviter pour le moment

- Next.js
- Phaser comme socle obligatoire
- grosse librairie d'UI
- animation systématique
- store global trop abstrait
- polling gameplay agressif

## 13. Risques principaux

### Risque 1

Essayer de reproduire toute la surface du client officiel trop tôt.

Impact:

- dette produit
- bundle trop gros
- gameplay moins fluide

### Risque 2

Laisser le runtime de run dépendre d'un gros composant React unique.

Impact:

- rerenders inutiles
- maintenance difficile
- bugs de cohérence

### Risque 3

Mélanger gameplay critique et données de confort dans la même boucle de rendu.

Impact:

- input lag
- recovery plus complexe

### Risque 4

S'appuyer sur du polling parce que "ça marche".

Impact:

- bruit réseau
- latence perçue
- comportement difficile à raisonner

## 14. Recommandation finale

La meilleure version possible d'un client custom tryhard, dans votre contexte actuel, n'est pas:

- un clone de l'officiel
- un gros front framework-first
- un client plein de modules autour du gameplay

La meilleure version possible est:

- un shell Vite/React très découpé
- un runtime de run déterministe
- une UI dense et keyboard-first
- un chargement minimal centré gameplay
- un système de données enrichies au-dessus du state serveur

Autrement dit:

- garder la logique existante
- refactorer l'architecture avant d'ajouter beaucoup de features
- traiter gameplay et perf comme les deux invariants du projet

## 15. Sources

- Client officiel MOG: https://mog.onchainheroes.xyz/
- React `startTransition`: https://react.dev/reference/react/startTransition
- React `useTransition`: https://react.dev/reference/react/useTransition
- TanStack Query overview: https://tanstack.com/query/latest/docs/framework/react
- TanStack Query render optimizations: https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations
- TanStack Query important defaults: https://tanstack.com/query/v4/docs/framework/react/guides/important-defaults
- Vite dynamic import: https://vite.dev/guide/features.html
- Vite production build / chunking: https://vite.dev/guide/build.html
- Phaser scenes: https://docs.phaser.io/phaser/concepts/scenes
- Phaser ScaleManager: https://docs.phaser.io/api-documentation/class/scale-scalemanager
