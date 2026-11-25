# Audit de sécurité — 2026-11-24 (whitebox + blackbox local)

Blackbox : instance locale jetable (DB/uploads temporaires), aucune cible externe.

| # | Sév. | Faille | Statut |
|---|------|--------|--------|
| 1 | Haute | Secret JWT par défaut codé en dur (`middleware/auth.ts`) : forge de token → prise de compte admin si `JWT_SECRET` non défini ou laissé à la valeur de `.env.example` | Confirmé |
| 2 | Haute | XSS stocké : `POST /api/expenses` accepte n'importe quel fichier, extension = celle fournie par le client ; `/uploads` sert `.html`/`.svg` en `text/html` same-origin → un utilisateur simple exécute du JS dans la session d'un admin | Confirmé |
| 3 | Haute | `/api/auth/setup` : race condition → plusieurs comptes admin créés en parallèle (5/5) ; endpoint ouvert tant qu'aucun compte n'existe | Confirmé |
| 4 | Moyenne | Aucun rate-limit : `/login`, `/forgot-password`, `/reset-password` (40 essais → 40×401, aucun blocage) ; flood d'emails possible | Confirmé |
| 5 | Moyenne | `ipFromReq` fait confiance à `X-Forwarded-For` sans `trust proxy` → IP du journal d'audit falsifiable | Confirmé |
| 6 | Moyenne | `/uploads/*` : tout utilisateur authentifié lit les reçus de n'importe qui (pas de contrôle de propriétaire ; protégé seulement par un nom UUID) | Confirmé |
| 7 | Moyenne | CORS `origin: true` + `credentials: true` quand `NEXT_PUBLIC_API_URL` est défini (reflète toute origine) | Code |
| 8 | Moyenne | OIDC : rattachement à un compte existant par email si `email_verified` absent (seul `false` est rejeté) | Code |
| 9 | Basse | Cookie sans `Secure` ; JWT aussi renvoyé dans le corps JSON | Code |
| 10 | Basse | Pas de révocation de session (logout, reset mdp, désactivation tolérée par `active` seulement) ; JWT 30 j | Code |
| 11 | Basse | Énumération de comptes par timing au login (bcrypt sauté si utilisateur inconnu) | Code |
| 12 | Basse | `GET /expenses/export` modifie l'état (statut « exported ») ; pas de `helmet`/CSP ; `X-Powered-By` exposé | Code |
| 13 | Basse | Entrées non validées (`Number("abc")`, `Invalid Date`) → 500 | Code |

Dépendances : `pnpm audit` → 2 avis (effect ReDoS, fflate) corrigés par overrides dans `pnpm-workspace.yaml` (branche `chore/update-deps`).

## Correctifs appliqués (branche `chore/update-deps`)
Tous corrigés et couverts par des tests (`apps/backend/tests/routes/security.test.ts`), sauf #8 volontairement non appliqué (Authentik n'expose pas `email_verified` : la liaison par email reste permise tant que le fournisseur n'envoie pas `email_verified: false`).

- #1 démarrage refusé sans `JWT_SECRET` fort hors dev/test.
- #2 whitelist JPEG/PNG/WebP/PDF, extension dérivée du type, CSP sandbox + nosniff sur `/uploads`.
- #3 setup atomique (transaction).
- #4 rate-limit auth : 20 / 15 min / IP (`RATE_LIMIT_DISABLED=true` pour les e2e).
- #5 `TRUST_PROXY` explicite ; `X-Forwarded-For` ignoré sinon.
- #6 `/uploads` limité au propriétaire ou à `MANAGE_USERS`.
- #7 CORS en liste blanche.
- #9 JWT retiré du corps JSON ; `COOKIE_SECURE=true` active le flag Secure.
- #10 `User.sessionsValidFrom` : les sessions antérieures à un changement/reset de mot de passe sont rejetées.
- #11 bcrypt toujours exécuté au login.
- #12 export refusé si `Sec-Fetch-Site: cross-site` ; CSP `default-src 'none'` + `no-store` sur `/api` ; `X-Powered-By` retiré ; `nosniff`, `X-Frame-Options`, `Referrer-Policy`.
- #13 validation (dates, montants, devise, longueur) → 400 ; pagination plafonnée à 100.

## Correctifs recommandés (initiaux)
1. Refuser de démarrer sans `JWT_SECRET` fort (≥32 car., ≠ valeur d'exemple).
2. Whitelist MIME/extension (jpg/png/webp/pdf), extension dérivée du type détecté ; `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` + CSP sandbox sur `/uploads` ; contrôle propriétaire/permission.
3. `/setup` dans une transaction + garde unique (ou jeton d'installation).
4. `express-rate-limit` sur les routes auth ; `app.set("trust proxy", …)` configurable.
5. CORS : liste blanche explicite ; `Secure` en prod ; `helmet`.
6. OIDC : exiger `email_verified === true` pour lier par email.
