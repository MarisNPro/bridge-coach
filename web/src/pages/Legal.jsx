import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import terms from '../../../legal/terms-of-service.md?raw'
import privacy from '../../../legal/privacy-policy.md?raw'

const DOCS = { terms, privacy }

// Rewrite the docs' relative cross-links (./privacy-policy.md) onto our routes.
const HREF_MAP = {
  './privacy-policy.md': '/privacy',
  './terms-of-service.md': '/terms',
  'privacy-policy.md': '/privacy',
  'terms-of-service.md': '/terms',
}

// Tailwind styling per markdown element (no typography plugin in this project).
const components = {
  h1: (p) => <h1 className="mb-4 text-2xl font-bold" {...p} />,
  h2: (p) => <h2 className="mb-2 mt-8 text-xl font-semibold" {...p} />,
  h3: (p) => <h3 className="mb-1.5 mt-6 text-lg font-semibold" {...p} />,
  p: (p) => <p className="my-3 leading-relaxed text-foreground/90" {...p} />,
  ul: (p) => <ul className="my-3 list-disc space-y-1 pl-6" {...p} />,
  ol: (p) => <ol className="my-3 list-decimal space-y-1 pl-6" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
  hr: () => <hr className="my-8 border-border" />,
  blockquote: (p) => (
    <blockquote className="my-4 border-l-2 border-border pl-4 text-sm text-muted-foreground" {...p} />
  ),
  a: ({ href = '', children, ...rest }) => {
    const to = HREF_MAP[href]
    return to
      ? <Link to={to} className="text-primary underline underline-offset-2">{children}</Link>
      : <a href={href} target="_blank" rel="noreferrer"
          className="text-primary underline underline-offset-2" {...rest}>{children}</a>
  },
}

// Public, unauthenticated pages for the Terms of Service and Privacy Policy,
// linked from the login screen and the onboarding consent checkbox.
export default function Legal({ doc }) {
  const content = DOCS[doc] || ''
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Bridge Coach</Link>
      <article className="mt-6 text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>
      </article>
    </div>
  )
}
