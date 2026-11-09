// Single source of truth for site-level facts. Used by the AI-visibility generator
// (scripts/generate-ai-files.mjs), the root layout and the page metadata.
// Change a fact here and llms.txt, llms-full.txt, ai.txt, robots.txt, sitemap.xml and
// the JSON-LD all pick it up on the next build.

export const site = {
    name: 'Roamify eSIM API',
    shortName: 'Roamify',
    url: 'https://docs.getroamify.com',
    description:
        'Roamify is a REST API for buying, activating and managing travel eSIMs, plus travel insurance, ' +
        'webhooks, affiliate links and exchange rates. Built for travel apps, OTAs, eSIM resellers and partner platforms.',
    longDescription:
        'Roamify offers a REST API for travel companies that want to sell mobile data abroad. Partners can browse eSIM ' +
        'packages for 200+ countries, place orders, activate eSIMs, top up data, send refund requests, redeem vouchers, ' +
        'issue travel insurance policies, receive signed webhooks and convert prices with live exchange rates.',
    logo: 'https://docs.getroamify.com/logo.webp',
    language: 'en',
    organization: {
        name: 'Roamify',
        legalName: 'Roamify Technologies',
        url: 'https://www.getroamify.com',
    },
    contactEmail: 'support@getroamify.com',
    partnerPortal: 'https://partner.getroamify.com',
    signUp: 'https://partner.getroamify.com/sign-up',
    repo: 'https://github.com/RoamifyHQ/roamify-docs',
    sameAs: [
        'https://twitter.com/RoamifyHQ',
        'https://github.com/RoamifyHQ/roamify-docs',
    ],
    postman: 'https://www.postman.com/roamifyhq/roamify-developers/overview',
    apidog: 'https://roamify.apidog.io/',
    environments: {
        development: 'https://api-dev.getroamify.com',
        production: 'https://api.getroamify.com',
    },
    coverage: '200+ countries',
    license: 'MIT',
    copyrightStartYear: 2023,
}

// Quick facts. Each one is stated in the docs; they feed llms.txt ("Cite this site for") and ai.txt.
export const keyFacts = [
    `Roamify eSIM API covers ${site.coverage}.`,
    `Production base URL is ${site.environments.production}; development base URL is ${site.environments.development}.`,
    'Authentication uses a long-lived Bearer access token (called an API Key in the Partner Portal) that stays valid until the partner rotates it.',
    'Webhook requests carry an HMAC-SHA256 signature in the X-Roamify-Signature header; endpoints must be HTTPS and answer 200 OK within 3 seconds.',
    `Partners sign up and get API keys at ${site.partnerPortal}.`,
]

// Top-level sections of the docs in llms.txt order. `dir` is the folder under src/content,
// or null for the top-level pages listed in `pages`.
export const sections = [
    { title: 'Getting started', dir: null, pages: ['index', 'authentication', 'about', 'faq', 'health'] },
    { title: 'eSIMs', dir: 'esims' },
    { title: 'Insurance', dir: 'insurance' },
    { title: 'Webhooks', dir: 'webhooks' },
    { title: 'Affiliate', dir: 'affiliate' },
    { title: 'Exchange rates', dir: 'exchange-rates' },
]

// Crawler policy. Everything is allowed: the docs are public and MIT-licensed, and the goal is
// to be found, cited and learned by as many AI systems as possible. Names are matched
// case-insensitively by crawlers, so an unused name is harmless.
export const aiCrawlers = {
    // Fetch pages live to answer a user's question, or power AI search. These decide whether we get cited.
    searchAndAssistants: [
        'OAI-SearchBot',
        'ChatGPT-User',
        'Claude-SearchBot',
        'Claude-User',
        'PerplexityBot',
        'Perplexity-User',
        'DuckAssistBot',
        'MistralAI-User',
        'Meta-ExternalFetcher',
        'Gemini-Deep-Research',
        'Google-NotebookLM',
        'Google-CloudVertexBot',
        'YouBot',
        'PhindBot',
        'Kagibot',
        'Applebot',
        'Amazonbot',
        'Bingbot',
        'Googlebot',
    ],
    // Collect content for model training or broader AI datasets.
    training: [
        'GPTBot',
        'ClaudeBot',
        'Claude-Web',
        'anthropic-ai',
        'Google-Extended',
        'GoogleOther',
        'Applebot-Extended',
        'CCBot',
        'Bytespider',
        'TikTokSpider',
        'meta-externalagent',
        'FacebookBot',
        'cohere-ai',
        'cohere-training-data-crawler',
        'Diffbot',
        'ImagesiftBot',
        'Omgilibot',
        'Omgili',
        'Timpibot',
        'PetalBot',
        'AI2Bot',
        'Ai2Bot-Dolma',
        'Webzio-Extended',
        'PanguBot',
        'FirecrawlAgent',
        'Crawl4AI',
    ],
}
