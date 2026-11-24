import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { Node as PmNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { describeCitation, findCitations, VERDICT_DOT_LABEL, worstDot, type CitationContext } from '../../../lib/citationCard'

export const citationDecorationsKey = new PluginKey<CitationPluginState>('dmCitations')

/** Meta values for citationDecorationsKey. */
export type CitationMeta =
  | 'refresh'        // new sources, flags or check results: redraw
  | 'reset-dirty'    // text was (re)loaded or freshly checked: no citation has been edited since its check

/** A citation located in the document: absolute positions plus what the matcher found. */
export interface LocatedCitation {
  from:       number
  to:         number
  text:       string
  inner:      string
  /** The paragraph around it, to tell repeated citations of one source apart. */
  surrounding: string
  /** The paragraph was edited since the text was loaded or checked: its verdict no longer applies. */
  dirty:      boolean
}

interface Range { from: number; to: number }

interface CitationPluginState {
  decorations: DecorationSet
  /** Ranges the student edited since the last load or check, in current document positions. */
  dirty:       Range[]
}

const overlaps = (ranges: readonly Range[], from: number, to: number) => ranges.some(r => r.from <= to && r.to >= from)

/** The citation covering `pos`, if any (positions are inclusive of both ends). */
export function citationAt(doc: PmNode, pos: number, ctx: CitationContext, dirty: readonly Range[] = []): LocatedCitation | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))
  const block = $pos.parent
  if (!block.isTextblock) return null
  const start = $pos.start()
  const blockDirty = overlaps(dirty, start, $pos.end())
  let found: LocatedCitation | null = null
  block.forEach((child, offset) => {
    if (found || !child.isText || !child.text) return
    for (const hit of findCitations(child.text, ctx)) {
      const from = start + offset + hit.from
      const to = start + offset + hit.to
      if (pos >= from && pos <= to) {
        found = { from, to, text: child.text.slice(hit.from, hit.to), inner: hit.inner, surrounding: block.textContent, dirty: blockDirty }
        return
      }
    }
  })
  return found
}

/** The edited ranges the plugin is tracking (for the card, which must agree with the dot). */
export const dirtyRanges = (state: EditorState): Range[] => citationDecorationsKey.getState(state)?.dirty ?? []

function buildDecorations(doc: PmNode, ctx: CitationContext, dirty: readonly Range[]): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text) return
    let blockDirty = false
    if (dirty.length && parent) {
      const $pos = doc.resolve(pos)
      blockDirty = overlaps(dirty, $pos.start(), $pos.end())
    }
    for (const hit of findCitations(node.text, ctx)) {
      const text = node.text.slice(hit.from, hit.to)
      const entries = describeCitation({ ...hit, text }, parent?.textContent ?? '', ctx, blockDirty)
      const flagged = entries.some(e => e.support === 'partly' || e.support === 'not_supported' || !e.sourceExists)
      const dot = entries.some(e => !e.sourceExists) ? 'unchecked' : worstDot(entries)
      decorations.push(Decoration.inline(pos + hit.from, pos + hit.to, {
        class: `dm-cite dm-cite--v-${dot}${flagged ? ' dm-cite--flagged' : ''}`,
        'data-verdict': dot,
        'aria-label': `${text}. ${VERDICT_DOT_LABEL[dot]}.`,
      }))
    }
  })
  return DecorationSet.create(doc, decorations)
}

/** Ranges a transaction changed, in the transaction's final document positions. */
function changedRanges(tr: Transaction): Range[] {
  const out: Range[] = []
  tr.mapping.maps.forEach((map, i) => {
    const rest = tr.mapping.slice(i + 1)
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      out.push({ from: rest.map(newStart, -1), to: rest.map(newEnd, 1) })
    })
  })
  return out
}

/**
 * Marks citations in the text: class "dm-cite" plus a verdict class (dm-cite--v-supports, -partly,
 * -not_supported, -unchecked) that draws the dot, and "dm-cite--flagged" when the claim check raised
 * a problem. Display only: nothing is written into the document, so stored markdown is unchanged.
 * Reads live data through `dataRef`; dispatch a transaction with citationDecorationsKey meta after
 * changing it to redraw. The set is kept in plugin state and rebuilt only when the text changes
 * or on that refresh, not on every selection move (a long thesis has many editors open at once).
 *
 * Paragraphs the student edits are remembered (mapped through later edits) until a 'reset-dirty'
 * meta, so a citation whose surrounding text changed after its check shows "Not checked".
 */
export function CitationDecorations(dataRef: { current: CitationContext }) {
  return Extension.create({
    name: 'dmCitations',
    addProseMirrorPlugins() {
      return [
        new Plugin<CitationPluginState>({
          key: citationDecorationsKey,
          state: {
            init: (_config, state) => ({ decorations: buildDecorations(state.doc, dataRef.current, []), dirty: [] }),
            apply: (tr, previous) => {
              const meta = tr.getMeta(citationDecorationsKey) as CitationMeta | undefined
              let dirty = previous.dirty
              if (meta === 'reset-dirty') dirty = []
              else if (tr.docChanged) {
                dirty = [
                  ...dirty.map(r => ({ from: tr.mapping.map(r.from, -1), to: tr.mapping.map(r.to, 1) })),
                  ...changedRanges(tr),
                ]
              }
              if (!tr.docChanged && meta === undefined) return previous
              return { decorations: buildDecorations(tr.doc, dataRef.current, dirty), dirty }
            },
          },
          props: {
            decorations(state) { return citationDecorationsKey.getState(state)?.decorations },
          },
        }),
      ]
    },
  })
}
