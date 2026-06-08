/**
 * Client-side text extraction from uploaded files.
 * .txt  → native FileReader (zero overhead)
 * .docx → mammoth (lazy-imported so the 250KB bundle is never loaded unless the user uploads a .docx)
 */

export type SupportedExtension = '.txt' | '.docx'

export const ACCEPTED_EXTENSIONS: SupportedExtension[] = ['.txt', '.docx']
export const ACCEPTED_MIME_TYPES = [
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext))
}

export function getFileExtension(file: File): SupportedExtension | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt'))  return '.txt'
  if (name.endsWith('.docx')) return '.docx'
  return null
}

async function extractTxt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = (e) => resolve((e.target?.result as string) ?? '')
    reader.onerror = ()  => reject(new Error('Failed to read file.'))
    reader.readAsText(file, 'UTF-8')
  })
}

async function extractDocx(file: File): Promise<string> {
  // Lazy import — mammoth is only bundled when this branch executes
  const mammoth     = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result      = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = getFileExtension(file)
  if (!ext) throw new Error(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`)

  const text = ext === '.docx' ? await extractDocx(file) : await extractTxt(file)

  if (!text.trim()) throw new Error('The file appears to be empty.')
  return text.trim()
}
