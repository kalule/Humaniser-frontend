import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { locate, type ClaimReviewItem } from '../../lib/claimReviewHighlights'

export const claimReviewKey = new PluginKey('claimReview')

/**
 * Highlights sentences whose claims failed checking (see lib/claimReviewHighlights). Decorations only: nothing is written into the
 * document, saved or exported, and a highlight disappears as soon as its sentence is edited (the text no longer matches).
 * After changing `items.current`, dispatch a transaction with this plugin's key so the editor redraws.
 */
export const ClaimReviewHighlight = Extension.create<{ items: { current: ClaimReviewItem[] } }>({
  name: 'claimReviewHighlight',
  addOptions() {
    return { items: { current: [] } }
  },
  addProseMirrorPlugins() {
    const items = this.options.items
    return [new Plugin({
      key: claimReviewKey,
      props: {
        decorations: state => items.current.length === 0 ? DecorationSet.empty : DecorationSet.create(state.doc, buildDecorations(state.doc, items.current)),
      },
    })]
  },
})

function buildDecorations(doc: ProseMirrorNode, items: ClaimReviewItem[]): Decoration[] {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    for (const item of items) {
      const range = locate(node.text, item.needle)
      if (range) decorations.push(Decoration.inline(pos + range[0], pos + range[1], { class: 'claim-review-highlight', title: item.message }))
    }
  })
  return decorations
}
