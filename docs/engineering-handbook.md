# Engineering handbook

Project-specific engineering standards, optimizations inventory, and vibeCodingRules alignment notes for Chandni Traders. **Read this before adding features** so patterns stay consistent and regressions are avoided.

| Document | Purpose |
| -------- | ------- |
| [Setup & onboarding](setup.md) | Install, env, local dev |
| [Go-live runbook](go-live.md) | Production deploy and smoke test |
| [Architecture](architecture.md) | Monorepo, packages, request flow |
| [README](../README.md) | Domain rules (checkout, orders, loyalty, admin) |

**Universal rules (all projects):** `/Users/macbookpro/Github/vibeCodingRules/AGENTS.md` — routing authority for security, patterns, naming, caching, testing, etc. This repo mirrors those rules in `.cursor/rules/*.mdc`. **When this handbook and vibeCodingRules disagree on universal behavior, vibeCodingRules wins** unless this document records an explicit, reviewed project exception.

**Future:** Sections marked *candidate for vibeCodingRules* may be promoted upstream after the team stabilizes this format.

---

## 1. Rules for new functionality

Every new feature, route, or UI surface **must** follow these project rules in addition to vibeCodingRules.

### 1.1 Before you code

| Step | Action |
| ---- | ------ |
| 1 | Read relevant domain rules in [README](../README.md) (checkout, orders, offers, chat, etc.) |
| 2 | Read [architecture.md](architecture.md) for boundaries (`@store/shared` vs `@store/shared/server`) |
| 3 | Skim vibeCodingRules per task type (`/Users/macbookpro/Github/vibeCodingRules/AGENTS.md` routing matrix) |
| 4 | Run `npm run typecheck`, `npm run lint`, `npm run build` before merge |

### 1.2 Placement

| Surface | Where code lives |
| ------- | ---------------- |
| Storefront route UI | `apps/web/src/app/<url-segment>/` — colocate `_components/` with the route |
| Admin route UI | `apps/admin/src/app/<route>/_components/` |
| Shared primitives only | `components/ui/`, `components/layout/`, `components/forms/` |
| Cross-app domain logic | `packages/shared` (client-safe) or `packages/shared/server` (Node/DB only) |
| DB models & atomic ops | `packages/db` |
| API handlers | `apps/*/src/app/api/` — thin handlers; business logic in `lib/` or packages |

**Do not** import `@store/shared/server` or `@store/db` from client components (except `import type`).

### 1.3 Storefront API mutations (required sequence)

1. Rate limit (when public or abuse-sensitive)
2. `enforceSameOrigin` (when session cookie auth)
3. `getVerifiedCustomer()` (when customer auth required) — **never trust JWT claims alone**
4. `parseBody` + shared validators
5. Execute + DB (atomic for stock, offers, status)
6. Side effects (`void` notifications — never block response)
7. Safe DTO response

### 1.4 Admin API mutations (required sequence)

1. `requireSession(permission)` — auth, authZ, origin check, rate limit in one gate
2. `parseBody` + validators
3. Execute + DB
4. `bustAdminCaches()` when storefront-visible catalog/settings change
5. Fire-and-forget activity log / notifications
6. Safe DTO response

### 1.5 Security non-negotiables

| Rule | Implementation |
| ---- | -------------- |
| Server-side pricing | Never trust client `unitPriceRupees` at checkout |
| Stock | Reserve at order placement; release on cancel/refund/return |
| Idempotency | `idempotencyKey` on `POST /api/orders` |
| Sessions | `getVerifiedCustomer()` / `getVerifiedSession()` with DB enrichment |
| Secrets | Env only; mask in admin JSON serializers |
| Auth responses | Treat as `no-store` (see §3.2 — systemic gap to fix) |
| Payments | PayFast constant-time hash; Rapid webhook signature |

### 1.6 Performance expectations for new work

| Area | Expectation |
| ---- | ----------- |
| List pages | SSR seed + client pagination where applicable |
| Catalog reads | Use existing `cached.ts` helpers or extend with `unstable_cache` + tags |
| Admin writes that affect storefront | Call `bustAdminCaches()` |
| Images | Use `ProductImage` / upload pipeline variants; configure qualities in `next.config` |
| Client polling | **One** global poller per resource (see `useActiveOffers` pattern) — never per-card timers |
| Heavy UI | `next/dynamic` + idle deferral pattern from `AppShell` |
| Motion | Keep `RevealRoot` / route transitions; respect `prefers-reduced-motion` |

### 1.7 Naming & files (project + vibeCodingRules)

