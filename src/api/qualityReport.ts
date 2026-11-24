import client from './client'
import type { ProposalIssue } from '../types/research'

/** PR 11: the pre-export quality report, estimated from the automatic checks (no model call). */
export interface QualityCriterion { id: string; label: string; score: number; max: number; issues: number }
export interface QualityCalibration { examples: number; meanAbsError: number; leaveOneOutError: number; rankCorrelation: number; note: string }
export interface ProposalQualityReport {
  version: string
  total: number
  rawTotal: number
  criteria: QualityCriterion[]
  failedChecks: ProposalIssue[]
  dismissedCount: number
  calibration: QualityCalibration
  notApplicable: string[]
}

type Wrap<T> = { success: boolean; data: T }
const unwrap = <T>(res: { data: Wrap<T> | T }): T => ((res.data as Wrap<T>)?.data ?? res.data) as T

export const getQualityReport = async (projectId: string): Promise<ProposalQualityReport> =>
  unwrap(await client.get<Wrap<ProposalQualityReport>>(`/api/v1/research/projects/${projectId}/proposal-quality-report`))
