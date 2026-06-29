# Setup & Onboarding

Zero-to-running guide for the Chandni Traders monorepo.

---

## Prerequisites

| Tool | Requirement |
| ---- | ----------- |
| **Node.js** | 22+ (see `.node-version`) |
| **npm** | 10+ |
| **Git** | Recent stable |
| **MongoDB** | Atlas cluster or local |

Optional for production parity:

- PayFast or Rapid Gateway (pay online)
- Vercel Blob or S3 token (images and uploads)
- Meta WhatsApp Cloud API (customer OTP + order/chat notifications)
- Resend (admin password reset + staff email alerts)
- OpenAI or Google AI key (chat assistant)

---

## Boot sequence

```mermaid
flowchart TD
  CLONE[Clone + npm install] --> ENV[Copy .env.local]
  ENV --> MONGO[MongoDB URI + IP allowlist]
  MONGO --> DEV[npm run dev]
  DEV --> ADMIN[Admin :3001 sign-in]
  ADMIN --> SETTINGS[Fill settings tabs]
  SETTINGS --> CATALOG[Create catalog]
  CATALOG --> TEST[Storefront :3000 smoke test]
  TEST --> GOLIVE[go-live.md production checklist]
```

**Production launch:** follow [go-live.md](go-live.md) after local smoke test passes.

---

## 1. Clone and install

```bash
git clone <repository-url>
cd chandniTraders
npm install
```

---

## 2. Environment variables

```bash
cp .env.example .env.local
```

Production (configure in **Admin → Settings → Integrations**):

| Area | Required for |
| ---- | ------------ |
| **PayFast / Rapid Gateway** | Pay online — pick one provider; webhooks `/api/webhooks/payfast` or `/api/webhooks/rapid-gateway` |
| **Meta WhatsApp** | Customer OTP sign-in |
| **Resend** | Admin password reset + staff email alerts |
| **Storage** | Vercel Blob or S3 uploads |

Env vars in `.env.example` are bootstrap fallbacks only. `AUTH_*` and `MONGODB_URI` must stay on the host.

Minimum to boot locally:

| Variable | Required? | Purpose |
| -------- | --------- | ------- |
| `AUTH_SECRET` | **Yes** | Session encryption — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTH_URL` | **Yes** | App origin — `http://localhost:3000` (storefront) or `http://localhost:3001` (admin-only dev) |
| `AUTH_TRUST_HOST` | **Yes** | `true` |
| `MONGODB_URI` | **Yes** | Connection string **with database name** in path |
| `STORAGE_PROVIDER` | **Yes** | `vercel-blob` (default) or `s3` |
| `BLOB_READ_WRITE_TOKEN` | **Yes** for uploads | Vercel Dashboard → Storage (skip only if not testing uploads) |

Production (storefront `@store/web`):

| Variable | Required? | Purpose |
| -------- | --------- | ------- |
| `OTP_PROVIDER` | **Yes** | `whatsapp-cloud` |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | **Yes** | Meta Business permanent token |
| `WHATSAPP_PHONE_NUMBER_ID` | **Yes** | Sender phone number ID |
| `WHATSAPP_OTP_TEMPLATE_NAME` | Recommended | Default `authentication` |

Production (admin `@store/admin`):

| Variable | Required? | Purpose |
| -------- | --------- | ------- |
| `RESEND_API_KEY` | **Yes** | Admin password reset + staff email alerts |
| `RESEND_FROM_EMAIL` | **Yes** | Verified sender in Resend |
| `ADMIN_SITE_URL` | **Yes** | Reset links and inquiry deep links — e.g. `https://admin.yourdomain.com` |
| `STAFF_NOTIFY_EMAIL` | Recommended | Extra staff inbox; **all active admin users** also receive email alerts |
| `STAFF_NOTIFY_WHATSAPP` | Recommended | Global staff WhatsApp line for shop-wide alerts |
| `WHATSAPP_STAFF_NOTIFY_TEMPLATE` | Recommended | Meta utility template — staff order + chat alerts |
| `WHATSAPP_CUSTOMER_ORDER_TEMPLATE` | Recommended | Meta utility template — customer order placed, status updates, agent chat replies |

Common optional:

| Variable | Purpose |
| -------- | ------- |
| `STOREFRONT_BASE_URL` | Canonical URL when Admin → Site URLs empty |
| `ATLAS_SEARCH_ENABLED` | `false` forces regex search |
| `MONGODB_SEARCH_INDEX` | Atlas index name (default `products_search`) |
| `STAFF_NOTIFY_WHATSAPP` + `WHATSAPP_STAFF_NOTIFY_TEMPLATE` | Staff WhatsApp on orders + chat |
| `WHATSAPP_CUSTOMER_ORDER_TEMPLATE` | Customer WhatsApp on orders + agent replies |
| `OPENAI_API_KEY` / `GOOGLE_AI_API_KEY` / `ANTHROPIC_API_KEY` | Chat assistant |
| `AWS_S3_*` | S3 storage when `STORAGE_PROVIDER=s3` |
| `DEV_SKIP_PUBLIC_DNS` | `true` if local DNS blocks public resolvers |

