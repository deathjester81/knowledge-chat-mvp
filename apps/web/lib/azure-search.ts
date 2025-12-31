/**
 * Azure AI Search client utilities.
 */

import { getConfig } from './config';

export interface SearchResult {
  id: string;
  file_name: string;
  file_path: string;
  file_web_url: string;
  chunk_id: string;
  content: string;
  '@search.score'?: number;
}

/**
 * Performs vector search in Azure AI Search.
 */
export async function vectorSearch(
  queryVector: number[],
  topK: number = 5
): Promise<SearchResult[]> {
  const config = getConfig();
  const url = `${config.azureSearch.endpoint}/indexes/${config.azureSearch.indexName}/docs/search?api-version=2024-03-01-Preview`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.azureSearch.apiKey,
    },
    body: JSON.stringify({
      vectorQueries: [
        {
          kind: 'vector',
          vector: queryVector,
          k: topK,
          fields: 'content_vector',
        },
      ],
      select: 'id,file_name,file_path,file_web_url,chunk_id,content',
      top: topK,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure Search failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.value || [];
}
