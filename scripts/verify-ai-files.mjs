#!/usr/bin/env node
// Fails if any docs page is missing from the generated AI files. Run after `npm run generate:ai`.
import {existsSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const {pages} = JSON.parse(read('src/generated/ai-pages.json'))
const llms = read('public/llms.txt')
const full = read('public/llms-full.txt')
const sitemap = read('public/sitemap.xml')
const robots = read('public/robots.txt')
const errors = []

for (const p of pages) {
    if (!existsSync(join(ROOT, 'public', p.mdPath))) errors.push(`missing public/${p.mdPath}`)
    if (!llms.includes(`(${p.mdUrl})`)) errors.push(`llms.txt does not list ${p.mdUrl}`)
    if (!full.includes(`<!-- source: ${p.url} -->`)) errors.push(`llms-full.txt does not include ${p.url}`)
    if (!sitemap.includes(`<loc>${p.url}</loc>`)) errors.push(`sitemap.xml does not list ${p.url}`)
    const prose = read(`public/${p.mdPath}`).replace(/^\s*```[\s\S]*?^\s*```/gm, '')
    if (/<(Callout|Tabs|Image)\b|^import /m.test(prose)) errors.push(`${p.mdPath} still contains JSX or imports`)
}
if (sitemap.includes('.md<')) errors.push('sitemap.xml lists a .md URL')
if (!/Sitemap:/.test(robots) || /Disallow:\s*\//.test(robots)) errors.push('robots.txt must have a Sitemap line and must not disallow /')

if (errors.length) {
    console.error(`[verify-ai] ${errors.length} problem(s):\n- ${errors.join('\n- ')}`)
    process.exit(1)
}
console.log(`[verify-ai] OK: ${pages.length} pages present in .md, llms.txt, llms-full.txt and sitemap.xml`)
