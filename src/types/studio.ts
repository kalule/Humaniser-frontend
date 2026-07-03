export type StudioType   = 'GENERATOR' | 'AGENT'
export type WizardMode   = 'PROPOSAL' | 'LIT_REVIEW' | 'ARTICLE'
export type StudioFilter = 'all' | 'generator' | 'agent'

export interface StudioDocument {
  id:             string
  title:          string
  studioType:     StudioType
  wizardMode:     WizardMode
  linkedEditorId: string | null   // id in libraryStore for the actual doc content
  updatedAt:      string
  createdAt:      string
}
