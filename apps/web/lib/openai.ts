/**
 * OpenAI API client utilities.
 */

import { getConfig } from './config';

/**
 * Generates embedding for text.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const config = getConfig();
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openai.embedModel,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI embedding failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Calls OpenAI Chat API with context and returns response.
 */
export async function chatWithContext(
  query: string,
  contextChunks: Array<{ content: string; file_name: string; file_web_url: string; chunk_id: string }>
): Promise<string> {
  const config = getConfig();

  // Build context from chunks
  const contextText = contextChunks
    .map((chunk, idx) => {
      return `[Quelle ${idx + 1}: ${chunk.file_name}]\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  // Build citations list
  const citations = contextChunks
    .map((chunk, idx) => `${idx + 1}. ${chunk.file_name} (Chunk: ${chunk.chunk_id})`)
    .join('\n');

  const systemPrompt = `Du bist ein hilfreicher Assistent, der Fragen basierend auf bereitgestellten Dokumenten beantwortet.

WICHTIG:
- Antworte präzise und auf Deutsch.
- Beziehe dich nur auf die bereitgestellten Quellen.
- Wenn die Antwort nicht in den Quellen steht, sage das klar.
- Zitiere Quellen mit Nummern [1], [2], etc.

Quellen:
${citations}`;

  const userPrompt = `Frage: ${query}

Kontext aus Dokumenten:
${contextText}

Antworte auf Deutsch basierend auf dem Kontext. Zitiere Quellen mit [1], [2], etc.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openai.chatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI chat failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
