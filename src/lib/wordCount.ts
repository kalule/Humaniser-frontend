// Mirrors the backend's StripTrailingReferences + CountWords (ResearchService.cs) so the
// word count shown live in the Research Agent editor matches what's persisted as
// ProjectSection.WordCount — both must exclude the "### References (N)" block the LLM
// appends to section content, or the student sees an inflated count.
const REFERENCES_HEADER_PATTERN = /^(references|reference list|bibliography|works cited)(\s*\(\d+\))?$/i

/**
 * Splits `content` into its body and a trailing References/Bibliography block (heading line, and
 * a `---` rule just above it, included). `tail` is '' when there is no such block, and
 * `body + tail` always reproduces the original text exactly.
 */
export function splitTrailingReferences(content: string): { body: string; tail: string } {
  const lines = content.split('\n')
  const scanFrom = Math.max(0, lines.length - 50)
  for (let i = lines.length - 1; i >= scanFrom; i--) {
    const line = lines[i].trim().replace(/^#+/, '').replace(/\*+/g, '').trim()
    if (REFERENCES_HEADER_PATTERN.test(line)) {
      // Take the blank lines and a `---` rule before the heading into the tail too, so the body
      // ends on its own text.
      let end = i
      while (end > 0 && lines[end - 1].trim() === '') end--
      if (end > 0 && lines[end - 1].trim() === '---') end--
      while (end > 0 && lines[end - 1].trim() === '') end--
      const body = lines.slice(0, end).join('\n')
      return { body, tail: content.slice(body.length) }
    }
  }
  return { body: content, tail: '' }
}

/** Truncates `content` at a trailing References/Bibliography heading line, if present. */
export function stripTrailingReferences(content: string): string {
  const { body, tail } = splitTrailingReferences(content.replace(/\r\n/g, '\n'))
  return tail ? body.trimEnd() : content
}

/** Word count of `content` with any trailing references/bibliography section excluded. */
export function countBodyWords(content: string): number {
  const body = stripTrailingReferences(content).trim()
  return body ? body.split(/\s+/).filter(Boolean).length : 0
}
