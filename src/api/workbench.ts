import client from './client'
import type {
  AssumptionCheckRequest,
  AssumptionReport,
  GenerateAbstractRequest,
  GenerateAbstractResponse,
  OptimizeProseRequest,
  OptimizeProseResponse,
  OutlierSimulationRequest,
  OutlierScanResult,
  ScanShieldRequest,
  ScanShieldResponse,
  ValidateLiteratureRequest,
  ValidateLiteratureResponse,
  WriteWithAiRequest,
  WriteWithAiResponse,
  ContinueWritingRequest,
  ContinueWritingResponse,
  ReviewDocumentRequest,
  ReviewDocumentResponse,
  PlanEssayRequest,
  EssayPlan,
  PlanCaseStudyRequest,
  CaseStudyPlan,
} from '../types/workbench'

type Wrapped<T> = { success: boolean; data: T }

const unwrap = <T>(res: { data: Wrapped<T> }): T =>
  res.data.data ?? (res.data as unknown as T)

export const workbenchApi = {
  planEssay: async (data: PlanEssayRequest): Promise<EssayPlan> =>
    unwrap(await client.post<Wrapped<EssayPlan>>('/api/v1/workbench/plan-essay', data, { timeout: 120_000 })),

  planCaseStudy: async (data: PlanCaseStudyRequest): Promise<CaseStudyPlan> =>
    unwrap(await client.post<Wrapped<CaseStudyPlan>>('/api/v1/workbench/plan-case-study', data, { timeout: 120_000 })),
  generateAbstract: async (data: GenerateAbstractRequest): Promise<GenerateAbstractResponse> =>
    unwrap(await client.post<Wrapped<GenerateAbstractResponse>>(
      '/api/v1/workbench/generate-abstract', data,
    )),

  optimizeProse: async (data: OptimizeProseRequest): Promise<OptimizeProseResponse> =>
    unwrap(await client.post<Wrapped<OptimizeProseResponse>>(
      '/api/v1/workbench/optimize-prose', data,
    )),

  scanShield: async (data: ScanShieldRequest): Promise<ScanShieldResponse> =>
    unwrap(await client.post<Wrapped<ScanShieldResponse>>(
      '/api/v1/workbench/scan-shield', data,
    )),

  validateLiterature: async (data: ValidateLiteratureRequest): Promise<ValidateLiteratureResponse> =>
    unwrap(await client.post<Wrapped<ValidateLiteratureResponse>>(
      '/api/v1/workbench/validate-literature', data,
    )),

  checkAssumptions: async (data: AssumptionCheckRequest): Promise<AssumptionReport> =>
    unwrap(await client.post<Wrapped<AssumptionReport>>(
      '/api/v1/workbench/check-assumptions', data,
    )),

  simulateOutliers: async (data: OutlierSimulationRequest): Promise<OutlierScanResult> =>
    unwrap(await client.post<Wrapped<OutlierScanResult>>(
      '/api/v1/workbench/simulate-outliers', data,
    )),

  // 900_000ms matches the backend's Workbench:EssayGenerationTimeoutSeconds clamp ceiling (900s),
  // not just its 480s default — so this stays the non-limiting layer even if that config is later
  // raised within its valid range, without needing another PR to keep the two in sync.
  writeWithAi: async (data: WriteWithAiRequest): Promise<WriteWithAiResponse> =>
    unwrap(await client.post<Wrapped<WriteWithAiResponse>>(
      '/api/v1/workbench/write-with-ai', data, { timeout: 900_000 },
    )),

  continueWriting: async (data: ContinueWritingRequest): Promise<ContinueWritingResponse> =>
    unwrap(await client.post<Wrapped<ContinueWritingResponse>>(
      '/api/v1/workbench/continue-writing', data, { timeout: 180_000 },
    )),

  reviewDocument: async (data: ReviewDocumentRequest): Promise<ReviewDocumentResponse> =>
    unwrap(await client.post<Wrapped<ReviewDocumentResponse>>(
      '/api/v1/workbench/review-document', data, { timeout: 120_000 },
    )),
}
