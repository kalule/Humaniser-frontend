import { beforeEach, describe, expect, it } from 'vitest'
import type { DatasetSchema } from '../types/analyst'
import { useAnalystStore } from './analystStore'

const ds = (id: string) =>
  ({ datasetId: id, fileName: `${id}.csv`, rowCount: 10, columnCount: 2, columns: [] } as unknown as DatasetSchema)

const state = () => useAnalystStore.getState()

describe('removeDataset', () => {
  beforeEach(() => {
    state().reset()
    state().addDataset('a', ds('a'))
    state().addDataset('b', ds('b'))
    state().addDataset('c', ds('c')) // c is primary + sole selected
    state().addMessage({ id: 'm1', role: 'user', content: 'hi', status: 'complete', createdAt: '' } as never)
    state().setSession('s1', 2)
  })

  it('removing a non-primary dataset keeps primary, chat and session', () => {
    useAnalystStore.setState({ isCleaned: true })
    state().removeDataset('a')
    expect(state().datasets.map((d) => d.datasetId)).toEqual(['b', 'c'])
    expect(state().datasetId).toBe('c')
    expect(state().isCleaned).toBe(true)
    expect(state().messages).toHaveLength(1)
    expect(state().sessionId).toBe('s1')
  })

  it('removing the primary promotes the next selected dataset and clears per-dataset state', () => {
    state().toggleDatasetSelected('a') // selected: [c, a]
    useAnalystStore.setState({ isCleaned: true })
    state().removeDataset('c')
    expect(state().datasetId).toBe('a')
    expect(state().schema?.datasetId).toBe('a')
    expect(state().selectedDatasetIds).toEqual(['a'])
    expect(state().isCleaned).toBe(false)
    expect(state().healthReport).toBeNull()
    expect(state().messages).toHaveLength(1)
    expect(state().sessionId).toBe('s1')
  })

  it('removing the only selected dataset falls back to the first remaining one', () => {
    state().removeDataset('c')
    expect(state().datasetId).toBe('a')
    expect(state().selectedDatasetIds).toEqual(['a'])
  })

  it('removing the last dataset is a full reset', () => {
    state().removeDataset('a')
    state().removeDataset('b')
    state().removeDataset('c')
    expect(state().datasets).toEqual([])
    expect(state().datasetId).toBeNull()
    expect(state().messages).toEqual([])
    expect(state().sessionId).toBeNull()
  })

  it('ignores an unknown id', () => {
    const before = state()
    state().removeDataset('zzz')
    expect(state()).toBe(before)
  })
})