| Prefer | Avoid |
| ------ | ----- |
| Domain verb names (`CreateProduct`, `TeamInvite`) | `*Panel`, `*Drawer`, `*Modal` on domain screens (legacy debt) |
| PascalCase component files | `camelCase.tsx` for components (legacy in admin) |
| Plural REST nouns for new routes | Bare verbs in URL segments (`/cancel`, `/reconcile`) — legacy APIs exist |
| Co-locate route-only UI | New domain screens at `components/shared/` root |

### 1.8 Testing & CI today

| Status | Policy |
| ------ | ------ |
| No automated test harness yet | Manual smoke per [go-live.md](go-live.md) and [website-audit.md](website-audit.md) |
| CI runs | `typecheck` + `lint` only (`.github/workflows/ci.yml`) |
| Before merge | Run `npm run build` locally — **not** in CI yet |

When a test harness is added, behavior changes **must** include tests per vibeCodingRules `testing.md`.

---

## 2. Optimizations & improvements inventory (done)

Everything below is **already implemented**. Do not remove or bypass without updating this document and README/architecture.

### 2.1 Performance & caching

| Done | Detail | Location / notes |
| ---- | ------ | ---------------- |
| ISR | Hot storefront routes `revalidate` 30–60s; sitemap/robots/OG up to 1h | Route `export const revalidate` |
| `generateStaticParams` | Active category slugs prebuilt at deploy | Category routes |
| Two-tier server cache | `React.cache()` per request + `unstable_cache` cross-request | `apps/web/src/lib/core/cached.ts` |
| Cache tags | `revalidateTag(STOREFRONT_CACHE_TAG)` on admin catalog/settings writes | `bustAdminCaches()` |
| Boot warm | Settings, categories, grades, attributes, offers, hero, top category listings | `instrumentation.ts` → `warmStorefrontReadCaches()` |
| Router stale cache | Faster back/forward navigation | `experimental.staleTimes` in both `next.config.ts` |
| Idle route prefetch | Home, deals, about, cart, top categories after idle | `IdleRoutePrefetch.tsx` |
| Prefetch on intent | Product cards / nav hover intent | `usePrefetchOnIntent.ts` |
| Deferred client islands | Chat, search, heavy drawers | `next/dynamic` in `AppShell`, `ChatFabShell`, admin catalogs |
| Package import tree-shake | Smaller lucide + shared imports | `optimizePackageImports` |
| Bundle analyzer (web) | `ANALYZE=true npm run build` | `apps/web/next.config.ts` |
| Server externals | pino, mongoose, bcryptjs out of webpack bundles | `serverExternalPackages` |
| Infinite scroll | SSR seed + client pages | `useInfiniteProducts`, `useInfiniteList` |
| Single global offer poll | One revision timer for all subscribers | `useActiveOffers.ts` + `useSyncExternalStore` |
| Offer client cache | Module TTL + 20s revision polling | `useActiveOffers.ts` |
| 304 / ETag polling | Chat/inquiry `If-None-Match` / `?since` | Chat API routes |
| Web vitals | Client metrics → `POST /api/vitals` | `WebVitalsReporter.tsx` |
| Content visibility | `cv-auto-*` on long listings | Shop/deals sections |
| Priority images | `priority` + `sizes` on above-fold cards | `ProductCard`, `ProductImage` |
| Pre-uploaded WebP | thumb / card / detail / full + blur placeholders | Upload pipeline + `ProductImage` |

### 2.2 Images & media

| Done | Detail |
| ---- | ------ |
| Next image optimizer (production) | AVIF + WebP (`apps/web/next.config.ts`) |
| 7-day optimizer TTL | `minimumCacheTTL` on web |
| Per-variant quality | 65 / 70 / 80 / 85 in `ProductImage` + `images.qualities` |
| Dev image bypass | `unoptimized: true` in dev — avoids local Blob DNS / `/_next/image` 500s |
| Dev DNS resolvers | `configureDevDnsResolvers()` in `next.config.ts` + `instrumentation.ts` |
| Remote patterns | Blob, S3, Unsplash, simpleicons |
| Upload validation | Magic-byte checks; Sharp variants (admin) |

### 2.3 Security & commerce

