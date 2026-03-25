# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Next.js, default port 3000)
npm run build    # Build production bundle
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test runner is configured. TypeScript build errors are intentionally ignored (`next.config.mjs`: `typescript: { ignoreBuildErrors: true }`). Images are unoptimized (`images: { unoptimized: true }`).

## Environment

The OpenRouter API key is entered by the user in the app's Settings panel (inside the sidebar) and stored in localStorage under `noodepad-ai-settings`. **There is no `.env.local` dependency** — the old `OPENROUTER_KEY` env var is no longer used. The key is forwarded from the client to API routes via the `x-or-key` request header. API routes return 401 if the header is missing.

## Tech Stack

- **Framework**: Next.js 16.1.6, React 19, TypeScript 5.7 (App Router, `"use client"` throughout)
- **Styling**: Tailwind CSS v4, `tw-animate-css`, `@tailwindcss/typography`
- **UI primitives**: shadcn/ui (44 components in `components/ui/`) backed by Radix UI
- **Animations**: Framer Motion 11
- **Icons**: Lucide React
- **Markdown**: `react-markdown` + `remark-gfm`
- **Command palette**: `cmdk` 1.1
- **Analytics**: `@vercel/analytics` (injected in `app/layout.tsx`)
- **Fonts**: Geist + Geist Mono (layout), Vazirmatn (RTL, via CSS `@import`)

## Architecture

**Noodepad** is a spatial AI-powered research/note-taking SPA. All state is client-side (React hooks + localStorage) — no database, no server-side session.

### State Hub: `app/page.tsx`

The root page owns all application state and passes it down. Key state:

- `projects: Project[]` — persisted to `nodepad-projects` in localStorage
- `activeProjectId` — persisted to `nodepad-active-project`
- `viewMode: "tiling" | "kanban"` — not persisted, defaults to `"tiling"`
- `highlightedBlockId` — ephemeral, for cross-panel highlighting
- Panel booleans: `isSidebarOpen`, `isIndexOpen`, `isCommandKOpen`, `isSettingsOpen`
- AI settings via `useAISettings()` hook from `lib/ai-settings.ts`

**Migration**: On load, if `nodepad-projects` is absent but the old `nodepad-blocks` key exists, data is migrated to a single `"Default Space"` project. If nothing exists, `INITIAL_PROJECTS` seeds state.

**Block addition**: `addBlock(text, forcedType?)` supports inline `#type text` shorthand (e.g., `#claim The earth is round`) to set type at creation time.

**Enrichment**: After each block add/edit, `enrichBlock()` fires `/api/enrich`. Returns `contentType`, `category`, `annotation`, `confidence`, `influencedByIndices`, `isUnrelated`, and optionally `mergeWithIndex`. An 800ms debounce applies to edits. If `mergeWithIndex` is non-null, the new block merges into an existing one. New blocks classified as `"task"` are appended as sub-tasks into an existing task block rather than creating a new tile.

**Ghost note**: After enrichment, `generateGhostNote()` may auto-trigger `/api/ghost` if ≥3 blocks exist, no ghost is active, ≥3 new blocks have been added since last ghost, and ≥2 minutes have elapsed. Users can "Solidify" (converts to a thesis block) or dismiss it.

### Core Data Models

Defined in `app/page.tsx` and `components/tile-card.tsx`:

```typescript
Project {
  id: string
  name: string
  blocks: TextBlock[]
  collapsedIds: string[]
  ghostNote?: { id: string; text: string; category: string; isGenerating: boolean }
  ghostNoteDismissed?: boolean
  lastGhostBlockCount?: number
  lastGhostTimestamp?: number
}

TextBlock {
  id: string
  text: string
  timestamp: number
  contentType: ContentType          // 14 types
  category?: string                 // AI-assigned topic group
  isEnriching?: boolean
  statusText?: string
  isError?: boolean
  annotation?: string               // AI-generated insight (2-4 sentences)
  confidence?: number | null        // 0–100 for claims
  sources?: { url: string; title: string; siteName: string }[]  // web grounding citations
  influencedBy?: string[]           // related block IDs / categories
  isUnrelated?: boolean
  isPinned?: boolean
  subTasks?: { id: string; text: string; isDone: boolean; timestamp: number }[]
}
```

### Content Type System

**`lib/content-types.ts`** — `ContentType` union + `CONTENT_TYPE_CONFIG` record:
- 14 types: `entity`, `claim`, `question`, `task`, `idea`, `reference`, `quote`, `definition`, `opinion`, `reflection`, `narrative`, `comparison`, `thesis`, `general`
- Each has: `label`, `icon` (Lucide), `accentVar` (CSS variable), optional `bodyStyle`
- Colors defined in `app/globals.css` as `--type-{name}` (oklch)
- `thesis` has a special gradient (`--thesis-gradient`, `--thesis-foreground`)

**`lib/detect-content-type.ts`** — Heuristic pre-classification before AI enrichment. Pattern order: quote → task → question → definition → comparison → reference (URL) → idea → reflection → opinion → entity (≤3 words) → claim (4–25 words) → narrative (>25 words) → general.

