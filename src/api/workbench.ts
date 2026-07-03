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
} from '../types/workbench'

type Wrapped<T> = { success: boolean; data: T }

const unwrap = <T>(res: { data: Wrapped<T> }): T =>
  res.data.data ?? (res.data as unknown as T)

export const workbenchApi = {
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
}
