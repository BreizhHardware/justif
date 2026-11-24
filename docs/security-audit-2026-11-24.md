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
Corrigés et re-testés en blackbox : #1 (démarrage refusé sans `JWT_SECRET` fort hors dev/test), #2 (whitelist JPEG/PNG/WebP/PDF, extension dérivée du type, CSP sandbox + nosniff), #3 (setup atomique), #4 (rate-limit auth : 20/15 min/IP), #5 (`TRUST_PROXY`), #6 (propriétaire ou MANAGE_USERS), #7 (CORS liste blanche), #8 (liaison par email exige `email_verified === true`), #9 partiel (`COOKIE_SECURE=true` pour le flag Secure), #11 (bcrypt toujours exécuté), `X-Powered-By` retiré + en-têtes de base.
Restent ouverts : #9 (JWT dans le corps JSON), #10 (révocation de session), #12 (GET export à effet de bbord, CSP complète), #13 (validation des entrées).

## Correctifs recommandés (initiaux)
1. Refuser de démarrer sans `JWT_SECRET` fort (≥32 car., ≠ valeur d'exemple).
2. Whitelist MIME/extension (jpg/png/webp/pdf), extension dérivée du type détecté ; `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` + CSP sandbox sur `/uploads` ; contrôle propriétaire/permission.
3. `/setup` dans une transaction + garde unique (ou jeton d'installation).
4. `express-rate-limit` sur les routes auth ; `app.set("trust proxy", …)` configurable.
5. CORS : liste blanche explicite ; `Secure` en prod ; `helmet`.
6. OIDC : exiger `email_verified === true` pour lier par email.