| Done | Detail |
| ---- | ------ |
| Server-side pricing | DB re-read + offer evaluation at order placement |
| Atomic stock reserve | `reserveStock` / `releaseStock` with oversell guard |
| Order idempotency | Client `idempotencyKey` on `POST /api/orders` |
| Session enrichment | `getVerifiedCustomer()` / `getVerifiedSession()` + DB + short TTL cache |
| Admin RBAC | `requireSession(permission)` on mutations |
| CSRF | `enforceSameOrigin` on storefront mutations |
| Rate limits | Login, OTP, orders, chat, public APIs (in-memory token bucket) |
| PayFast | Constant-time hash compare |
| Rapid Gateway | Webhook signature verification |
| Order status races | `claimOrderStatusTransition` |
| Atomic offer usage | `incrementOfferUsageCounts` / `decrementOfferUsageCounts` |
| Password security | bcrypt 12+, hashed reset tokens, session kill on password change |
| Integration masking | Admin API masks keys before JSON |
| Security headers | CSP, HSTS (prod), `X-Frame-Options`, `nosniff`, `Permissions-Policy` |
| Separate auth cookies | Storefront vs admin |
| `@store/shared/server` split | Notifications / DB-only code out of client bundle |
| Chat access | `resolveChatAccess()` — customer or signed guest cookie |
| Chat list session fix | `GET /api/chat` uses `getVerifiedCustomer()` |
| Loyalty balance fix | `POST /api/loyalty-balance` session-only (no phone enumeration) |
| Team invite fix | Owner role invite requires super-admin |

### 2.4 Build & dev resilience

| Done | Detail |
| ---- | ------ |
| Fail-fast env | `assertServerEnv` at boot (web + admin) |
| Mongo pre-warm | Background connect in `instrumentation.ts` |
| SEO fallbacks | Defaults when Mongo unreachable at build |
| Build without Mongo | Prerender survives Atlas blips |
| Cache warm logging | Structured error `name` / `message` |
| Transpile workspace packages | `@store/db`, `@store/shared`, `@store/ui` |

### 2.5 UX, motion & storefront polish

| Done | Detail |
| ---- | ------ |
| Motion preserved | `RevealRoot`, `.reveal`, `NavigationProgress`, `RouteTransition` |
| `prefers-reduced-motion` | Shortens/disables animation — motion not removed for perf |
| Loading skeletons | 21× `loading.tsx` (web + admin) |
| Error boundaries + retry | Root + checkout/account + admin feature `error.tsx` |
| Empty states | Cart, shop listings, workspace panes, search |
| Mobile-first web | `MobileHeader`, bottom tab bar, 2-col grid default |
| Admin mobile | `MobileTopBar`, drawer nav |
| Optimistic UI | Cart, chat, filters; admin list patch/remove |
| Cart reconcile | Server refresh before checkout |
| Filters in URL | Shareable search/filter state |
| Design tokens (web) | CSS variables — color, radius, z-index, type |
| Skip nav (web) | `AppShell` |
| Toast a11y | `aria-live` |

### 2.6 Payments & notifications

| Done | Detail |
| ---- | ------ |
| PayFast + Rapid Gateway | Replaced Stripe; admin picks active provider |
| Bank transfer + COD + card | Checkout + admin payment settings |
| Staff email + WhatsApp | Orders, chat, escalation (fire-and-forget) |
| Customer WhatsApp | Order events + agent replies (utility templates) |
| Shop Health | Admin dashboard misconfig warnings |
| Resend | Password reset + staff email |

### 2.7 Admin & data

| Done | Detail |
| ---- | ------ |
| Admin cache bust | `bustAdminCaches()` on catalog/settings mutations |
| Activity log | Non-blocking audit trail |
| Scoped settings writes | Allowlisted keys per route |
| Serializers per app | Different DTOs for same Mongo documents |
| Permissions catalog | Typed permission keys shared client/server |

### 2.8 Documentation & CI

| Done | Detail |
| ---- | ------ |
| Domain README | Exhaustive business rules |
| Go-live runbook | [go-live.md](go-live.md) |
| Setup, architecture, audit, catalog | `docs/` |
| `.env.example` | Documented variables |
| GitHub CI | `typecheck` + `lint` on `main` / PRs |
| Cursor rules | `.cursor/rules/*.mdc` ↔ vibeCodingRules |

### 2.9 README performance summary (storefront)

| Mechanism | Effect |
| --------- | ------ |
| ISR 30s + router stale cache | Fresh catalog without per-hit full DB on every view |
| Boot warm | Cold paths primed after Mongo connect |
| Idle prefetch | Likely next routes prefetched after idle |
| Images | Optimizer AVIF/WebP; long TTL on product photos in prod |
| Motion | Reveals + nav progress + route cross-fade; reduced-motion safe |
| Build resilience | Settings/SEO/chat fallbacks when Mongo down at build/boot |

---

## 3. vibeCodingRules alignment — conflicts & gaps

