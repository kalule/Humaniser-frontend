export { RUN_FAILURES } from '../../lib/qualitative'

export const dateTimeOrDash = (iso: string | null) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
