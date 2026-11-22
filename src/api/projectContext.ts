import client from './client'

// The shared client already unwraps the server's ApiResponse envelope.
const data = <T>(response: { data: T }) => response.data

/** A project's numbered research questions, used to prefill other tools from the project (research-platform W1). */
export const projectResearchQuestions = (projectId: string) =>
  client.get<{ number: number; questionText: string }[]>(`/api/v1/research/projects/${projectId}/research-questions`).then(data)