Audit date: June 2026. **Do not treat as launch blockers** unless marked high and security-related. Use as backlog and guardrails for new code.

### 3.1 Severity legend

| Level | Meaning |
| ----- | ------- |
| **High** | Security, caching of auth data, or broken UX on failure — fix when touching that area |
| **Medium** | Standards drift, perf left on table, maintainability |
| **Low** | Style, legacy naming, documented exceptions |
| **Missing** | Infrastructure vibeCodingRules expects but project lacks |
| **OK** | Intentional deviation — do not “fix” without product decision |

### 3.2 High

| Rule source | Gap | Notes |
| ----------- | --- | ----- |
| caching.md | `packages/shared/src/responseHelpers.ts` — `ok()`, `created()`, etc. set no `Cache-Control: no-store` | Affects session, account, loyalty, most APIs; only `/api/offers` explicit today |
| logging.md | No `X-Request-ID` / correlation ID | Web + admin |
| logging.md | Dev OTP provider logs full code + phone | `apps/web/src/lib/otp/provider.ts` (`consoleProvider`) |
| security.md | Rate limits in-memory only | Multi-instance weak; documented in [go-live.md](go-live.md) — plan Redis/Upstash |
| frontend.md | Admin inquiry load failure → infinite skeleton | `inquiryConversationPanel.tsx` — no error/retry when `!isLoading && !inquiry` |

### 3.3 Medium — security & API

| Gap |
| --- |
| `POST /api/loyalty-balance` — no `enforceSameOrigin` (session cookie POST) |
| Un-rate-limited: account profile/addresses, customer-threads, payment webhooks/callbacks |
| Parse-before-rate-limit on some routes (orders, OTP, forgot-password) |
| Legacy REST **verb paths**: `/api/cart/reconcile`, `/api/orders/.../cancel`, `/api/offers/resolve`, `/api/cleanup`, `/api/auth/forgot-password`, `/api/auth/reset-password` |
| Singular collections: `/api/team`, `/api/chat`, `/api/session`, `/api/activity` |

### 3.4 Medium — caching & performance

| Gap |
| --- |
| Public JSON (`/api/products`, `/api/facets`, `/api/search`) — no browser `Cache-Control: public, max-age=…` |
| No SWR/React Query — custom caches + scattered `fetch` |
| No global “clear client cache on logout” |
| Admin `next.config` images thinner than web (no `formats`, `minimumCacheTTL`, `qualities`) |
| Admin — no bundle analyzer script |
| Silent fetch failures: deals catalog, facets, search, sidebar summary (no retry UI) |

### 3.5 Medium — logging

| Gap |
| --- |
| `console.error` in `apps/web/src/app/error.tsx`, `apps/admin/src/app/error.tsx` |
| Full email in auth logs — should mask per logging.md (`apps/admin/src/lib/auth.ts`, forgot-password route) |

### 3.6 Medium — naming & structure

| Gap |
| --- |
| Domain components with `*Panel`, `*Drawer`, `*Modal`, `*Catalog` (~40+ files) — legacy |
| camelCase component files in admin (`inquiryConversationPanel.tsx`, `settings*Tab.tsx`, etc.) |
| `ProductWizardStep1.tsx`, `ProductWizardStep2.tsx` — numeric disambiguation |
| `apps/web/src/components/shared/` — 49 domain files; acts as second feature root |
| `ProductsCatalog.tsx` — 1072 lines (past code-formatting hard limit ~1000) |
| Other oversized hot paths: `orders/route.ts` (~923), `FilterSidebar.tsx` (~786), `inquiryConversationPanel.tsx` (~715), etc. |

### 3.7 Medium — UI & formatting

| Gap |
| --- |
| Admin raw Tailwind colors (`rose-500`, `emerald-600`, invoice grays) vs semantic tokens |
| No dirty-form guard on product/offer/order drawer close |
| No skip-nav on admin |
| Some touch targets &lt; 44px (filters, dense admin) |
| `npm run format:check` fails on ~122 files — not in CI |
| Few space-indent files vs tabs; import-order drift in entry files |

### 3.8 Low

| Gap |
| --- |
| `setState` in `useEffect` with eslint-disable (some intentional) |
| Search uses raw `<img>` — documented in `SearchOverlay.tsx` |
| No dark mode (N/A until product wants theming) |
| Turbo `dev --parallel` deprecation warning |
| cursor-sync docs path `macbook` vs machine `macbookpro` — docs only |

### 3.9 Missing infrastructure