### `lib/ai-settings.ts`

`useAISettings()` hook and `getAIHeaders()` function. Settings stored in localStorage under `noodepad-ai-settings`:

- `apiKey: string` — user's OpenRouter key
- `modelId: string` — defaults to `"openai/gpt-4o"`
- `webGrounding: boolean` — enables `:online` suffix for grounding-capable models

Available models: Claude Sonnet 4.5, GPT-4o (default), Gemini 2.5 Pro, DeepSeek V3, Mistral Small 3.2. `getAIHeaders()` reads fresh from localStorage at call time.

### `lib/export.ts`

`exportToMarkdown(projectName, blocks)`, `downloadMarkdown()`, `copyToClipboard()`. Markdown groups blocks by type in research-logical order. Triggered via Cmd+K commands `export-md` and `copy-md`.

### `lib/initial-data.ts`

`INITIAL_PROJECTS` — single empty `"✨ New Research"` project, seeds state on first load.

### `lib/utils.ts`

`cn(...inputs)` — `clsx` + `tailwind-merge` utility.

## API Routes (`app/api/`)

### `POST /api/enrich`

- Body: `{ text, context, forcedType?, category? }`; Headers: `x-or-key`, `x-or-model`, `x-or-supports-grounding`
- Returns 401 if `x-or-key` is missing
- Runs heuristic detection locally, then calls OpenRouter with `json_schema` structured output (`temperature: 0.1`)
- Auto-appends `:online` for truth-dependent types (claim, question, entity, quote, reference, definition, narrative) when grounding is supported
- Returns: `{ contentType, category, annotation, confidence, influencedByIndices, isUnrelated, mergeWithIndex }`

### `POST /api/ghost`

- Body: `{ context }`; Headers: `x-or-key`, `x-or-model`
- Returns 401 if `x-or-key` is missing
- Falls back to `"google/gemini-2.0-flash-lite-001"` if no model header (`temperature: 0.7`)
- Returns: `{ text, category }` — 15–25 word emergent thesis

## Views

### Tiling (`components/tiling-area.tsx`)

Default view. Uses a **BSP (Binary Space Partitioning) tree** layout — blocks are chunked into pages of 7 (task blocks excluded from the grid) and recursively split into a binary tree alternating vertical and horizontal splits. Collapsed tiles shrink to 42px. A task block renders separately via `KanbanArea` embedded below the grid. Scroll is horizontal across pages.

### Kanban (`components/kanban-area.tsx`)

Groups all blocks by `contentType` into columns. Column priority: task → thesis → processing → rest. Uses `KanbanMinimap` for navigation.

## Key Components (`components/`)

| File | Purpose |
|---|---|
| `tile-card.tsx` | Core block card. Exports `TextBlock` type. Edit (double-click), category/annotation edit, pin, delete, collapse, sub-tasks, confidence bar, sources, influences tooltip, RTL detection. `React.memo`-ized. |
| `tiling-area.tsx` | BSP tiling view. |
| `kanban-area.tsx` | Kanban view with `KanbanMinimap`. |
| `kanban-minimap.tsx` | Floating minimap for kanban — icon buttons with hover count badges. |
| `project-sidebar.tsx` | Slide-in left panel. Lists projects with rename/delete. **Embeds AI settings** (API key, model selector, web grounding toggle). |
| `settings-panel.tsx` | Exists as a component but is not wired into `page.tsx` — settings live inside the sidebar. |
| `status-bar.tsx` | Top header: menu button, wordmark, project name, node count, enriching/error indicators, type breakdown, model label, clock, index toggle. |
| `ghost-tile.tsx` | Bottom tray for emergent thesis. "Solidify" and dismiss buttons. |
| `vim-input.tsx` | Bottom input bar. Uses `cmdk` for Cmd+K command popover (views, export, copy, clear, help). Enter submits a new block. **This is the active input.** |
| `command-palette.tsx` | Alternative `cmdk` palette — exists but not the active one. |
| `standard-command-k.tsx` | Another palette variant — exists but not wired into `page.tsx`. |
| `tile-index.tsx` | Right panel (toggleable). Groups blocks by category (tiling) or type (kanban). Highlight-on-hover synced with `highlightedBlockId`. |
| `theme-provider.tsx` | Thin wrapper around `next-themes`. |
| `components/ui/` | 44 shadcn/ui components. |

> **Note**: `unified-input.tsx` mentioned in older docs does **not exist** in the codebase. The active input is `vim-input.tsx`.

## UI Patterns

- **shadcn/ui** (44 components in `components/ui/`) — prefer extending existing components over adding new primitives.
- **Styling**: Tailwind CSS v4 with `cn()` from `lib/utils.ts`. Dark-first design using oklch color space. Custom scrollbar styles and `shimmer-text` animation for enriching state.
- **RTL**: Auto-applied `.rtl-text` class when Arabic/Hebrew characters detected in a block.
- **Animations**: Framer Motion for transitions.
