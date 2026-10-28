import { describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import { insertCoWriteSection } from './essayCoWrite'

function editorWithOldEssay() {
  let html = '<h1>United Nations</h1><p>Old essay.</p><h2>REFERENCES</h2><p>Old references.</p>'
  const chain = { focus: vi.fn(() => chain), insertContent: vi.fn((text: string) => { html += text; return chain }), run: vi.fn() }
  const setContent = vi.fn((text: string) => { html = text })
  const editor = { commands: { setContent }, chain: () => chain } as unknown as Editor
  return { editor, setContent, chain, html: () => html }
}

describe('starting and continuing co-written essays', () => {
  it('replaces the old essay and bibliography on the first acceptance instead of combining two essays', () => {
    const current = editorWithOldEssay()
    const intro = '<h2>INTRODUCTION</h2><p>The origins of apartheid.</p>'
    insertCoWriteSection(current.editor, intro, true)
    expect(current.html()).toBe(intro)
    expect(current.html()).not.toContain('United Nations')
    expect(current.html()).not.toContain('Old references')
    expect(current.setContent).toHaveBeenCalledWith(intro, { emitUpdate: true })
    expect(current.chain.insertContent).not.toHaveBeenCalled()
  })

  it('appends subsequent sections without erasing the accepted introduction or student edits', () => {
    const current = editorWithOldEssay()
    const intro = '<h2>INTRODUCTION</h2><p>My edited introduction.</p>'
    const body = '<h2>MAIN BODY</h2><p>Supported argument.</p>'
    insertCoWriteSection(current.editor, intro, true)
    insertCoWriteSection(current.editor, body, false)
    expect(current.html()).toBe(intro + body)
    expect(current.setContent).toHaveBeenCalledTimes(1)
    expect(current.chain.focus).toHaveBeenCalledWith('end')
  })

  it('replaces the old draft even when the introduction was skipped or a new session starts in the same document', () => {
    const current = editorWithOldEssay()
    const body = '<h2>MAIN BODY</h2><p>First accepted section.</p>'
    insertCoWriteSection(current.editor, body, true)
    expect(current.html()).toBe(body)
    const nextEssay = '<h2>INTRODUCTION</h2><p>A different essay.</p>'
    insertCoWriteSection(current.editor, nextEssay, true)
    expect(current.html()).toBe(nextEssay)
  })
})
