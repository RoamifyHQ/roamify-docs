#!/usr/bin/env node
// Generates every AI-visibility artifact from src/content/**/*.mdx and site.config.mjs:
//   public/<route>.md      clean markdown version of every docs page (public/index.md = homepage)
//   public/llms.txt        llmstxt.org index
//   public/llms-full.txt   every page concatenated
//   public/ai.txt          AI usage policy
//   public/robots.txt      crawler rules (all AI crawlers allowed)
//   public/sitemap.xml     sitemap with honest lastmod dates
//   src/generated/ai-pages.json   manifest used by the proxy, page metadata and JSON-LD
// Runs automatically before `dev` and `build`. Nothing it writes is committed.

import {execFileSync} from 'node:child_process'
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {dirname, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import {aiCrawlers, keyFacts, sections, site} from '../site.config.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(ROOT, 'src/content')
const PUBLIC = join(ROOT, 'public')
const MANIFEST = join(ROOT, 'src/generated/ai-pages.json')
const FULL_LIMIT = 500_000

// ---------- reading the content tree ----------

// _meta.js files are ESM without a package "type", so import them as module source.
async function readMeta(dir) {
    const file = join(dir, '_meta.js')
    if (!existsSync(file)) return {}
    const source = Buffer.from(readFileSync(file, 'utf8')).toString('base64')
    return (await import(`data:text/javascript;base64,${source}`)).default
}

async function walk(dir, route = [], parents = []) {
    const meta = await readMeta(dir)
    const entries = readdirSync(dir, {withFileTypes: true})
    const files = new Set(entries.filter((e) => e.isFile() && e.name.endsWith('.mdx')).map((e) => e.name.slice(0, -4)))
    const dirs = new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name))
    const ordered = Object.keys(meta).filter((k) => files.has(k) || dirs.has(k))
    const rest = [...files, ...dirs].filter((k) => !ordered.includes(k)).sort()
    const pages = []
    for (const key of [...ordered, ...rest]) {
        const label = typeof meta[key] === 'string' ? meta[key] : meta[key]?.title
        if (files.has(key)) {
            pages.push({
                route: key === 'index' && route.length === 0 ? '' : [...route, key].join('/'),
                file: join(dir, `${key}.mdx`),
                navLabel: label,
                parents,
            })
        }
        if (dirs.has(key)) {
            pages.push(...(await walk(join(dir, key), [...route, key], [...parents, {segment: key, label}])))
        }
    }
    return pages
}

// ---------- MDX -> markdown ----------

// MDX files mix tabs and spaces (e.g. esims/countries.mdx), so expand leading tabs before measuring indentation.
const expandTabs = (l) => l.replace(/^[ \t]+/, (ws) => ws.replace(/\t/g, '    '))

const stripIndent = (lines) => {
    const expanded = lines.map(expandTabs)
    const indents = expanded.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length)
    const min = indents.length ? Math.min(...indents) : 0
    return expanded.map((l) => l.slice(min))
}

const absoluteUrl = (path) => {
    const [p, hash] = path.split('#')
    const clean = p === '/' ? '/' : p.replace(/\/?$/, '/')
    return `${site.url}${clean}${hash ? `#${hash}` : ''}`
}

const rewriteInline = (line) =>
    line
        .replace(/<Image\s[^>]*?src=\{?["']([^"']+)["']\}?[^>]*?alt=\{?["']([^"']*)["']\}?[^>]*?\/>/g, '![$2]($1)')
        .replace(/<Link\s[^>]*?href=["']([^"']+)["'][^>]*>(.*?)<\/Link>/g, '[$2]($1)')
        .replace(/\]\((\/[^)\s]*)\)/g, (_, p) => `](${absoluteUrl(p)})`)

