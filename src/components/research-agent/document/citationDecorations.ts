import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as PmNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { describeCitation, findCitations, type CitationContext } from '../../../lib/citationCard'

export const citationDecorationsKey = new PluginKey('dmCitations')

/** A citation located in the document: absolute positions plus what the matcher found. */
export interface LocatedCitation {
  from:       number
  to:         number
  text:       string
  inner:      string
  /** The paragraph around it, to tell repeated citations of one source apart. */
  surrounding: string
}

/** The citation covering `pos`, if any (positions are inclusive of both ends). */
export function citationAt(doc: PmNode, pos: number, ctx: CitationContext): LocatedCitation | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))
  const block = $pos.parent
  if (!block.isTextblock) return null
  const start = $pos.start()
  let found: LocatedCitation | null = null
  block.forEach((child, offset) => {
    if (found || !child.isText || !child.text) return
    for (const hit of findCitations(child.text, ctx)) {
      const from = start + offset + hit.from
      const to = start + offset + hit.to
      if (pos >= from && pos <= to) {
        found = { from, to, text: child.text.slice(hit.from, hit.to), inner: hit.inner, surrounding: block.textContent }
        return
      }
    }
  })
  return found
}

/**
 * Marks citations in the text (class "dm-cite"; "dm-cite--flagged" when the claim check raised a
 * problem). Display only: nothing is written into the document, so stored markdown is unchanged.
 * Reads live data through `dataRef`; dispatch any transaction after changing it to redraw.
 */
export function CitationDecorations(dataRef: { current: CitationContext }) {
  return Extension.create({
    name: 'dmCitations',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: citationDecorationsKey,
          props: {
            decorations(state) {
              const ctx = dataRef.current
              const decorations: Decoration[] = []
              state.doc.descendants((node, pos, parent) => {
                if (!node.isText || !node.text) return
                for (const hit of findCitations(node.text, ctx)) {
                  const flagged = describeCitation(hit, parent?.textContent ?? '', ctx)
                    .some(e => e.support === 'partly' || e.support === 'not_supported' || !e.sourceExists)
                  decorations.push(Decoration.inline(pos + hit.from, pos + hit.to, {
                    class: flagged ? 'dm-cite dm-cite--flagged' : 'dm-cite',
                  }))
                }
              })
              return DecorationSet.create(state.doc, decorations)
            },
          },
        }),
      ]
    },
  })
}
