import type { EssayCitationStyle, EssayDiscipline } from '../types/workbench'

/** The citation style a subject normally uses. Mirrors EssayDisciplineProfile on the backend; General has no suggestion. */
const DISCIPLINE_STYLE: Partial<Record<EssayDiscipline, EssayCitationStyle>> = {
  Medicine: 'Vancouver',
  Nursing: 'Vancouver',
  Law: 'Chicago',
  History: 'Chicago',
  Psychology: 'Apa7',
  Education: 'Apa7',
  Engineering: 'Ieee',
  ComputerScience: 'Ieee',
  Cybersecurity: 'Ieee',
  Business: 'Harvard',
  Economics: 'Harvard',
  PoliticalScience: 'Harvard',
  SocialSciences: 'Harvard',
}

export function suggestedCitationStyle(discipline: EssayDiscipline): EssayCitationStyle | null {
  return DISCIPLINE_STYLE[discipline] ?? null
}
