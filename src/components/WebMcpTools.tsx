'use client'

import {useEffect} from 'react'

// WebMCP (https://webmachinelearning.github.io/webmcp/): lets a browser-based AI agent call tools that the page
// registers. Only read-only tools that return the docs as markdown are exposed. The API is experimental, so
// everything is feature-detected and a missing API does nothing.

type ToolResult = {content: {type: 'text'; text: string}[]}

const text = (value: string): ToolResult => ({content: [{type: 'text', text: value}]})

async function getText(path: string): Promise<string> {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`${path} returned ${response.status}`)
    return response.text()
}

export function WebMcpTools() {
    useEffect(() => {
        const modelContext = (document as any).modelContext ?? (navigator as any).modelContext
        if (!modelContext?.registerTool) return

        const controller = new AbortController()
        const options = {signal: controller.signal}
        const register = (tool: object) => {
            try {
                Promise.resolve(modelContext.registerTool(tool, options)).catch(() => {})
            } catch {
                // Experimental API: ignore registration problems.
            }
        }

        register({
            name: 'list_doc_pages',
            description: 'List every page of the Roamify API documentation with a one-line description and its markdown URL.',
            inputSchema: {type: 'object', properties: {}},
            annotations: {readOnlyHint: true},
            execute: async () => text(await getText('/llms.txt')),
        })

        register({
            name: 'read_doc_page',
            description:
                'Read one page of the Roamify API documentation as markdown. Use list_doc_pages to find paths, for example "authentication" or "esims/orders". An empty path is the home page.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {type: 'string', description: 'Page path without a leading slash or extension, for example "esims/refunds".'},
                },
                required: ['path'],
            },
            annotations: {readOnlyHint: true},
            execute: async (input: {path?: string}) => {
                const path = (input?.path ?? '').replace(/^\/+|\/+$/g, '').replace(/\.md$/, '')
                if (!/^[a-z0-9/_-]*$/i.test(path) || path.includes('..')) throw new Error('Invalid page path')
                return text(await getText(`/${path === '' ? 'index' : path}.md`))
            },
        })

        return () => controller.abort()
    }, [])

    return null
}
