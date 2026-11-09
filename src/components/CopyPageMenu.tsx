'use client'

import {useEffect, useId, useRef, useState} from 'react'

type Props = {mdPath: string; mdUrl: string; title: string}

const itemClass =
    'block w-full px-3 py-2 text-left text-sm hover:bg-gray-500/10 focus-visible:bg-gray-500/10 focus-visible:outline-none'

// "Copy page" disclosure: copy the page as markdown, open the .md file, or hand the page to ChatGPT / Claude.
// Plain disclosure semantics (button + aria-expanded + a list of links/buttons): every item is reachable
// with Tab, Escape closes the panel and returns focus to the trigger.
export function CopyPageMenu({mdPath, mdUrl, title}: Props) {
    const [open, setOpen] = useState(false)
    const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')
    const root = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const panelId = useId()

    useEffect(() => {
        if (!open) return
        const onClick = (e: MouseEvent) => {
            if (!root.current?.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            setOpen(false)
            trigger.current?.focus()
        }
        document.addEventListener('mousedown', onClick)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    async function copy() {
        // Safari only allows clipboard writes started inside the click handler, so hand it a ClipboardItem
        // whose data is a promise (the fetch) instead of awaiting the fetch first.
        const markdown = fetch(`/${mdPath}`).then((response) => {
            if (!response.ok) throw new Error(String(response.status))
            return response.text()
        })
        try {
            if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
                await navigator.clipboard.write([
                    new ClipboardItem({'text/plain': markdown.then((text) => new Blob([text], {type: 'text/plain'}))}),
                ])
            } else {
                await navigator.clipboard.writeText(await markdown)
            }
            setStatus('copied')
        } catch {
            setStatus('error')
        }
        if (open) trigger.current?.focus()
        setOpen(false)
        setTimeout(() => setStatus('idle'), 2000)
    }

    const prompt = encodeURIComponent(`Read ${mdUrl} so I can ask questions about "${title}" in the Roamify API docs.`)

    return (
        <div ref={root} className="relative inline-block text-sm not-prose">
            <div className="inline-flex rounded-md border border-gray-500/30">
                <button type="button" onClick={copy} className="rounded-l-md px-3 py-1.5 hover:bg-gray-500/10">
                    {status === 'copied' ? 'Copied!' : status === 'error' ? 'Copy failed' : 'Copy page'}
                </button>
                <button
                    ref={trigger}
                    type="button"
                    aria-label="More page actions"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpen((v) => !v)}
                    className="rounded-r-md border-l border-gray-500/30 px-2 hover:bg-gray-500/10"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                </button>
            </div>
            {open && (
                <div
                    id={panelId}
                    className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-md border border-gray-500/30 bg-white shadow-lg [html.dark_&]:bg-neutral-900"
                >
                    <button type="button" onClick={copy} className={itemClass}>
                        Copy page as Markdown
                    </button>
                    <a href={`/${mdPath}`} target="_blank" rel="noreferrer" className={itemClass}>
                        View as Markdown
                    </a>
                    <a href={`https://chatgpt.com/?q=${prompt}`} target="_blank" rel="noreferrer" className={itemClass}>
                        Open in ChatGPT
                    </a>
                    <a href={`https://claude.ai/new?q=${prompt}`} target="_blank" rel="noreferrer" className={itemClass}>
                        Open in Claude
                    </a>
                </div>
            )}
        </div>
    )
}
