import {NextRequest, NextResponse} from 'next/server'
import manifest from '@/generated/ai-pages.json'

// Content negotiation for AI agents: GET /esims/orders/ with `Accept: text/markdown` returns the
// markdown version of the page (the static file /esims/orders.md). Browsers, curl (`*/*`) and link
// previews keep getting HTML, because markdown is served only when it is explicitly preferred.

const pages = new Map(manifest.pages.map((p) => [p.route, p.mdPath]))

function quality(accept: string, matches: (type: string) => boolean): number {
    let best = -1
    for (const part of accept.split(',')) {
        const [type, ...params] = part.trim().toLowerCase().split(';')
        if (!matches(type.trim())) continue
        const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
        const value = q ? Number.parseFloat(q.slice(2)) : 1
        best = Math.max(best, Number.isNaN(value) ? 1 : value)
    }
    return best
}

export function prefersMarkdown(accept: string | null): boolean {
    if (!accept) return false
    const markdown = quality(accept, (t) => t === 'text/markdown')
    if (markdown <= 0) return false
    const html = Math.max(
        quality(accept, (t) => t === 'text/html' || t === 'application/xhtml+xml'),
        0,
    )
    return markdown > html
}

export function proxy(request: NextRequest) {
    const route = request.nextUrl.pathname.replace(/^\/|\/$/g, '')
    const mdPath = pages.get(route)
    if (mdPath === undefined) return NextResponse.next()

    const response = prefersMarkdown(request.headers.get('accept'))
        ? NextResponse.rewrite(new URL(`/${mdPath}`, request.url))
        : NextResponse.next()
    response.headers.set('Vary', 'Accept')
    return response
}

export const config = {
    // Skip _next, the search index, and anything with a file extension (.md, .txt, images ...).
    matcher: ['/((?!_next|_pagefind|.*\\..*).*)'],
}
