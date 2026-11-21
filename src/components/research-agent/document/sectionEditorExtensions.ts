import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import TiptapImage from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from 'tiptap-markdown'

/**
 * The content-shaping extensions of Guided's editor (DocumentSurface), so a section edited in
 * Document mode is stored as exactly the same markdown. Keep in step with DocumentSurface's
 * useEditor: base64 images must survive the markdown re-parse, GFM tables need TableKit, and
 * markdown is serialised with html: false and breaks: true.
 */
export function sectionEditorExtensions() {
  return [
    StarterKit,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TiptapImage.configure({ allowBase64: true }),
    TableKit.configure({ table: { resizable: false } }),
    Markdown.configure({ html: false, breaks: true, transformCopiedText: false }),
  ]
}

/**
 * Guided drops leading heading lines before loading a section (the section heading is shown by
 * the page, not stored as body text). Same rule, so both editors start from the same body.
 */
export function stripLeadingHeadingLines(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    if (lines[i].trimStart().startsWith('#')) {
      i++
      while (i < lines.length && lines[i].trim() === '') i++
    } else break
  }
  return lines.slice(i).join('\n').replace(/^\n+/, '')
}
