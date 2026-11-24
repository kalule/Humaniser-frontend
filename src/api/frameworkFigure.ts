import client from './client'
import type { FrameworkFigureResponse } from '../types/frameworkFigure'

type Wrap<T> = { success: boolean; data: T }
const unwrap = <T>(res: { data: Wrap<T> | T }): T => ((res.data as Wrap<T>)?.data ?? res.data) as T

/** PR 8: the conceptual framework figure (the saved copy, or one computed from the saved text). Read-only. */
export const getFrameworkFigure = async (projectId: string): Promise<FrameworkFigureResponse> =>
  unwrap(await client.get<Wrap<FrameworkFigureResponse>>(`/api/v1/research/projects/${projectId}/proposal-framework-figure`))
