# 🔐 GitHub Secrets — Configuration Reference

This file documents all secrets that must be added to your GitHub repository
before the CI/CD pipeline will work.

Go to: **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**

---

## ☁️ Client Secrets (Next.js / Vercel)

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Full URL of your backend API (for browser requests) | `https://api.deepocean.fish` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Client ID for browser login button | `123456789.apps.googleusercontent.com` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for frontend error tracking | `https://abc@o123.ingest.sentry.io/456` |

---

## 🖥️ Server Secrets (Node.js / Express)

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/fish_market` |
| `REDIS_URL` | Redis connection string | `redis://default:password@host:6379` |
| `JWT_SECRET` | Secret for signing access tokens | Use `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | Use `openssl rand -hex 64` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (server-side) | `123456789.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-xxxxxxxxxxxxxxxxxxxx` |
| `SENTRY_DSN` | Sentry DSN for server error tracking | `https://abc@o123.ingest.sentry.io/789` |
| `WEB_PUSH_PUBLIC_KEY` | VAPID public key for Web Push | Generate with `web-push generate-vapid-keys` |
| `WEB_PUSH_PRIVATE_KEY` | VAPID private key for Web Push | Generate with `web-push generate-vapid-keys` |

---

## 🚀 Deployment Secrets

### Vercel (Client Deployment)

| Secret Name | Description | How to get |
|-------------|-------------|------------|
| `VERCEL_TOKEN` | Personal Access Token from Vercel | vercel.com → Settings → Tokens |
| `VERCEL_ORG_ID` | Your Vercel team/org ID | Found in `vercel link` output or `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | Found in `.vercel/project.json` after `vercel link` |

> [!TIP]
> Run `vercel link` inside the `/client` directory once to generate the `.vercel/project.json` file with your ORG_ID and PROJECT_ID.

### VPS / SSH (Server Deployment)

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SSH_HOST` | IP address or hostname of your server | `123.45.67.89` or `myserver.com` |
| `SSH_USERNAME` | SSH login username | `ubuntu` or `root` |
| `SSH_PRIVATE_KEY` | RSA/Ed25519 private key (full contents of `~/.ssh/id_rsa`) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

> [!IMPORTANT]
> Generate a dedicated deploy keypair: `ssh-keygen -t ed25519 -C "gh-actions-deploy"`
> Add the **public key** to your server's `~/.ssh/authorized_keys`
> Add the **private key** contents as the `SSH_PRIVATE_KEY` secret.

> [!CAUTION]
> Never commit any of these secrets to your repository. The `.env` files are
> already excluded via `.gitignore`. This file only documents the secret names —
> the values must be added through GitHub's UI.

---

## 🔑 Generating Secrets Locally

```bash
# Generate JWT secrets (run twice for access + refresh)
openssl rand -hex 64

# Generate VAPID keys for Web Push
npx web-push generate-vapid-keys

# Get Vercel IDs
cd client && vercel link
cat .vercel/project.json
```
