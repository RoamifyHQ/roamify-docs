import nextra from 'nextra'
import {existsSync, readFileSync} from 'node:fs'

// Written by scripts/generate-ai-files.mjs (runs before dev and build).
const manifestUrl = new URL('./src/generated/ai-pages.json', import.meta.url)
const aiPages = existsSync(manifestUrl) ? JSON.parse(readFileSync(manifestUrl, 'utf8')).pages : []

const describedBy = ['/llms.txt', '/llms-full.txt', '/ai.txt']
    .map((path) => `<${path}>; rel="describedby"; type="text/plain"`)
    .join(', ')

const cors = {key: 'Access-Control-Allow-Origin', value: '*'}

const withNextra = nextra({
    latex: true,
    search: {
        codeblocks: true
    },
})

const nextConfig = {
    reactStrictMode: true,
    trailingSlash: true,
    headers: async () => {
        return [
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff",
                    },
                    {
                        key: "X-Frame-Options",
                        value: "SAMEORIGIN",
                    },
                    {
                        key: "X-XSS-Protection",
                        value: "1; mode=block",
                    },
                    {
                        key: "Referrer-Policy",
                        value: "same-origin",
                    },
                    // Point agents at the site-level AI files from every HTML page.
                    {
                        key: "Link",
                        value: describedBy,
                    },
                ],
            },
            // Markdown versions are noindex alternates: the HTML page stays canonical.
            ...aiPages.map((page) => ({
                source: `/${page.mdPath}`,
                headers: [
                    {key: 'Content-Type', value: 'text/markdown; charset=utf-8'},
                    {key: 'X-Markdown-Tokens', value: String(page.tokens)},
                    {key: 'X-Robots-Tag', value: 'noindex, follow'},
                    {key: 'Content-Location', value: page.url},
                    {key: 'Link', value: `<${page.url}>; rel="canonical", ${describedBy}`},
                    {key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400'},
                    cors,
                ],
            })),
            {
                source: '/:file(llms\\.txt|llms-full\\.txt|ai\\.txt)',
                headers: [
                    {key: 'Content-Type', value: 'text/plain; charset=utf-8'},
                    {key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400'},
                    cors,
                ],
            },
        ];
    },
    images: {
        dangerouslyAllowSVG: true,
        remotePatterns: [
            { protocol: "https", hostname: "cdn.sanity.io" },
            { protocol: "https", hostname: "firebasestorage.googleapis.com" },
            { protocol: "https", hostname: "images.unsplash.com" },
            { protocol: "https", hostname: "imagedelivery.net" },
            { protocol: "https", hostname: "cdn.statically.io" },
            { protocol: "https", hostname: "cdn.jsdelivr.net" },
            { protocol: "https", hostname: "storage.googleapis.com" },
            { protocol: "https", hostname: "www.facebook.com" },
            { protocol: "https", hostname: "www.getroamify.com" },
        ],
    },
    devIndicators: {
        position: "bottom-right",
    },
    typescript: {
        ignoreBuildErrors: true,
    }
};

export default withNextra({
    ...nextConfig,
})