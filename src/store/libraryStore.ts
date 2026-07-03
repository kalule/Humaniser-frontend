import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { WorkspaceDocument, WorkspaceFolder } from '../types/library'

interface LibraryStore {
  documents: WorkspaceDocument[]
  folders:   WorkspaceFolder[]

  createDocument: (patch?: Partial<WorkspaceDocument>) => WorkspaceDocument
  updateDocument: (id: string, patch: Partial<WorkspaceDocument>) => void
  deleteDocument: (id: string) => void

  createFolder: (name: string) => WorkspaceFolder
  deleteFolder: (id: string) => void
  renameFolder: (id: string, name: string) => void
}

const now = () => new Date().toISOString()

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => ({
      documents: [],
      folders:   [],

      createDocument: (patch = {}) => {
        const doc: WorkspaceDocument = {
          id:        nanoid(),
          title:     'Untitled document',
          content:   '',
          type:      'doc',
          isPdf:     false,
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

      createFolder: (name) => {
        const folder: WorkspaceFolder = { id: nanoid(), name, createdAt: now() }
        set(s => ({ folders: [folder, ...s.folders] }))
        return folder
      },

      deleteFolder: (id) =>
        set(s => ({
          folders:   s.folders.filter(f => f.id !== id),
          // Move documents out of deleted folder
          documents: s.documents.map(d => d.folderId === id ? { ...d, folderId: null } : d),
        })),

      renameFolder: (id, name) =>
        set(s => ({
          folders: s.folders.map(f => f.id === id ? { ...f, name } : f),
        })),
    }),
    { name: 'humanise-library' },
  ),
)
