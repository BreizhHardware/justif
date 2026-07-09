# Contributing to Justif

Thanks for your interest in Justif! This project is young and all
contributions are welcome: bug fixes, features, translations, documentation.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm --filter backend run db:migrate
pnpm run dev
```

## Before opening a Pull Request

- Keep changes focused: one PR = one topic
- TypeScript runs in strict mode — make sure it builds (`pnpm --filter backend run build`, `pnpm --filter frontend run build`)
- Run the linter: `pnpm run lint`
- Clearly describe the problem solved or the feature added

## Contributing a translation

UI strings live in `apps/frontend/locales/`. To add a new language:
1. Copy `apps/frontend/locales/en.json` to `apps/frontend/locales/<lang>.json`
2. Translate all values (keep the keys identical)
3. Register the new locale in `apps/frontend/lib/i18n.ts` (add it to `SUPPORTED` and import the JSON)

## Tests

Backend tests use [Vitest](https://vitest.dev/) and run against a real SQLite database (no mocks):

```bash
pnpm --filter backend run test
```

Frontend tests don't exist yet — contributions to set up a testing strategy (component tests, e2e, etc.) are very welcome.

If your PR adds or changes behaviour, please include or update the relevant tests. If you genuinely can't write a test for something, explain why in the PR description — that's fine, but skipping tests without a reason is not.

## Use of AI tools

You are free to use AI assistants (Copilot, Claude, ChatGPT, etc.) while contributing. If you do, please:

- **Disclose it** in your PR description (a single line is enough, e.g. "Parts of this were written with Claude")
- **Own the code** — you are fully responsible for reviewing, testing, and standing behind every line, AI-generated or not
- **Do not submit code you don't understand** — if an AI produced something you can't explain, take the time to understand it first

There is no shame in using these tools; the only requirement is honesty.

## Reporting a bug / requesting a feature

Use the GitHub [issue templates](.github/ISSUE_TEMPLATE/).
