import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as PmNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * The budget prompt writes "Not yet costed" where the student has not given a rate. As plain text
 * it reads like a finished value and, in a narrow cell, wraps over three lines. This marks those
 * cells (and short cells generally) so CSS can show them as an open placeholder, and counts them
 * so the section can say how many items still need a cost. Display only: the stored text is unchanged.
 */
export const PENDING_CELL = /^\s*not yet costed\s*$/i

const SHORT_CELL_CHARS = 14

export const pendingCellsKey = new PluginKey<DecorationSet>('pendingCells')

function build(doc: PmNode): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'tableCell' && node.type.name !== 'tableHeader') return true
    const text = node.textContent
    const classes = [
      PENDING_CELL.test(text) ? 'dm-cell-pending' : '',
      text.trim().length <= SHORT_CELL_CHARS ? 'dm-cell-short' : '',
    ].filter(Boolean).join(' ')
    if (classes) decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: classes }))
    return false
  })
  return DecorationSet.create(doc, decorations)
}

/** Rows of a markdown/plain table whose cost is still "Not yet costed" (one per row, not per cell). */
export function countUncostedRows(markdown: string): number {
  return markdown.split('\n').filter(line => line.trim().startsWith('|') && /\|\s*not yet costed\s*\|/i.test(line)).length
}

export const PendingCells = Extension.create({
  name: 'pendingCells',
  addProseMirrorPlugins() {
    return [new Plugin<DecorationSet>({
      key: pendingCellsKey,
      state: {
        init: (_, state) => build(state.doc),
        apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old),
      },
      props: { decorations: state => pendingCellsKey.getState(state) },
    })]
  },
})
