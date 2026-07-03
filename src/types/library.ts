export type DocFileType = 'doc' | 'pdf' | 'md' | 'docx' | 'txt'
export type DocOwnership = 'all' | 'mine' | 'shared'
export type DocViewMode  = 'grid' | 'list'

export interface WorkspaceFolder {
  id:        string
  name:      string
  createdAt: string
}

export interface WorkspaceDocument {
  id:        string
  title:     string
  content?:  string        // TipTap JSON stringified
  filePath?: string        // URL for uploaded files (PDF/DOCX)
  type:      DocFileType
  folderId?: string | null
  isPdf:     boolean
  createdAt: string
  updatedAt: string
}
