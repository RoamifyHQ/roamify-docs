import { generateStaticParamsFor, importPage } from 'nextra/pages'
import { useMDXComponents } from 'nextra-theme-docs'
import manifest from '@/generated/ai-pages.json'
import { site } from '../../../site.config.mjs'
import { CopyPageMenu } from '@/components/CopyPageMenu'

export const generateStaticParams = generateStaticParamsFor('mdxPath')

type AiPage = (typeof manifest.pages)[number]
const aiPages = new Map<string, AiPage>(manifest.pages.map((p) => [p.route, p]))
const routeOf = (mdxPath?: string[]) => (mdxPath ?? []).join('/')

const organization = {
    '@type': 'Organization',
    '@id': `${site.organization.url}/#organization`,
    name: site.organization.name,
    legalName: site.organization.legalName,
    url: site.organization.url,
    logo: site.logo,
    sameAs: site.sameAs,
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: site.contactEmail },
}

const webSite = {
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    name: site.name,
    url: site.url,
    description: site.description,
    inLanguage: site.language,
    publisher: { '@id': organization['@id'] },
}

// Everything in the JSON-LD comes from the same manifest as llms.txt, ai.txt and the markdown pages.
function structuredData(page: AiPage) {
    const graph: Record<string, unknown>[] = []
    if (page.route === '') graph.push(organization, webSite)
    graph.push({
        '@type': 'TechArticle',
        headline: page.title,
        description: page.description,
        url: page.url,
        inLanguage: site.language,
        ...(page.lastmod ? { dateModified: page.lastmod } : {}),
        isPartOf: { '@id': webSite['@id'] },
        publisher: { '@id': organization['@id'] },
        ...(page.route === '' ? {} : { mainEntityOfPage: page.url }),
    })
    if (page.breadcrumbs.length > 1) {
        graph.push({
            '@type': 'BreadcrumbList',
            itemListElement: page.breadcrumbs.map((b, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: b.name,
                item: b.url,
            })),
        })
    }
    if ('faq' in page && Array.isArray(page.faq) && page.faq.length) {
        graph.push({
            '@type': 'FAQPage',
            mainEntity: page.faq.map((f: { question: string; answer: string }) => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
        })
    }
    return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
}

export async function generateMetadata(props: any) {
    const params = await props.params
    const { metadata } = await importPage(params.mdxPath)
    const page = aiPages.get(routeOf(params.mdxPath))
    if (!page) return metadata
    const description = metadata.description ?? page.description
    return {
        ...metadata,
        description,
        alternates: {
            canonical: page.url,
            types: { 'text/markdown': page.mdUrl },
        },
        openGraph: {
            type: 'website',
            url: page.url,
            siteName: site.name,
            title: metadata.title ?? page.title,
            description,
            images: site.logo,
        },
        // Read by some AI agents and GEO checkers; invisible to readers.
        other: { 'ai-summary': description },
    }
}

const Wrapper = useMDXComponents().wrapper

export default async function Page(props: any) {
    const params = await props.params
    const result = await importPage(params.mdxPath)
    const { default: MDXContent, toc, metadata, sourceCode } = result
    const page = aiPages.get(routeOf(params.mdxPath))
    return (
        <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
            {page && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: structuredData(page) }}
                />
            )}
            {page && (
                <CopyPageMenu mdPath={page.mdPath} />
            )}
            <MDXContent {...props} params={params} />
        </Wrapper>
    )
}
