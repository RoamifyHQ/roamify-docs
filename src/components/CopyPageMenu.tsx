'use client'

import {useEffect, useRef, useState} from 'react'
import {Button, Select} from 'nextra/components'
import {useCopy} from 'nextra/hooks'
import {ArrowRightIcon, ChatGPTIcon, ClaudeIcon, CopyIcon, LinkArrowIcon, MarkdownIcon} from 'nextra/icons'
import type {FC, SVGProps} from 'react'

// Same look as Nextra's built-in "Copy page" button (built from Nextra's own Button, Select and icons),
// but it copies the clean generated markdown instead of the raw MDX source, and it adds "View as Markdown".
// The built-in button is turned off with `copyPageButton={false}` on <Layout>.

type Props = {mdPath: string}

const Item = ({icon: Icon, title, description, isExternal}: {
    icon: FC<SVGProps<SVGSVGElement>>
    title: string
    description: string
    isExternal?: boolean
}) => (
    <div className="x:flex x:gap-3 x:items-center">
        <Icon width="16" />
        <div className="x:flex x:flex-col">
            <span className="x:font-medium x:flex x:gap-1">
                {title}
                {isExternal && <LinkArrowIcon height="1em" />}
            </span>
            <span className="x:text-xs">{description}</span>
        </div>
    </div>
)

const options = [
    {id: 'copy', name: <Item icon={CopyIcon} title="Copy page" description="Copy page as Markdown for LLMs" />},
    {id: 'markdown', name: <Item icon={MarkdownIcon} title="View as Markdown" description="Open this page as plain Markdown" isExternal />},
    {id: 'chatgpt', name: <Item icon={ChatGPTIcon} title="Open in ChatGPT" description="Ask questions about this page" isExternal />},
    {id: 'claude', name: <Item icon={ClaudeIcon} title="Open in Claude" description="Ask questions about this page" isExternal />},
]

export function CopyPageMenu({mdPath}: Props) {
    const {copy, isCopied} = useCopy()
    const [failed, setFailed] = useState(false)
    const markdown = useRef<string | null>(null)

    // Preload the markdown so the click handler can copy synchronously: Safari rejects clipboard writes
    // that start after an await.
    useEffect(() => {
        let cancelled = false
        fetch(`/${mdPath}`)
            .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
            .then((text) => {
                if (!cancelled) markdown.current = text
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [mdPath])

    useEffect(() => {
        if (!failed) return
        const timer = setTimeout(() => setFailed(false), 2000)
        return () => clearTimeout(timer)
    }, [failed])

    async function handleCopy() {
        setFailed(false)
        try {
            if (markdown.current !== null) {
                await copy(markdown.current)
                return
            }
            const response = await fetch(`/${mdPath}`)
            if (!response.ok) throw new Error(String(response.status))
            await copy(await response.text())
        } catch {
            setFailed(true)
        }
    }

    function handleSelect(value: string) {
        if (value === 'copy') return void handleCopy()
        if (value === 'markdown') return void window.open(`/${mdPath}`, '_blank', 'noopener')
        const markdownUrl = `${location.origin}/${mdPath}`
        const url = value === 'chatgpt' ? 'chatgpt.com/?hints=search&prompt' : 'claude.ai/new?q'
        window.open(`https://${url}=${encodeURIComponent(`Read from ${markdownUrl} so I can ask questions about it.`)}`, '_blank', 'noopener')
    }

    return (
        <div className="x:border x:inline-flex x:rounded-md x:items-stretch nextra-border x:float-end x:overflow-hidden">
            {/* Persistent live region: announces the result without moving focus. */}
            <span role="status" aria-live="polite" className="sr-only">
                {isCopied ? 'Page copied as Markdown' : failed ? 'Copying the page failed' : ''}
            </span>
            <Button
                className={({hover}: {hover: boolean}) =>
                    [
                        'x:ps-2 x:pe-1 x:flex x:gap-2 x:text-sm x:font-medium x:items-center',
                        (isCopied || failed) && 'x:opacity-70',
                        hover && 'x:bg-gray-200 x:text-gray-900 x:dark:bg-primary-100/5 x:dark:text-gray-50',
                    ]
                        .filter(Boolean)
                        .join(' ')
                }
                onClick={handleCopy}
            >
                <CopyIcon width="16" />
                {isCopied ? 'Copied' : failed ? 'Copy failed' : 'Copy page'}
            </Button>
            <Select
                anchor={{to: 'bottom end', gap: 10}}
                className="x:rounded-none"
                options={options}
                value=""
                selectedOption={<ArrowRightIcon width="12" className="x:rotate-90" />}
                onChange={handleSelect}
            />
        </div>
    )
}
