#!/usr/bin/env node
// Fails if any docs page is missing from the generated AI files. Run after `npm run generate:ai`.
import {createHash} from 'node:crypto'
import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {footerMarkdownPages} from '../site.config.mjs'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const {pages} = JSON.parse(read('src/generated/ai-pages.json'))
const llms = read('public/llms.txt')
const full = read('public/llms-full.txt')
const sitemap = read('public/sitemap.xml')
const robots = read('public/robots.txt')
const errors = []

// Independent of the manifest: walk src/content for every .mdx file, so a page the generator failed to
// pick up cannot pass just because it is missing from the manifest too.
const sourceRoutes = []
const walkContent = (dir, prefix = '') => {
    for (const entry of readdirSync(join(ROOT, 'src/content', dir), {withFileTypes: true})) {
        const rel = join(dir, entry.name)
        if (entry.isDirectory()) walkContent(rel, `${prefix}${entry.name}/`)
        else if (entry.name.endsWith('.mdx')) sourceRoutes.push(rel.replace(/\.mdx$/, '').replace(/(^|\/)index$/, ''))
    }
}
walkContent('')
const manifestRoutes = new Set(pages.map((p) => p.route))
for (const route of sourceRoutes) {
    if (!manifestRoutes.has(route)) errors.push(`src/content/${route || 'index'}.mdx is not in the generated manifest`)
}
for (const route of footerMarkdownPages) {
    if (!manifestRoutes.has(route)) errors.push(`footer links to ${route || 'index'}.md but no such page exists`)
}
for (const route of manifestRoutes) {
    if (!sourceRoutes.includes(route)) errors.push(`manifest lists ${route || '/'} but no .mdx source exists`)
}

for (const p of pages) {
    if (!existsSync(join(ROOT, 'public', p.mdPath))) errors.push(`missing public/${p.mdPath}`)
    if (!llms.includes(`(${p.mdUrl})`)) errors.push(`llms.txt does not list ${p.mdUrl}`)
    if (!full.includes(`<!-- source: ${p.url} -->`)) errors.push(`llms-full.txt does not include ${p.url}`)
    if (!sitemap.includes(`<loc>${p.url}</loc>`)) errors.push(`sitemap.xml does not list ${p.url}`)
    const raw = read(`public/${p.mdPath}`)
    // A fence indented 4+ spaces at the top level renders as indented code, not a fenced block.
    if (/^( {4,}|\t)```/m.test(raw.replace(/^[-*+\d.]+ .*(\n( {2,}.*|))*$/gm, ''))) errors.push(`${p.mdPath} has an indented code fence`)
    const prose = raw.replace(/^\s*```[\s\S]*?^\s*```/gm, '')
    if (/<(Callout|Tabs|Image)\b|^import /m.test(prose)) errors.push(`${p.mdPath} still contains JSX or imports`)
}
const openapiPath = join(ROOT, 'public/openapi.json')
if (existsSync(openapiPath)) {
    try {
        const spec = JSON.parse(readFileSync(openapiPath, 'utf8'))
        if (!/^3\./.test(spec.openapi) || !Object.keys(spec.paths ?? {}).length) errors.push('openapi.json is not a valid OpenAPI 3 document')
    } catch (e) {
        errors.push(`openapi.json is not valid JSON: ${e.message}`)
    }
    if (!llms.includes('/openapi.json')) errors.push('llms.txt does not link /openapi.json')
}
// /.well-known discovery files
try {
    const catalog = JSON.parse(read('public/.well-known/api-catalog'))
    if (!Array.isArray(catalog.linkset) || !catalog.linkset.every((e) => e.anchor)) errors.push('api-catalog needs a linkset array with an anchor per entry')
    const index = JSON.parse(read('public/.well-known/agent-skills/index.json'))
    for (const skill of index.skills ?? []) {
        const file = `public/${new URL(skill.url).pathname}`
        if (!existsSync(join(ROOT, file))) errors.push(`agent skill file missing: ${file}`)
        else if (skill.digest !== `sha256:${createHash('sha256').update(read(file)).digest('hex')}`) errors.push(`agent skill digest does not match ${file}`)
    }
    const ard = JSON.parse(read('public/.well-known/ai-catalog.json'))
    if (!ard.entries?.length) errors.push('ai-catalog.json has no entries')
    for (const entry of ard.entries ?? []) {
        if (['url', 'data'].filter((k) => k in entry).length !== 1) errors.push(`ai-catalog entry ${entry.identifier} needs exactly one of url or data`)
    }
} catch (e) {
    errors.push(`/.well-known files: ${e.message}`)
}
if (!/Content-Signal:/.test(robots)) errors.push('robots.txt has no Content-Signal')
if (sitemap.includes('.md<')) errors.push('sitemap.xml lists a .md URL')
if (!/Sitemap:/.test(robots) || /Disallow:\s*\//.test(robots)) errors.push('robots.txt must have a Sitemap line and must not disallow /')

if (errors.length) {
    console.error(`[verify-ai] ${errors.length} problem(s):\n- ${errors.join('\n- ')}`)
    process.exit(1)
}
console.log(`[verify-ai] OK: ${pages.length} pages present in .md, llms.txt, llms-full.txt and sitemap.xml`)
