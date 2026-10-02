import { describe, expect, it } from 'vitest'
import { DEFAULT_DASHBOARD_LITERATURE_FILTER, dashboardLiteratureRequestKey } from './researchDashboardLiterature'

describe('Research Dashboard literature requests', () => {
  it('defaults to cited rather than fetching all articles', () => {
    expect(DEFAULT_DASHBOARD_LITERATURE_FILTER).toBe('cited')
  })

  it('scopes request identity by user, project, filter, search and page', () => {
    expect(dashboardLiteratureRequestKey('u1', 'p1', 'cited', ' AI ', 1, 25))
      .not.toBe(dashboardLiteratureRequestKey('u2', 'p1', 'cited', ' AI ', 1, 25))
    expect(dashboardLiteratureRequestKey('u1', 'p1', 'cited', ' AI ', 1, 25))
      .not.toBe(dashboardLiteratureRequestKey('u1', 'p1', 'all', ' AI ', 1, 25))
  })
})
