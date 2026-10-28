import { Node, mergeAttributes } from '@tiptap/core'
import { NodeSelection, Plugin } from '@tiptap/pm/state'

const readJson = (value: string | null, fallback: unknown) => { try { return value ? JSON.parse(value) : fallback } catch { return fallback } }

export const EssayCitationNode = Node.create({
  name: 'citation', group: 'inline', inline: true, atom: true,
  addAttributes() {
    return {
      citationId: { default: null, parseHTML: el => el.getAttribute('data-citation-id'), rendered: false },
      occurrenceId: { default: null, parseHTML: el => el.getAttribute('data-occurrence-id'), rendered: false },
      items: { default: [], parseHTML: el => readJson(el.getAttribute('data-items'), []), rendered: false },
      narrative: { default: false, parseHTML: el => el.getAttribute('data-narrative') === 'true', rendered: false },
      label: { default: '', parseHTML: el => el.textContent ?? '', rendered: false },
    }
  },
  parseHTML() { return [{ tag: 'cite[data-citation-id]' }] },
  renderHTML({ node, HTMLAttributes }) {
    return ['cite', mergeAttributes(HTMLAttributes, {
      'data-citation-id': node.attrs.citationId ?? '', 'data-occurrence-id': node.attrs.occurrenceId,
      'data-items': JSON.stringify(node.attrs.items), 'data-narrative': String(node.attrs.narrative),
      role: 'button', tabindex: '0', 'aria-haspopup': 'dialog', 'aria-label': `Citation details: ${node.attrs.label}`,
      class: 'essay-citation',
    }), node.attrs.label]
  },
  renderText({ node }) { return node.attrs.label },
  addProseMirrorPlugins() {
    const activate = (pos: number) => {
      this.editor.view.dispatch(this.editor.state.tr.setSelection(NodeSelection.create(this.editor.state.doc, pos)).setMeta('activateCitation', pos))
    }
    return [new Plugin({
      appendTransaction: (transactions, _oldState, state) => {
        if (!transactions.some(tr => tr.docChanged)) return null
        const seen = new Set<string>(); const tr = state.tr
        state.doc.descendants((node, pos) => {
          if (node.type.name !== 'citation') return
          const id = node.attrs.occurrenceId
          if (!id || seen.has(id)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, occurrenceId: crypto.randomUUID() })
          if (id) seen.add(id)
        })
        return tr.docChanged ? tr : null
      },
      props: {
      handleClickOn: (_view, _pos, node, nodePos, _event, direct) => {
        if (direct && node.type.name === 'citation') { activate(nodePos); return true }
        return false
      },
      handleDOMEvents: { keydown: (view, event) => {
        const target = event.target as HTMLElement
        if ((event.key === 'Enter' || event.key === ' ') && target.matches('cite.essay-citation')) {
          event.preventDefault(); activate(view.posAtDOM(target, 0)); return true
        }
        return false
      } },
    } })]
  },
})

export const CitationReferenceNode = Node.create({
  name: 'citationReference', group: 'block', atom: true,
  addAttributes() { return {
    source: { default: null, parseHTML: el => readJson(el.getAttribute('data-citation-reference'), null), rendered: false },
    label: { default: '', parseHTML: el => el.textContent ?? '', rendered: false },
  } },
  parseHTML() { return [{ tag: 'div[data-citation-reference]' }] },
  renderHTML({ node }) { return ['div', { 'data-citation-reference': JSON.stringify(node.attrs.source), class: 'essay-reference' }, node.attrs.label] },
  renderText({ node }) { return node.attrs.label },
})
