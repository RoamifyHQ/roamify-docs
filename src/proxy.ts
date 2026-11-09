import {NextRequest, NextResponse} from 'next/server'
import manifest from '@/generated/ai-pages.json'
import {discoveryLinkHeader} from '../site.config.mjs'

// Content negotiation for AI agents: GET /esims/orders/ with `Accept: text/markdown` returns the
// markdown version of the page (the static file /esims/orders.md). Browsers, curl (`*/*`) and link
// previews keep getting HTML, because markdown is served only when it is explicitly preferred.

const pages = new Map(manifest.pages.map((p) => [p.route, p]))

const describedBy = discoveryLinkHeader({openapi: manifest.openapi})

type Range = {type: string; q: number}

function parseAccept(accept: string): Range[] {
    return accept.split(',').flatMap((part) => {
        const [type, ...params] = part.trim().toLowerCase().split(';')
        if (!type.trim()) return []
        const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
        const value = q ? Number.parseFloat(q.slice(2)) : 1
        return [{type: type.trim(), q: Number.isNaN(value) ? 1 : value}]
    })
}

// Quality of the most specific media range that matches: exact type, then `type/*`, then `*/*`.
function qualityFor(ranges: Range[], type: string): number {
    const [group] = type.split('/')
    for (const candidate of [type, `${group}/*`, '*/*']) {
        const matches = ranges.filter((r) => r.type === candidate)
        if (matches.length) return Math.max(...matches.map((r) => r.q))
    }
    return 0
}

// Markdown needs an explicit `text/markdown` entry that beats HTML. `*/*` or a missing header gets HTML.
function prefersMarkdown(accept: string | null): boolean {
    if (!accept) return false
    const ranges = parseAccept(accept)
    const markdown = Math.max(0, ...ranges.filter((r) => r.type === 'text/markdown').map((r) => r.q))
    if (markdown <= 0) return false
    // The page is served as text/html, so that is the only HTML representation to compare against.
    const html = qualityFor(ranges, 'text/html')
    return markdown > html
}

export function proxy(request: NextRequest) {
    const route = request.nextUrl.pathname.replace(/^\/|\/$/g, '')
    const page = pages.get(route)
    if (!page) return NextResponse.next()

    if (!prefersMarkdown(request.headers.get('accept'))) {
        const response = NextResponse.next()
        response.headers.set('Vary', 'Accept')
        return response
    }

    // Next matches next.config.mjs header rules against the incoming URL, so the rewrite does not get
    // the .md rules; set the same delivery headers here. X-Robots-Tag: noindex is deliberately left out:
    // this response is served at the canonical HTML URL, and noindex there could deindex the real page.
    const response = NextResponse.rewrite(new URL(`/${page.mdPath}`, request.url))
    response.headers.set('Vary', 'Accept')
    response.headers.set('Content-Type', 'text/markdown; charset=utf-8')
    response.headers.set('X-Markdown-Tokens', String(page.tokens))
    response.headers.set('Content-Location', page.url)
    response.headers.set('Link', `<${page.url}>; rel="canonical", ${describedBy}`)
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
}

export const config = {
    // Skip _next, the search index, and anything with a file extension (.md, .txt, images ...).
    matcher: ['/((?!_next|_pagefind|.*\\..*).*)'],
}
