# Decisions

## Questions

- **Clipboard output?** Plain text + cleaned semantic HTML written together. — Rich targets keep structure, plain targets get text.
- **Output modes?** Rich (default) / Plain / Markdown toggle. — Widens audience (Slack, GitHub, Notion) and SEO surface.
- **Scope of sources?** OneNote-first brand, with /word, /outlook, /google-docs landing pages sharing the same tool. — Niche ranking plus adjacent traffic.
- **Ad network?** AdSense at launch, manually placed swappable slots; migrate to Mediavine/Raptive once traffic qualifies. — Only network that accepts a zero-traffic site.
- **Consent?** Google's built-in CMP (AdSense Privacy & messaging). — Free and certified; third-party CMPs bill with traffic.
- **Hosting cost ceiling?** Fully static Cloudflare Pages Free, zero Workers/Functions/KV/R2, all processing client-side. — No billable surface, so DDoS/traffic spikes cannot cost money.
- **Stack?** Astro + vanilla TS island, DOMPurify, Turndown. — Static output, easy landing pages, fast Lighthouse.
- **Deploy?** GitHub repo via gh, Cloudflare Pages on *.pages.dev until a domain is bought. — Domain should not imply Microsoft affiliation.
- **Name?** "OneNote Paste Cleaner", repo `onenote-paste-cleaner`. — Keyword-exact title.

## Ratified assumptions

- Input is a contenteditable paste target (a plain textarea drops the HTML clipboard flavor).
- Preview shows the rendered cleaned output with a toggle to see the raw output string.
- Images are dropped from output (OneNote pastes them as local file refs or base64; targets rarely accept them).
- Page design is done via the claude-design MCP and then ported into Astro.
- Analytics: Cloudflare Web Analytics only (free, cookieless, no consent impact).
- Ad slot IDs and publisher ID live in one config file; site runs with placeholder boxes until the ca-pub id is supplied.
