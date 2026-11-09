'use client'

import {useEffect, useRef, useState} from 'react'

type Props = {mdPath: string; mdUrl: string; title: string}

const itemClass =
    'block w-full px-3 py-2 text-left text-sm hover:bg-gray-500/10 focus-visible:bg-gray-500/10 focus-visible:outline-none'

// "Copy page" menu: copy the page as markdown, open the .md file, or hand the page to ChatGPT / Claude.
export function CopyPageMenu({mdPath, mdUrl, title}: Props) {
    const [open, setOpen] = useState(false)
    const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')
    const root = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onClick = (e: MouseEvent) => {
            if (!root.current?.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
        document.addEventListener('mousedown', onClick)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    async function copy() {
        try {
            const response = await fetch(`/${mdPath}`)
            if (!response.ok) throw new Error(String(response.status))
            await navigator.clipboard.writeText(await response.text())
            setStatus('copied')
        } catch {
            setStatus('error')
        }
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
                    type="button"
                    aria-label="More page actions"
                    aria-haspopup="menu"
                    aria-expanded={open}
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
                    role="menu"
                    className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-md border border-gray-500/30 bg-white shadow-lg [html.dark_&]:bg-neutral-900"
                >
                    <button type="button" role="menuitem" onClick={copy} className={itemClass}>
                        Copy page as Markdown
                    </button>
                    <a role="menuitem" href={`/${mdPath}`} target="_blank" rel="noreferrer" className={itemClass}>
                        View as Markdown
                    </a>
                    <a role="menuitem" href={`https://chatgpt.com/?q=${prompt}`} target="_blank" rel="noreferrer" className={itemClass}>
                        Open in ChatGPT
                    </a>
                    <a role="menuitem" href={`https://claude.ai/new?q=${prompt}`} target="_blank" rel="noreferrer" className={itemClass}>
                        Open in Claude
                    </a>
                </div>
            )}
        </div>
    )
}
