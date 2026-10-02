import { describe, expect, it } from 'vitest'
import { validateExternalProposalFile } from './ThesisStudioPage'

describe('validateExternalProposalFile', () => {
  it.each([
    ['proposal.pdf', 'application/pdf'],
    ['proposal.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['PROPOSAL.DOCX', ''],
  ])('accepts %s', (name, type) => {
    expect(validateExternalProposalFile({ name, type, size: 1024 })).toBeNull()
  })

  it.each(['proposal.doc', 'proposal.txt', 'proposal.pages'])('rejects %s', name => {
    expect(validateExternalProposalFile({ name, type: '', size: 1024 })).toContain('Unsupported file type')
  })

  it('rejects a file over 50 MB', () => {
    expect(validateExternalProposalFile({
      name: 'proposal.pdf', type: 'application/pdf', size: 50 * 1024 * 1024 + 1,
    })).toContain('50 MB')
  })
})
