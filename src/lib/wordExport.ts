// Pure HTML-building half of DocumentEditorPage's .doc export, kept as a standalone module (not
// inline in the page component) so it's testable without pulling in the page's full import graph
// (stores, hooks, workbenchApi) and without touching browser-only APIs (Blob/
// URL.createObjectURL/anchor-click) — a vitest unit test can call this directly and inspect the
// returned markup for real <table>/<tr>/<th>/<td> structure (Case Study Phase 2, Part 2's
// table-preservation guarantee). mso-table-lspace/rspace: 0pt is a Word-specific reset for
// unwanted extra spacing Word's HTML importer otherwise adds around tables.
export function buildWordExportHtml(title: string, bodyHtml: string, refs: { label: string; text: string }[]): string {
  const refsHtml = refs.length === 0 ? '' : `
    <h2 style="font-size:14pt;font-weight:700;margin:2em 0 0.5em">References</h2>
    <ol style="padding-left:1.5em;font-size:11pt;line-height:1.5">
      ${refs.map(r => `<li style="margin-bottom:0.5em">${r.text}</li>`).join('')}
    </ol>`
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.15; margin: 2.54cm; color: #1a1a1a; }
  h1 { font-size: 20pt; } h2 { font-size: 15pt; } h3 { font-size: 12pt; }
  cite { color: #4f46e5; font-style: normal; }
  table { border-collapse: collapse; width: 100%; margin: 0.5em 0 1em; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  th, td { border: 1px solid #999; padding: 6px 8px; font-size: 10pt; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-weight: 700; }
</style></head>
<body>${bodyHtml}${refsHtml}</body></html>`
}

export function exportAsWord(title: string, bodyHtml: string, refs: { label: string; text: string }[]) {
  const html = buildWordExportHtml(title, bodyHtml, refs)
  const blob = new Blob([html], { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${title}.doc`
  a.click()
  URL.revokeObjectURL(a.href)
}
