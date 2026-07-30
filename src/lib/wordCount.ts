// Mirrors the backend's StripTrailingReferences + CountWords (ResearchService.cs) so the
// word count shown live in the Research Agent editor matches what's persisted as
// ProjectSection.WordCount — both must exclude the "### References (N)" block the LLM
// appends to section content, or the student sees an inflated count.
const REFERENCES_HEADER_PATTERN = /^(references|reference list|bibliography|works cited)(\s*\(\d+\))?$/i

/** Truncates `content` at a trailing References/Bibliography heading line, if present. */
export function stripTrailingReferences(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const scanFrom = Math.max(0, lines.length - 50)
  for (let i = lines.length - 1; i >= scanFrom; i--) {
    const line = lines[i].trim().replace(/^#+/, '').trim()
    if (REFERENCES_HEADER_PATTERN.test(line)) {
      let end = i
      if (end > 0 && lines[end - 1].trim() === '---') end--
      return lines.slice(0, end).join('\n').trimEnd()
    }
  }
  return content
}

/** Word count of `content` with any trailing references/bibliography section excluded. */
export function countBodyWords(content: string): number {
  const body = stripTrailingReferences(content).trim()
  return body ? body.split(/\s+/).filter(Boolean).length : 0
}
