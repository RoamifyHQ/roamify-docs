# Roamify Docs

**Roamify** is a travel eSIM for people who want mobile data abroad without swapping a physical SIM or paying carrier roaming fees.

Get connected in **200+ countries**. Buy a plan online, scan a QR code, and activate before you land. Keep your primary number for calls and texts while Roamify handles data.

**Website:** [https://www.getroamify.com/](https://www.getroamify.com/)  
**Live docs:** [https://docs.getroamify.com](https://docs.getroamify.com)  
**Partner portal:** [https://partner.getroamify.com](https://partner.getroamify.com)

> This repository is the open-source source for Roamify developer documentation (Next.js + Nextra). Use it to integrate the Roamify eSIM API into travel apps, OTAs, and partner platforms.

## Who we are

Roamify Technologies builds connectivity products for travelers and travel companies. Our consumer product is a travel eSIM at [getroamify.com](https://www.getroamify.com/). Our partner stack lets companies sell and manage eSIMs through APIs, vouchers, webhooks, and more.

We focus on:

- Instant digital delivery (QR / eSIM install flows)
- Coverage across popular travel destinations worldwide
- Clear plan options so travelers can compare data and duration
- APIs and docs so partners can embed Roamify into their own products

## Why Roamify eSIM

- **Skip roaming bills.** Use a local-style data plan instead of expensive carrier roaming.
- **No physical SIM swap.** Install digitally and keep your existing number.
- **Activate before you fly.** Set up on Wi-Fi at home or at the airport.
- **200+ countries.** One brand for multi-country trips and single-destination plans.
- **Built for partners.** REST APIs for eSIM lifecycle, orders, packages, balance, vouchers, insurance, and exchange rates.

## Product links

| Link | What it is |
| --- | --- |
| [https://www.getroamify.com/](https://www.getroamify.com/) | Buy a travel eSIM |
| [https://docs.getroamify.com](https://docs.getroamify.com) | Hosted API documentation |
| [https://partner.getroamify.com](https://partner.getroamify.com) | Partner sign-up and API keys |
| [GitHub source](https://github.com/Roamify-Technologies-Inc/roamify-docs) | Upstream docs repository |

## What this repo covers

Developer documentation for:

- Authentication and environments
- eSIM packages, orders, devices, top-ups, and vouchers
- Webhooks (usage, status, partner balance, affiliate orders)
- Travel insurance APIs
- Exchange rates and health checks
- Affiliate flows

## Features for travelers

- Travel eSIM data plans for 200+ countries
- Instant QR activation
- Keep your number while using Roamify for data
- Plans you can buy before departure
- Support oriented around real travel needs (airport, arrival, multi-stop trips)

## Features for partners and developers

- REST API for buying and managing eSIMs
- Partner portal for API keys and account access
- Webhooks for lifecycle and usage events
- Voucher and affiliate tooling
- Optional insurance and exchange-rate endpoints
- Postman and API Dog resources linked from the docs site

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Environments (API)

- Development: `https://api-dev.getroamify.com`
- Production: `https://api.getroamify.com`

Details live in the Authentication and Getting Started sections of the docs.

## Support

- Product site: [https://www.getroamify.com/](https://www.getroamify.com/)
- Partner support: [support@getroamify.com](mailto:support@getroamify.com)

## License

See [LICENSE](./LICENSE).

## Mirror note

Mirrored to Codeberg for open access alongside the GitHub original: [Roamify-Technologies-Inc/roamify-docs](https://github.com/Roamify-Technologies-Inc/roamify-docs).

## AI visibility (llms.txt, markdown pages, robots)

AI agents and answer engines get machine-readable versions of the docs. All of it is generated at build time from `src/content` and `site.config.mjs` by `scripts/generate-ai-files.mjs` (runs automatically before `npm run dev` and `npm run build`; nothing it writes is committed):

| URL | What it is |
| --- | --- |
| `/<page>.md` (e.g. `/esims/orders.md`, `/index.md`) | Clean markdown of every docs page, served `noindex` with the HTML page as canonical |
| `Accept: text/markdown` on any page URL | Same markdown via content negotiation (`src/proxy.ts`); browsers and `*/*` still get HTML |
| `/llms.txt`, `/llms-full.txt` | llmstxt.org index and every page concatenated |
| `/ai.txt` | AI usage policy |
| `/robots.txt`, `/sitemap.xml` | All AI crawlers allowed; sitemap with git-based `lastmod` |

Adding a page needs no extra step: create the `.mdx` file and add it to the folder's `_meta.js`. Optionally add `description:` frontmatter (used for `llms.txt`, the meta description and `ai-summary`). Site-level facts (name, coverage, contact, crawler list) live in `site.config.mjs`. Run `npm run verify:ai` after generating to check every page is covered.
