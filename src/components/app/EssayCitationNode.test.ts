import { describe, expect, it } from 'vitest'
import { Schema } from '@tiptap/pm/model'
import { EditorState, NodeSelection, type Plugin, type Transaction } from '@tiptap/pm/state'
import { EssayCitationNode } from './EssayCitationNode'

const schema = new Schema({ nodes: {
  doc: { content: 'paragraph+' }, paragraph: { content: 'inline*' }, text: { group: 'inline' },
  citation: { group: 'inline', inline: true, atom: true, attrs: { label: { default: '(Smith, 2020)' }, occurrenceId: { default: 'original' } } },
} })

function setup() {
  let state = EditorState.create({ schema, doc: schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, [schema.text('Text '), schema.nodes.citation.create()])) })
  const transactions: Transaction[] = []
  const editor = { get state() { return state }, view: { dispatch(tr: Transaction) { transactions.push(tr); state = state.apply(tr) }, posAtDOM() { return 6 } } }
  const factory = EssayCitationNode.config.addProseMirrorPlugins as unknown as (this: { editor: typeof editor }) => Plugin[]
  const plugin = factory.call({ editor })[0]
  return { editor, plugin, transactions }
}

describe('essay citation activation', () => {
  it('opens on citation clicks, including repeated clicks after closing, without intercepting ordinary links', () => {
    const { editor, plugin, transactions } = setup()
    const click = plugin.props.handleClickOn!
    expect(click.call(plugin, editor.view as never, 6, editor.state.doc.nodeAt(6)!, 6, {} as MouseEvent, true)).toBe(true)
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    expect(transactions[0].getMeta('activateCitation')).toBe(6)
    click.call(plugin, editor.view as never, 6, editor.state.doc.nodeAt(6)!, 6, {} as MouseEvent, true)
    expect(transactions[1].getMeta('activateCitation')).toBe(6)
    expect(click.call(plugin, editor.view as never, 1, editor.state.doc.firstChild!, 0, {} as MouseEvent, true)).toBe(false)
  })
  it('supports Enter and Space on the focusable citation element', () => {
    for (const key of ['Enter', ' ']) {
      const { editor, plugin, transactions } = setup()
      let prevented = false
      const event = { key, target: { matches: (selector: string) => selector === 'cite.essay-citation' }, preventDefault() { prevented = true } }
      expect(plugin.props.handleDOMEvents!.keydown!.call(plugin, editor.view as never, event as unknown as KeyboardEvent)).toBe(true)
      expect(prevented).toBe(true)
      expect(transactions[0].selection).toBeInstanceOf(NodeSelection)
      expect(transactions[0].getMeta('activateCitation')).toBe(6)
    }
  })
  it('renders keyboard and dialog semantics on citation nodes', () => {
    const render = EssayCitationNode.config.renderHTML as unknown as (props: { node: { attrs: Record<string, unknown> }; HTMLAttributes: Record<string, unknown> }) => [string, Record<string, unknown>, string]
    const result = render({ node: { attrs: { label: '(Smith, 2020)', occurrenceId: 'one', items: [] } }, HTMLAttributes: {} })
    expect(result[0]).toBe('cite')
    expect(result[1]).toMatchObject({ role: 'button', tabindex: '0', 'aria-haspopup': 'dialog', 'data-occurrence-id': 'one' })
    expect(result[2]).toBe('(Smith, 2020)')
  })
  it('gives pasted citation occurrences distinct IDs without changing their labels', () => {
    const { editor, plugin } = setup()
    const before = editor.state
    const copied = before.tr.insert(7, schema.nodes.citation.create({ occurrenceId: 'original' }))
    const after = before.apply(copied)
    const fix = plugin.spec.appendTransaction!.call(plugin, [copied], before, after)!
    const fixed = after.apply(fix)
    const ids: string[] = []
    fixed.doc.descendants(node => { if (node.type.name === 'citation') { ids.push(node.attrs.occurrenceId); expect(node.attrs.label).toBe('(Smith, 2020)') } })
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})
