# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the frontend app (Vite + React + TypeScript).
- `src/pages/` holds route-level screens (`Login.tsx`, `Home.tsx`, etc.).
- `src/components/` contains shared UI and layout pieces; reusable shadcn components live in `src/components/ui/`.
- `src/contexts/`, `src/hooks/`, and `src/lib/` contain app state, custom hooks, and utilities.
- `src/integrations/supabase/` contains Supabase client and generated types.
- `src/test/` contains test setup and test files.
- `supabase/migrations/` and `supabase/functions/` store database migrations and Edge Functions.
- `public/` stores static assets served directly.

## Build, Test, and Development Commands
- `npm i`: install dependencies.
- `npm run dev`: start local Vite dev server.
- `npm run build`: create production build in `dist/`.
- `npm run build:dev`: build using development mode flags.
- `npm run preview`: preview the production build locally.
- `npm run lint`: run ESLint across the project.
- `npm run test`: run Vitest once.
- `npm run test:watch`: run Vitest in watch mode.

## Coding Style & Naming Conventions
- Use TypeScript (`.ts/.tsx`) and functional React components.
- Follow existing formatting: 2-space indentation, semicolons, and double quotes.
- Use path alias `@/` for imports under `src/` (configured in Vitest/Vite).
- Component and page files use `PascalCase` (`UsersPage.tsx`); hooks use `use*` (`use-toast.ts`); utility files use concise lowercase names (`utils.ts`).
- Run `npm run lint` before opening a PR.

## Testing Guidelines
- Framework: Vitest with `jsdom` and Testing Library (`src/test/setup.ts`).
- Test file pattern: `src/**/*.{test,spec}.{ts,tsx}`.
- Keep tests near feature code or under `src/test/` when shared.
- Prefer behavior-focused tests for routes, auth guards, and Supabase interactions.

## Commit & Pull Request Guidelines
- Recent history mixes styles, but prefer Conventional Commits: `feat:`, `fix:`, `chore:`, with optional scope (e.g., `fix(auth): handle expired session`).
- Keep commits focused and atomic.
- PRs should include: concise description, impacted areas, test evidence (`npm run test`, `npm run lint`), linked issue/task, and screenshots for UI changes.

## Security & Configuration Tips
- Keep secrets in `.env`; never commit production credentials.
- Review Supabase migration SQL carefully and document irreversible changes in PR descriptions.
