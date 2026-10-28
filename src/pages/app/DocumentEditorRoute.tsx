import { useParams } from 'react-router-dom'
import DocumentEditorPage from './DocumentEditorPage'

/** Each document owns its TipTap instance, hydration flag, autosave closure and AI session.
 * React Router otherwise reuses the same page when only :documentId changes. */
export default function DocumentEditorRoute() {
  const { documentId = 'new' } = useParams<{ documentId: string }>()
  return <DocumentEditorPage key={documentId} documentId={documentId} />
}
