import { researchApi } from '../api/research'
import type { ConfirmMethodologyPayload } from '../types/research'

// The caller syncs intake first. Confirmation must succeed before any job starts.
export async function startAutonomousProposal(
  projectId: string,
  methodology: ConfirmMethodologyPayload,
  perSectionWords: number,
) {
  await researchApi.confirmMethodology(projectId, methodology)
  return researchApi.generateAutonomous(projectId, perSectionWords)
}