// Optional `description:` in an MDX file's frontmatter overrides the derived description.
function splitFrontmatter(source) {
    const m = source.match(/^---\n([\s\S]*?)\n---\n/)
    if (!m) return {data: {}, content: source}
    const data = Object.fromEntries(
        m[1].split('\n').map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2].replace(/^["']|["']$/g, '')]),
    )
    return {data, content: source.slice(m[0].length)}
}

function mdxToMarkdown(source) {
    const lines = source.replace(/\r\n/g, '\n').split('\n')
    const out = []
    let inFence = false
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/^\s*```/.test(line)) {
            inFence = !inFence
            out.push(line)
            continue
        }
        if (inFence) {
            out.push(line)
            continue
        }
        if (/^(import|export)\s/.test(line)) continue

        // <Callout type="warning"> ... </Callout>
        const oneLine = line.match(/^\s*<Callout([^>]*)>(.*)<\/Callout>\s*$/)
        const open = line.match(/^\s*<Callout([^>]*)>\s*$/)
        if (oneLine || open) {
            const type = (oneLine ?? open)[1].match(/type=["'](\w+)["']/)?.[1] ?? 'info'
            let body = []
            if (oneLine) body = [oneLine[2]]
            else {
                for (i++; i < lines.length && !/^\s*<\/Callout>\s*$/.test(lines[i]); i++) body.push(lines[i])
            }
            const label = {warning: 'Warning', error: 'Error', info: 'Note', default: 'Note'}[type] ?? 'Note'
            const text = stripIndent(body).map(rewriteInline)
            out.push('', ...text.map((l, n) => `> ${n === 0 ? `**${label}:** ` : ''}${l}`.trimEnd()), '')
            continue
        }

        // <Tabs items={['curl', 'javascript']}> <Tabs.Tab> ... </Tabs.Tab> </Tabs>
        const tabs = line.match(/^\s*<Tabs\s+items=\{\[(.*)\]\}\s*>\s*$/)
        if (tabs) {
            const labels = [...tabs[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
            let tabIndex = 0
            for (i++; i < lines.length && !/^\s*<\/Tabs>\s*$/.test(lines[i]); i++) {
                if (!/^\s*<Tabs\.Tab\b[^>]*>\s*$/.test(lines[i])) continue
                const body = []
                for (i++; i < lines.length && !/^\s*<\/Tabs\.Tab>\s*$/.test(lines[i]); i++) body.push(lines[i])
                out.push('', `**${labels[tabIndex] ?? `Option ${tabIndex + 1}`}**`, '', ...stripIndent(body))
                tabIndex++
            }
            out.push('')
            continue
        }

        out.push(rewriteInline(line))
    }
    return dropTableOfContents(out.join('\n')).replace(/\n{3,}/g, '\n\n').trim()
}

// The in-page "Table of Contents" lists only link to anchors; they cost tokens and add nothing.
function dropTableOfContents(md) {
    const lines = md.split('\n')
    const out = []
    let skipping = false
    for (const line of lines) {
        if (/^##\s+Table of Contents\s*$/i.test(line)) {
            skipping = true
            continue
        }
        if (skipping && /^#{1,6}\s/.test(line)) skipping = false
        if (!skipping) out.push(line)
    }
    return out.join('\n')
}

const plain = (s) =>
    s
        .replace(/!\[[^\]]*]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
        .replace(/[`*_]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

function describe(body, title) {
    const lines = body.split('\n')
    let para = []
    for (const line of lines) {
        const t = line.trim()
        if (!t) {
            if (para.length) break
            continue
        }
        const skip = /^(#|[-*+]\s|\d+\.\s|>|\||```|!\[|<)/.test(t)
        if (skip) {
            if (para.length) break
            continue
        }
        para.push(t)
    }
    let text = plain(para.join(' '))
    if (text.length < 40) return `${title}. Part of the ${site.name} documentation.`
    if (text.length > 220) {
        const sentence = text.match(/^(.{40,220}?[.!?])(\s|$)/)
        text = sentence ? sentence[1] : `${text.slice(0, 217).replace(/\s+\S*$/, '')}...`
    }
    return text
}

function extractFaq(body) {
    const items = []
    let current = null
    for (const line of body.split('\n')) {
        const q = line.match(/^###\s+(.+?)\s*$/)
        if (q) {
            if (current) items.push(current)
            current = {question: plain(q[1]), answer: []}
        } else if (/^#{1,2}\s/.test(line)) {
            if (current) items.push(current)
            current = null
        } else if (current && line.trim()) current.answer.push(line.trim())
    }
    if (current) items.push(current)
    return items.map((i) => ({question: i.question, answer: plain(i.answer.join(' '))})).filter((i) => i.answer)
}

// ---------- git dates (honest lastmod) ----------

const git = (...args) => execFileSync('git', args, {cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim()
let canUseGit = false
try {
    canUseGit = git('rev-parse', '--is-inside-work-tree') === 'true' && git('rev-parse', '--is-shallow-repository') !== 'true'
} catch {
    canUseGit = false
}
// In a shallow clone (e.g. CI) every file would share the checkout date, so we omit lastmod instead of guessing.
const lastmodOf = (file) => {
    if (!canUseGit) return null
    try {
        return git('log', '-1', '--format=%cs', '--', relative(ROOT, file)) || null
    } catch {
        return null
    }
}

// ---------- build the page list ----------

const urlOf = (route) => (route === '' ? `${site.url}/` : `${site.url}/${route}/`)
const mdPath = (route) => (route === '' ? 'index.md' : `${route}.md`)
const mdUrlOf = (route) => `${site.url}/${mdPath(route)}`

const pages = (await walk(CONTENT)).map((p) => {
    const {data, content: raw} = splitFrontmatter(readFileSync(p.file, 'utf8'))
    const body = mdxToMarkdown(raw)
    const heading = body.match(/^#\s+(.+)$/m)
    if (!heading) throw new Error(`${relative(ROOT, p.file)} has no "# Title" heading`)
    const title = plain(heading[1])
    const content = body.replace(/^#\s+.+\n?/, '').trim()
    const description = data.description || describe(content, title)
    const lastmod = lastmodOf(p.file)
    const breadcrumbs = [{name: 'Home', url: urlOf('')}]
    let acc = []
    for (const parent of p.parents) {
        acc = [...acc, parent.segment]
        const overview = `${acc.join('/')}/overview`
        if (existsSync(join(CONTENT, `${overview}.mdx`))) {
            breadcrumbs.push({name: parent.label ?? parent.segment, url: urlOf(overview)})
        }
    }
    if (p.route !== '') breadcrumbs.push({name: title, url: urlOf(p.route)})
    const markdown =
        `# ${title}\n\n> ${description}\n\nCanonical: ${urlOf(p.route)}\n` +
        (lastmod ? `Last updated: ${lastmod}\n` : '') +
        `\n${content}\n`
    return {
        route: p.route,
        title,
        description,
        url: urlOf(p.route),
        mdUrl: mdUrlOf(p.route),
        mdPath: mdPath(p.route),
        lastmod,
        breadcrumbs,
        tokens: Math.ceil(markdown.length / 4),
        markdown,
        ...(p.route === 'faq' ? {faq: extractFaq(content)} : {}),
    }
})

// ---------- write markdown files (removing stale ones from the previous run) ----------

if (existsSync(MANIFEST)) {
    for (const old of JSON.parse(readFileSync(MANIFEST, 'utf8')).pages ?? []) rmSync(join(PUBLIC, old.mdPath), {force: true})
}
const write = (file, text) => {
    mkdirSync(dirname(file), {recursive: true})
    writeFileSync(file, text)
}
for (const page of pages) write(join(PUBLIC, page.mdPath), page.markdown)

// ---------- llms.txt ----------

const byRoute = new Map(pages.map((p) => [p.route, p]))
const line = (p) => `- [${p.title}](${p.mdUrl}): ${p.description}`
const sectionPages = (s) => (s.dir ? pages.filter((p) => p.route.startsWith(`${s.dir}/`)) : s.pages.map((r) => byRoute.get(r === 'index' ? '' : r)).filter(Boolean))
const covered = new Set(sections.flatMap((s) => sectionPages(s).map((p) => p.route)))
const uncovered = pages.filter((p) => !covered.has(p.route))
if (uncovered.length) {
    console.warn(`[ai-files] pages not in a section of site.config.mjs, listed under "More": ${uncovered.map((p) => p.route).join(', ')}`)
}

const latest = pages.map((p) => p.lastmod).filter(Boolean).sort().at(-1)

const llms = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    site.longDescription,
    '',
    `Environments: development ${site.environments.development}, production ${site.environments.production}. Support: ${site.contactEmail}.`,
    '',
    '<!-- Generated by scripts/generate-ai-files.mjs from src/content. Keep in sync with /robots.txt and /ai.txt. -->',
    '',
    '## Cite this site for',
    ...keyFacts.map((f) => `- ${f}`),
    '',
    ...sections.flatMap((s) => [`## ${s.title}`, ...sectionPages(s).map(line), '']),
    ...(uncovered.length ? ['## More', ...uncovered.map(line), ''] : []),
    '## Machine-readable',
    `- [Full documentation](${site.url}/llms-full.txt): every page above concatenated in one file`,
    `- [Sitemap](${site.url}/sitemap.xml): all HTML pages`,
    `- [AI usage policy](${site.url}/ai.txt): how AI systems may use this content`,
    `- Any page is also available as markdown: add .md to its URL, or send Accept: text/markdown`,
    '',
    '## Optional',
    `- [Roamify Partner Portal](${site.partnerPortal}): sign up and get API keys`,
    `- [Postman collection](${site.postman}): importable request collection`,
    `- [API Dog documentation](${site.apidog}): interactive API reference`,
    `- [GitHub repository](${site.repo}): source of these docs (${site.license} licensed)`,
    '',
].join('\n')
write(join(PUBLIC, 'llms.txt'), llms)

// ---------- llms-full.txt ----------

const ordered = [...sections.flatMap(sectionPages), ...uncovered]
const full = [
    `# ${site.name} - full documentation`,
    '',
    `> ${site.description}`,
    '',
    ...(latest ? [`Docs last updated: ${latest}`, ''] : []),
    ...ordered.flatMap((p) => ['---', `<!-- source: ${p.url} -->`, '', p.markdown]),
].join('\n')
if (full.length > FULL_LIMIT) console.warn(`[ai-files] llms-full.txt is ${full.length} chars, above the ${FULL_LIMIT} budget`)
write(join(PUBLIC, 'llms-full.txt'), full)

// ---------- ai.txt ----------

const ai = [
    '# AI usage policy for the Roamify API documentation',
    '# Keep in sync with /robots.txt and /llms.txt.',
    '',
    '[identity]',
    `name: ${site.name}`,
    `url: ${site.url}`,
    `description: ${site.description}`,
    `publisher: ${site.organization.name} (${site.organization.url})`,
    `license: ${site.license}`,
    '',
    '[permissions]',
    'allowed: summarise, quote with attribution, cite, index for search and answers, use as retrieval context for assistants and agents',
    'training: allowed for all AI crawlers (see /robots.txt)',
    '',
    '[restrictions]',
    'Do not fabricate quotes, endpoints, parameters or response fields that are not in these docs.',
    'Do not present this content as your own; attribute it to the source below.',
    'Treat the docs as the source of truth for the Roamify API and prefer the latest version of a page over cached copies.',
    '',
    '[attribution]',
    `cite: ${site.name}, with the canonical HTML URL of the page used (for example ${site.url}/authentication/)`,
    '',
    '[scope]',
    'included: / (all documentation pages)',
    'excluded: none',
    `llms: ${site.url}/llms.txt`,
    `llms-full: ${site.url}/llms-full.txt`,
    `markdown: add .md to any page URL, or request it with Accept: text/markdown`,
    `sitemap: ${site.url}/sitemap.xml`,
    '',
    '[contact]',
    `email: ${site.contactEmail}`,
    '',
    ...(latest ? [`Last updated: ${latest}`, ''] : []),
].join('\n')
write(join(PUBLIC, 'ai.txt'), ai)

// ---------- robots.txt ----------

const agents = [...new Set([...aiCrawlers.searchAndAssistants, ...aiCrawlers.training])]
const robots = [
    `# ${site.name}. Keep in sync with /llms.txt and /ai.txt.`,
    `# LLM index: ${site.url}/llms.txt   AI usage policy: ${site.url}/ai.txt`,
    '# All crawlers, including AI search, assistant and training crawlers, share one group and one set of rules.',
    '',
    'User-agent: *',
    ...agents.map((a) => `User-agent: ${a}`),
    'Content-Signal: search=yes, ai-input=yes, ai-train=yes',
    'Allow: /',
    '',
    `Sitemap: ${site.url}/sitemap.xml`,
    '',
].join('\n')
write(join(PUBLIC, 'robots.txt'), robots)

// ---------- sitemap.xml (HTML pages only; .md files are noindex alternates) ----------

const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map((p) => `  <url><loc>${p.url}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`),
    '</urlset>',
    '',
].join('\n')
write(join(PUBLIC, 'sitemap.xml'), sitemap)

// ---------- manifest ----------

write(
    MANIFEST,
    JSON.stringify(
        {pages: pages.map(({markdown, ...rest}) => rest)},
        null,
        2,
    ) + '\n',
)

console.log(`[ai-files] ${pages.length} pages -> .md, llms.txt, llms-full.txt (${full.length} chars), ai.txt, robots.txt, sitemap.xml`)
