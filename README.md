# Paste Cleaner

Static site at https://paste-cleaner.com that strips Office/Google formatting from pasted content and writes clean text, HTML or Markdown to the clipboard. Everything runs in the browser; there is no backend.

## Develop

```
npm install
npm run dev      # local dev server
npm test         # cleaner unit tests
npm run build    # static output in dist/
```

## Deploy

Cloudflare Pages, Free plan, connected to this GitHub repo. Build command `npm run build`, output directory `dist`, Node 22. No Functions, KV, R2 or Workers are used, so there is no billable surface.

## Ads

`src/config/ads.ts` holds the AdSense publisher ID and slot IDs. Until `publisherId` is set the site renders striped placeholder boxes. Consent for EU/UK visitors comes from AdSense's built-in Privacy & messaging CMP; enable it in the AdSense dashboard.

See `DECISIONS.md` for the design decisions behind the project.
