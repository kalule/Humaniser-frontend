import { afterEach, describe, expect, it } from 'vitest'
import { AUTHORSHIP_DOCUMENT_HEADER, authorshipHeader, setAuthorshipDocument } from './authorshipDocument'

describe('authorship document header', () => {
  afterEach(() => setAuthorshipDocument(null))

  it('is sent with the editor workbench calls while a document is open', () => {
    setAuthorshipDocument('doc-1')
    expect(authorshipHeader('/api/v1/workbench/continue-writing')).toEqual({ [AUTHORSHIP_DOCUMENT_HEADER]: 'doc-1' })
    expect(authorshipHeader('http://localhost:5099/api/v1/workbench/write-with-ai/stream')).toEqual({ [AUTHORSHIP_DOCUMENT_HEADER]: 'doc-1' })
  })

  it('is never sent to other routes, so stand-alone tools are not tied to a document', () => {
    setAuthorshipDocument('doc-1')
    for (const url of ['/api/v1/humanise', '/api/v1/paraphrase', '/api/v1/grammar/check', '/api/v1/library', undefined])
      expect(authorshipHeader(url)).toEqual({})
  })

  it('is not sent once the editor has closed', () => {
    setAuthorshipDocument('doc-1')
    setAuthorshipDocument(null)
    expect(authorshipHeader('/api/v1/workbench/continue-writing')).toEqual({})
  })
})
