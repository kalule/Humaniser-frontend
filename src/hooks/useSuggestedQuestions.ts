import { useMemo } from 'react'
import type { DatasetSchema } from '../types/analyst'

const NUMERIC_DTYPES  = new Set(['int64', 'float64', 'int32', 'float32'])
const CATEGORY_DTYPES = new Set(['object', 'bool'])

export function useSuggestedQuestions(schema: DatasetSchema | null): string[] {
  return useMemo(() => {
    if (!schema) return []

    const numeric    = schema.columns.filter((c) => NUMERIC_DTYPES.has(c.dtype)).map((c) => c.name)
    const categorical = schema.columns.filter((c) => CATEGORY_DTYPES.has(c.dtype)).map((c) => c.name)

    const timeCol = schema.columns.find(
      (c) => c.name.toLowerCase().includes('year') || c.dtype.startsWith('datetime'),
    )

    // Prefer columns that aren't 100% null
    const validNumeric = numeric.filter((n) => {
      const col = schema.columns.find((c) => c.name === n)
      return (col?.nullPercent ?? 0) < 100
    })

    const questions: string[] = []

    questions.push('Summarise all columns with descriptive statistics')

    if (validNumeric.length >= 2) {
      questions.push('Plot a correlation heatmap of all numeric columns')
    }

    if (categorical.length > 0 && validNumeric.length > 0) {
      questions.push(`What is the average ${validNumeric[0]} grouped by ${categorical[0]}?`)
    }

    if (validNumeric.length >= 2) {
      questions.push(`Run a linear regression of ${validNumeric[1]} on ${validNumeric[0]}`)
    }

    if (timeCol && validNumeric.length > 0) {
      const target = validNumeric.find((n) => n !== timeCol.name) ?? validNumeric[0]
      questions.push(`Plot ${target} over time by ${timeCol.name}`)
    }

    questions.push('Which columns have missing values and what percentage are null?')

    if (validNumeric.length > 0) {
      questions.push(`Show the distribution of ${validNumeric[0]} as a histogram`)
    }

    if (categorical.length > 0) {
      questions.push(`How many unique values does ${categorical[0]} have? Show a bar chart.`)
    }

    return questions.slice(0, 6)
  }, [schema])
}