Full list: [.env.example](../.env.example).

---

## 3. MongoDB

1. Create database (e.g. `chandni-traders`).
2. Whitelist IP in Atlas → Network Access.
3. URI includes database name:

   `mongodb+srv://user:pass@cluster.mongodb.net/chandni-traders?retryWrites=true&w=majority`

**Catalog** is created in Admin or restored from backup — not bundled in the repo.

### Atlas Search (optional)

```mermaid
flowchart LR
  IDX[Create products_search index] --> ON[ATLAS_SEARCH_ENABLED true]
  ON --> RANK[Ranked shop + chat search]
  OFF[ATLAS_SEARCH_ENABLED false] --> REGEX[Regex search]
```

---

## 4. Run development servers

```bash
npm run dev          # storefront only → http://localhost:3000 (lighter default)
npm run dev:all      # storefront + admin together (needs ~2× RAM/disk)
npm run dev:web      # same as npm run dev
npm run dev:admin    # admin only     → http://localhost:3001
```

**Resource tips:** Next.js dev writes a large cache under `apps/*/.next/dev` (often 1–3 GB per app; can grow further over long sessions). If disk or memory spikes:

1. Stop dev servers and run `npm run clean:next` to wipe `.next` + Turbo cache.
2. Prefer `npm run dev` (storefront only) over `dev:all` unless you need admin at the same time.
3. Turbopack is opt-in: `npm run dev:turbo -w @store/web` when you want faster compiles and accept a larger cache.

---

## 5. First-time operator checklist

| # | Task |
| - | ---- |
| 1 | Admin sign-in |
| 2 | **Settings → Site URLs** — public storefront URL |
| 3 | **Store / Contact / Payments / Delivery / Policies** — card+COD, COD %, policy HTML |
| 4 | **Catalog** — categories → attributes → brands → products ([catalog.md](catalog.md)) |
| 5 | Upload test product image — confirms Blob token |
| 6 | Storefront OTP sign-in — code in `@store/web` terminal when Meta WhatsApp env unset |

---

## 6. Quality commands

```bash
npm run lint
npm run typecheck
npm run build
npm run format
```

**Production build:** `npm run build` may connect to MongoDB during static generation. Atlas should be reachable from CI, but SEO/metadata loaders **fall back to factory defaults** when Mongo is down — the build should still complete. Prefer a stable connection so prerendered titles/OG tags use live admin settings.

Per-app builds:

```bash
npm run build --workspace=@store/web
npm run build --workspace=@store/admin
```

---

## 7. Go-live

Full production checklist — env vars, Admin Integrations, Shop Health, webhooks, smoke test:

**[go-live.md](go-live.md)**

---

## Repository structure

```
chandniTraders/
├── apps/
│   ├── web/          # Storefront — port 3000
│   └── admin/        # Admin — port 3001
├── packages/
│   ├── db/           # Mongoose models
│   ├── shared/       # Domain logic
│   └── ui/           # Shared components
├── docs/
└── README.md         # Domain specification
```

---

## Further reading

- [Go-live runbook](go-live.md)
- [Architecture](architecture.md)
- [Catalog operations](catalog.md)
- [Engineering handbook](engineering-handbook.md) — standards, optimizations, rule gaps (read before new features)
- [Website audit guide](website-audit.md)
- [README](../README.md)

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| Auth redirect loop | Missing `AUTH_SECRET` or wrong `AUTH_URL` | Match port 3000 |
| DB connection fail | IP block or missing DB name in URI | Atlas Network Access |
| SRV DNS `EREFUSED` | Local DNS cannot resolve Atlas SRV | Standard connection string or `DEV_SKIP_PUBLIC_DNS=true` |
| Image 500 on Blob host (`ENOTFOUND` in terminal) | Browser resolves Blob CDN but Node `/_next/image` could not — local DNS/router issue | Dev loads product images directly (pre-optimized WebP). Production uses the optimizer. Fix DNS or set `DEV_SKIP_PUBLIC_DNS=false` (default). Restart `npm run dev` after `.env` changes. |
| No OTP in dev | Meta WhatsApp unset | Read `@store/web` terminal log |
| Chat assistant silent | No AI API key | Add key or use human-only (Admin → Inquiries) |
| Product missing on shop | Failed visibility cascade or no variants | [README § visibility](../README.md#1-catalog--domain-rules) |
| Weak local search | No Atlas index | Create index or set `ATLAS_SEARCH_ENABLED=false` |
| Production build fails prerender | Rare after SEO fallbacks; still check Atlas + CI allowlist | [go-live.md](go-live.md) |
| Card paid, order still pending | Webhook missing amount or bad secret | Gateway dashboard; admin manual confirm |
| No staff notifications | Resend/WhatsApp/templates unset | Admin Integrations + Shop Health |
| Dev disk/RAM very high | Two Next dev servers + Turbopack `.next/dev` cache | `npm run dev` (one app), avoid `--turbopack`, `npm run clean:next`, quit stale `node` processes |
| `resolveCatalogVisibility failed` spam in web terminal | Fixed in current tree — stale React `cache()` inside `unstable_cache` | Pull latest; restart dev after `npm run clean:next` |
