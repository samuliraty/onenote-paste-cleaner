# Paste Cleaner — paste-cleaner.com

Static site that cleans Office/Google/Markdown clipboard content in the browser. No backend, ever — the zero-cost guarantee depends on it.

## Hard constraints

- **Cloudflare Pages Free, static only.** No Workers, Functions, KV, R2, D1 or any binding with a paid tier. Nothing that can bill under traffic spikes.
- **All processing client-side.** Pasted content never leaves the browser; the privacy claim is on every page. No analytics beyond Cloudflare Web Analytics (cookieless).
- **No secrets in the repo.** AdSense IDs are public by nature; everything else lives in dashboards.

## How things are done

- Stack: Astro 7 static output, one vanilla-TS island (`src/components/Tool.astro`), cleaner logic in `src/lib/clean.ts` (DOMPurify + Turndown + marked).
- Config: `src/config/site.ts` (name, domain, contact email), `src/config/ads.ts` (AdSense publisher + slot IDs). Empty slot ID = that unit renders nothing in prod, striped placeholder in dev.
- Landing pages: one per source app or query intent under `src/pages/`, all thin wrappers around `ToolPage.astro` (hero + tool + prose + FAQ with JSON-LD). New SEO page = new file there + homepage Guides link (+ nav link if it earns it; nav is near wrap point at 7 items).
- Output modes: rich / plain / markdown / jira ("Atlassian" in UI = Jira/Confluence wiki markup). New modes touch `clean.ts` (converter + `Mode` type), `Tool.astro` (tab + hint + textFor), and the mode FAQ copy on index/how-it-works.
- Tests: `npm test` (vitest + jsdom) covers `clean.ts` only; fixtures are realistic OneNote/Word/Google Docs clipboard HTML pasted into `clean.test.ts`. Bug fix in the cleaner = fixture reproducing it first.
- Design: mockups live in the claude-design project "OneNote Paste Cleaner" (7a3930a4-bd8b-4dc2-9112-fcca13a9572c); design there first, then port to Astro by hand.
- Deploy: `npm run build && npx wrangler pages deploy dist --project-name paste-cleaner --branch main`. The GitHub repo (samuliraty/onenote-paste-cleaner) is the source of truth but does NOT auto-deploy — always deploy via wrangler AND push in the same change. Gate deploys on tests passing.
- Non-affiliation notices (ToolPage hero + Footer) must name every company whose product the site references: currently Microsoft, Google, Atlassian.

## Accounts (dashboards, not code)

- Cloudflare: user's account; zone paste-cleaner.com, Pages project `paste-cleaner`.
- AdSense: **business** account, ca-pub-8592213644175053 (in `ads.ts` and `public/ads.txt`). Owned by a separate company Gmail, not the user's personal account. GDPR consent via AdSense's built-in CMP.
- Search Console: verified for paste-cleaner.com; request indexing for every new page.

See `DECISIONS.md` for the original design decisions and their rationale.

## Status (2026-09-07)

- Live at https://paste-cleaner.com (+ www), Search Console verified, sitemap submitted.
- AdSense: site review pending on the business account since 2026-09-01 ("getting ready"). Ad units hidden until approval; when it lands, put the four slot IDs (leaderboard, inContent, sidebar, anchor) into `ads.ts` and redeploy. ads.txt shows "not found" in AdSense until their crawler refetches — file is live and correct, no action.
- Safe Browsing: /outlook/ was flagged as a false positive 2026-08-28, review requested; verify it cleared.
- Cloudflare Web Analytics: not set up — beacon token in `Base.astro` is empty. Optional.
- Update this section when any of these change.
