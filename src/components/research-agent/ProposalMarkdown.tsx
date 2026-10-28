import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Generated charts are embedded raster images. Other data URLs retain the
// renderer's default protection, including links and SVG content.
export function proposalUrlTransform(url: string, key: string): string {
  if (key === 'src' && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(url)) return url
  return defaultUrlTransform(url)
}

export function ProposalMarkdown({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={proposalUrlTransform}>{content}</ReactMarkdown>
}
