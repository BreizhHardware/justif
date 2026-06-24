# Contribuer à Justif / Contributing to Justif

## 🇫🇷 Français

Merci de votre intérêt pour Justif ! Ce projet est jeune et toutes les
contributions sont bienvenues : correctifs, fonctionnalités, traductions,
documentation.

### Mise en place

```bash
pnpm install
cp .env.example .env
pnpm --filter backend run db:migrate
pnpm run dev
```

### Avant d'ouvrir une Pull Request

- Gardez les changements ciblés : une PR = un sujet
- Le code TypeScript est en mode strict — vérifiez qu'il compile (`pnpm --filter backend run build`, `pnpm --filter frontend run build`)
- Lancez le linter : `pnpm run lint`
- Décrivez clairement le problème résolu ou la fonctionnalité ajoutée

### Contribuer une traduction

Les chaînes UI sont centralisées dans `apps/frontend/lib/i18n.ts`. Ajoutez
une nouvelle clé de langue dans l'objet `messages` en suivant la structure
existante (`fr`).

### Signaler un bug / proposer une fonctionnalité

Utilisez les [templates d'issues](.github/ISSUE_TEMPLATE/) GitHub.

---

## 🇬🇧 English

Thanks for your interest in Justif! This project is young and all
contributions are welcome: bug fixes, features, translations, documentation.

### Setup

```bash
pnpm install
cp .env.example .env
pnpm --filter backend run db:migrate
pnpm run dev
```

### Before opening a Pull Request

- Keep changes focused: one PR = one topic
- TypeScript runs in strict mode — make sure it builds (`pnpm --filter backend run build`, `pnpm --filter frontend run build`)
- Run the linter: `pnpm run lint`
- Clearly describe the problem solved or the feature added

### Contributing a translation

UI strings are centralized in `apps/frontend/lib/i18n.ts`. Add a new
language key to the `messages` object following the existing (`fr`)
structure.

### Reporting a bug / requesting a feature

Use the GitHub [issue templates](.github/ISSUE_TEMPLATE/).
