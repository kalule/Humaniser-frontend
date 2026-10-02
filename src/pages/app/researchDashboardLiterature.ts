import type { DashboardLiteratureFilter } from '../../types/research'

export const DEFAULT_DASHBOARD_LITERATURE_FILTER: DashboardLiteratureFilter = 'cited'

export function dashboardLiteratureRequestKey(
  userId: string, projectId: string, filter: DashboardLiteratureFilter,
  search: string, page: number, pageSize: number,
): string {
  return [userId, projectId, filter, search.trim().toLocaleLowerCase(), page, pageSize].join(':')
}
