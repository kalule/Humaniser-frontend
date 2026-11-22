// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import RobTrafficLightPlot from './RobTrafficLightPlot'
import RobSummaryPlot from './RobSummaryPlot'
import { PrismaFlowSvg } from './PrismaFlowDiagram'
import { buildPrismaBoxes, layoutPrisma } from '../../lib/prismaLayout'
import type { RobFigureData } from '../../lib/robFigures'

const data: RobFigureData = {
  toolName: 'RoB 2',
  domains: [{ code: 'D1', label: 'Bias arising from the randomization process' }, { code: 'D2', label: 'Bias due to missing outcome data' }],
  studies: [
    { id: 'a', label: 'Smith 2020', fullTitle: 'A randomised trial of a very long and descriptive title', judgements: ['low', 'high'], overall: 'high' },
    { id: 'b', label: 'Lee 2019', fullTitle: 'Another trial', judgements: ['some', 'low'], overall: 'some' },
  ],
  levelLabels: { low: 'Low', some: 'Some concerns', high: 'High', na: 'Not assessed' },
}

describe('risk of bias figures', () => {
  it('draws one circle per study x (domains + overall) and a full-title tooltip', () => {
    const { container } = render(<RobTrafficLightPlot data={data} scheme="cochrane" />)
    const grid = container.querySelectorAll('circle')
    // 2 studies x 3 columns + 3 legend swatches (low, some, high)
    expect(grid.length).toBe(2 * 3 + 3)
    expect(container.querySelector('circle')?.getAttribute('fill')).toBe('#02C100')
    const titles = Array.from(container.querySelectorAll('title')).map(t => t.textContent)
    expect(titles).toContain('A randomised trial of a very long and descriptive title')
    expect(container.textContent).toContain('Download SVG')
    expect(container.textContent).toContain('Download PNG')
  })

  it('draws the summary bars in the colour-blind palette', () => {
    const { container } = render(<RobSummaryPlot data={data} scheme="colourblind" />)
    const fills = Array.from(container.querySelectorAll('rect')).map(r => r.getAttribute('fill'))
    expect(fills).toContain('#fed98e')
    expect(fills).toContain('#d95f0e')
    expect(container.textContent).toContain('Overall risk of bias')
    expect(container.textContent).toContain('50%')
  })

  it('renders the PRISMA flow as SVG boxes', () => {
    const layout = layoutPrisma(buildPrismaBoxes({
      retrieved: 10, retrievedBySource: { PubMed: 10 }, duplicatesRemovedByDoi: 1, duplicatesRemovedByTitle: 0,
      excludedWithoutAbstract: 0, excludedByPublicationDate: 0, excludedByCitationThreshold: 0, readyForScreening: 9,
      titleAbstractScreened: 9, titleAbstractIncluded: 4, titleAbstractExcluded: 5, titleAbstractNeedsManualReview: 0,
      titleAbstractPending: 0, fullTextAssessed: 4, fullTextIncluded: 3, fullTextExcluded: 1, fullTextNeedsManualReview: 0,
      fullTextPending: 0, fullTextNeedsPdf: 0,
    }))
    const { container } = render(<PrismaFlowSvg layout={layout} />)
    expect(container.querySelectorAll('[data-box]').length).toBe(9)
    expect(container.textContent).toContain('Records identified from:')
    expect(container.textContent).toContain('Identification')
    expect(container.textContent).toContain('Reports not retrieved')
  })
})
