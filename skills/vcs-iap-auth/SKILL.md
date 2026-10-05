---
name: vcs-iap-auth
description: Use when the user asks for login, authentication, RBAC, route protection, or admin access in a deployed VCS app — implement IAP JWT identity, never parallel password/session auth.
---

# VCS IAP Authentication

Cloud Run IAP already authenticates humans at ingress. The app's job is to **validate
the IAP JWT** and use **`email` + `sub`** for identity and optional RBAC — not to
build a second login system.

## When to use

Invoke this skill when the user mentions:

- login, sign-in, masuk, daftar, authentication, authorization
- RBAC, roles, permissions, hak akses, admin-only routes
- protecting pages or APIs, user identity, who is logged in

## Do not

- Password forms, `/login` handlers, bcrypt password tables for ingress auth
- Firebase client auth, express-session login, flask-login, custom JWT secrets as ingress gate
- Trusting `x-goog-authenticated-user-email` without validating `x-goog-iap-jwt-assertion`
- Bypassing IAP when `IAP_AUDIENCE` is empty in uat/prod (local dev only: `APP_ENV=local`)

## Do

1. Wrap the root handler chain with IAP middleware before business routes.
2. Exempt only `GET /healthz` from JWT validation.
3. Read identity from the **validated JWT**:
   - `sub` — stable identity key for audit logs
   - `email` — display name and RBAC lookups
4. Declare in `features.yaml`:

```yaml
features:
  authentication:
    iap: true
    identity:
      source: iap-jwt
      email_for_rbac: true
```

## Go recipe

Use the scaffold pattern (or `obs-go/iap` when available):

```go
handler := observability.Middleware(iapMiddleware(os.Getenv("IAP_AUDIENCE"), mux))

identity, err := currentIdentity(r.Context())
if err != nil {
    http.Error(w, "unauthorized", http.StatusUnauthorized)
    return
}
email := identity.Email // RBAC lookup key
```

Validation must check ES256, issuer `https://cloud.google.com/iap`, expiry, and the
exact `IAP_AUDIENCE` injected at deploy time.

Local dev bypass is allowed only when **`APP_ENV=local` and `IAP_AUDIENCE` is empty**.

Existing apps may keep a laptop password login (`/login`, session, bcrypt) if Cloud Run stays IAP-only: baked `config.sandbox.yaml` (or the YAML the Dockerfile copies onto the image config path) must set `auth.mode: iap`, and local mode must refuse to start unless `APP_ENV=local`. Do not add that second login to a new app.

## App RBAC on IAP email

Ingress auth stays IAP-only. Optional app roles map **IAP email → role**:

```sql
CREATE TABLE IF NOT EXISTS app_user_roles (
  email text PRIMARY KEY,
  role text NOT NULL
);
```

Middleware example:

```go
func requireRole(role string, next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        identity, err := currentIdentity(r.Context())
        if err != nil || !hasRole(r.Context(), identity.Email, role) {
            http.Error(w, "forbidden", http.StatusForbidden)
            return
        }
        next(w, r)
    }
}
```

Never store ingress passwords. Admin UI assigns roles by editing `app_user_roles`.

## Node.js / Python

Backend must validate `x-goog-iap-jwt-assertion` with the Google auth library and
read the `email` claim. See `vcs-platform` §7 and deployment-spec §7.1. Browser
code must never be the security boundary.

## Verify before deploy

- `grep` shows `x-goog-iap-jwt-assertion` and `IAP_AUDIENCE`
- No Cloud Run `/login` password route or Firebase auth import. Laptop `/login` is allowed only when `config.sandbox.yaml` (or Dockerfile-copied YAML) sets `auth.mode: iap`
- `features.authentication.iap: true`
- Run `/deploy` — deploygate rejects parallel Cloud Run auth patterns
