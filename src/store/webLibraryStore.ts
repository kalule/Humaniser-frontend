import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { ResearchDocument, LibraryFolder, ColumnKey } from '../types/webLibrary'

const now = () => new Date().toISOString()

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED: ResearchDocument[] = [
  {
    id: 'doc-seed-1',
    title: 'PPH4806 ASSIGNMENT 2 2026',
    authors: ['Habedi, Debbie'],
    docType: 'Journal Article',
    year: 2026,
    isFullText: true,
    tldr: 'This document outlines the requirements for Assignment 2 of PPH4806, a public health course. Students must address major health system challenges by illustrating data gathering and problem identification steps, analyzing health system resilience using the WHO 6 Building Blocks, and attributing factors affecting health system efficiency [p. 1]. The assignment is worth 100 total marks and emphasizes proper academic writing skills.',
    conclusions: 'Based solely on the provided document, conclusions are presented within the document that outlines the assessment questions for an assignment, concludes mark allocation but does not provide data, or analysis from which conclusions can be drawn. The final section is an empty "Conclusion" [p. 2] with a mark allocation by the total marks for the assignment.',
    abstract: 'This assessment document presents the guidelines for completing PPH4806 Assignment 2 for the 2026 academic year. It outlines the evaluation criteria, format requirements, and subject matter coverage expected from students enrolled in the Public Health module.',
    methodology: 'Students are required to apply the WHO 6 Building Blocks framework to analyze health system components. The methodology involves gathering primary and secondary data, applying qualitative and quantitative analysis techniques.',
    limitations: 'The document does not provide empirical data or original research findings. It serves only as an assessment guideline document without analytical content of its own.',
    tags: [],
    folderId: null,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'doc-seed-2',
    title: '39005-1550-32097-1-10-20251202',
    authors: [],
    docType: 'Journal Article',
    year: 2025,
    isFullText: false,
    tldr: 'TL;DR: This study compares Client-Side Rendering (CSR) and Server-Side Rendering (SSR) in web applications, examining their performance characteristics, SEO implications, and developer experience trade-offs across modern JavaScript frameworks.',
    conclusions: 'The study concludes that Server-Side Rendering (SSR) and Client-Side Rendering (CSR) each offer distinct advantages depending on the use case. SSR improves initial load time and SEO, while CSR provides richer interactivity after the initial hydration phase.',
    abstract: 'A comparative analysis of rendering strategies in modern web applications, examining the performance implications of CSR versus SSR across React, Vue, and Angular ecosystems.',
    tags: [],
    folderId: null,
    createdAt: now(),
    updatedAt: now(),
  },
]

// ── Store ─────────────────────────────────────────────────────────────────────

interface WebLibraryStore {
  documents:       ResearchDocument[]
  folders:         LibraryFolder[]
  visibleColumns:  ColumnKey[]

  addDocument:     (doc: Partial<ResearchDocument>) => ResearchDocument
  updateDocument:  (id: string, patch: Partial<ResearchDocument>) => void
  deleteDocument:  (id: string) => void
  trashDocument:   (id: string) => void

  createFolder:    (name: string) => LibraryFolder
  deleteFolder:    (id: string)   => void
  renameFolder:    (id: string, name: string) => void

  addColumn:       (key: ColumnKey) => void
  removeColumn:    (key: ColumnKey) => void
  reorderColumns:  (keys: ColumnKey[]) => void
}

export const useWebLibraryStore = create<WebLibraryStore>()(
  persist(
    (set) => ({
      documents:      SEED,
      folders:        [],
      visibleColumns: ['tldr', 'conclusions'],

      addDocument: (patch = {}) => {
        const doc: ResearchDocument = {
          id:        nanoid(),
          title:     'Untitled',
          authors:   [],
          docType:   'Journal Article',
          tags:      [],
          folderId:  null,
          createdAt: now(),
          updatedAt: now(),
          ...patch,
        }
        set(s => ({ documents: [doc, ...s.documents] }))
        return doc
      },

      updateDocument: (id, patch) =>
        set(s => ({
          documents: s.documents.map(d =>
            d.id === id ? { ...d, ...patch, updatedAt: now() } : d,
          ),
        })),

      deleteDocument: (id) =>
        set(s => ({ documents: s.documents.filter(d => d.id !== id) })),

      trashDocument: (id) =>
        set(s => ({
          documents: s.documents.map(d =>
            d.id === id ? { ...d, folderId: '__trash__', updatedAt: now() } : d,
          ),
        })),

      createFolder: (name) => {
        const f: LibraryFolder = { id: nanoid(), name, createdAt: now() }
        set(s => ({ folders: [f, ...s.folders] }))
        return f
      },

      deleteFolder: (id) =>
        set(s => ({
          folders:   s.folders.filter(f => f.id !== id),
          documents: s.documents.map(d =>
            d.folderId === id ? { ...d, folderId: null } : d,
          ),
        })),

      renameFolder: (id, name) =>
        set(s => ({
          folders: s.folders.map(f => f.id === id ? { ...f, name } : f),
        })),

      addColumn: (key) =>
        set(s => ({
          visibleColumns: s.visibleColumns.includes(key)
            ? s.visibleColumns
            : [...s.visibleColumns, key],
        })),

      removeColumn: (key) =>
        set(s => ({
          visibleColumns: s.visibleColumns.filter(k => k !== key),
        })),

      reorderColumns: (keys) => set(() => ({ visibleColumns: keys })),
    }),
    { name: 'humanise-web-library' },
  ),
)
