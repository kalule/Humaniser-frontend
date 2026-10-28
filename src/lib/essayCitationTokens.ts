import type {
  EssayCitationStyleName,
  EssayReferenceMeta,
} from './citationFormat'
import { resolveCslTokens } from './csl/tokens'

export type ResolvableReference = EssayReferenceMeta & { sourceId: string }

/** Render internal citation tokens through CSL. Unknown/mixed clusters remain visible review
 * items; citation formatting never deletes a marker or rewrites the surrounding prose. */
export function resolveEssayCitationTokens(
  text: string,
  references: ReadonlyArray<ResolvableReference>,
  style: EssayCitationStyleName,
): string {
  const format = { Harvard: 'harvard', Apa7: 'apa7', Ieee: 'ieee', Chicago: 'chicago', Vancouver: 'vancouver' } as const
  return resolveCslTokens(text.replace(/\[CF\d+\]\s?/g, ''), references.map(ref => ({ ...ref, id: ref.sourceId })), format[style])
}