| Item | vibeCodingRules file |
| ---- | -------------------- |
| Automated tests (`*.test.ts` / `*.spec.ts`) | testing.md |
| CI `npm run build` | devops.md |
| CI `npm run format:check` | code-formatting.md |
| Pre-commit hooks (Husky) | git-workflow.md |
| DB migration files | database.md (Mongoose schema-only today) |
| Redis rate limiting / shared cache | caching.md, security.md |
| Unified client cache (SWR/React Query) | frontend.md, caching.md |
| E2E tests on checkout/auth | testing.md |

### 3.10 Intentional / acceptable deviations (do not break without ADR)

| Deviation | Reason |
| --------- | ------ |
| REST verb URL segments | Existing API contract; renames are breaking |
| Singular `/api/chat`, `/api/team` | Established shape |
| Chat polling vs WebSocket | Product choice; fits polling pattern |
| No i18n | Single locale — skip internationalization.md |
| In-memory rate limits at launch | Documented; swap Redis when multi-instance |
| `ProductCard` + `Card` primitive | naming.md Card exception |
| Admin `unoptimized` images in dev | Local Blob DNS reliability |
| Motion animations kept | Product requirement; reduced-motion only |

---

## 4. What is well aligned (keep doing this)

| Area | Evidence |
| ---- | -------- |
| Monorepo layout | `apps/web`, `apps/admin`, `packages/{db,shared,ui}` |
| Session verification | DB-enriched sessions both apps |
| Admin API auth | `requireSession(permission)` on mutations |
| Checkout security | Server pricing, stock, idempotency, CSRF |
| Secrets | Env-driven; masked in admin serializers |
| Security headers | Both `next.config.ts` files |
| Structured logging | `pino` + redaction; no debug `console.log` in app code |
| Web perf stack | ISR, `unstable_cache`, tags, prefetch, images, bundle tools |
| Documentation density | README + docs/ per documentation.md |
| Cursor rules install | `.cursor/rules` mirror vibeCodingRules |

---

## 5. Suggested fix backlog (priority order)

Use when scheduling post-launch hardening. **New features should not copy patterns marked “gap”.**

| Priority | Item |
| -------- | ---- |
| 1 | `Cache-Control: no-store` on auth/session/user responses (`responseHelpers` or per-route) |
| 2 | Admin inquiry panel — error state + retry on load failure |
| 3 | `enforceSameOrigin` on `loyalty-balance` |
| 4 | CI: add `npm run build` (+ optional `format:check`) |
| 5 | Critical-path tests (checkout, orders, auth) when harness exists |
| 6 | Public API `Cache-Control` for catalog JSON |
| 7 | Redis/Upstash rate limits before multi-region scale |
| 8 | Request ID middleware |
| 9 | Naming/structure refactors (panels → domain names, file splits) — large effort |

---

## 6. New developer checklist (first week)

| Day | Task |
| --- | ---- |
| 1 | [setup.md](setup.md) — install, `.env.local`, `npm run dev` |
| 2 | Read [README](../README.md) § checkout, orders, offers, chat |
| 3 | Read [architecture.md](architecture.md) + **this handbook** §1 |
| 4 | Skim vibeCodingRules `AGENTS.md` + `security.md`, `code-patterns.md` |
| 5 | Run `npm run typecheck && npm run lint && npm run build` |
| 6 | Walk [website-audit.md](website-audit.md) smoke paths locally |
| 7 | Before first PR: confirm no `@store/shared/server` in client components; no per-component poll timers |

---

## 7. Maintaining this document

| When | Update |
| ---- | ------ |
| New optimization shipped | Add row to §2 (correct section) |
| New vibeCodingRules conflict found or fixed | Update §3; remove from backlog §5 when done |
| CI/testing changes | Update §1.8 and §3.9 |
| Promoted rule to vibeCodingRules | Note in §1 header; trim duplicate if upstreamed |
| Behavior change affecting domain | Update [README](../README.md) in same PR |

**Format rules for edits:** Keep tables dense; use **bold labels**; no scratch prose; link to code paths not pasted blocks; one line per table row where possible.

---

## 8. Launch readiness snapshot

| Criterion | Status (codebase) |
| --------- | ----------------- |
| `lint` + `typecheck` + `build` | Pass |
| Security core (pricing, sessions, RBAC, webhooks) | Implemented |
| Performance stack (ISR, cache, images, offer poll fix) | Implemented |
| 100% vibeCodingRules compliance | No — see §3 |
| Automated tests | No — manual smoke required |
| Production ready | Yes **after** [go-live.md](go-live.md) integrations + one E2E order |
