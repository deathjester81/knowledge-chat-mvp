/**
 * Chat API endpoint: RAG query processing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEmbedding, chatWithContext } from '@/lib/openai';
import { vectorSearch } from '@/lib/azure-search';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // 1. Embed query
    const queryEmbedding = await getEmbedding(query);

    // 2. Vector search (topK=5)
    const searchResults = await vectorSearch(queryEmbedding, 5);

    if (searchResults.length === 0) {
      return NextResponse.json({
        answer: 'Es wurden keine relevanten Dokumente gefunden. Bitte versuche eine andere Frage.',
        sources: [],
      });
    }

    // 3. Build context and call OpenAI
    const contextChunks = searchResults.map((result) => ({
      content: result.content,
      file_name: result.file_name,
      file_web_url: result.file_web_url,
      chunk_id: result.chunk_id,
    }));

    const answer = await chatWithContext(query, contextChunks);

    // 4. Return answer + sources
    const sources = searchResults.map((result) => ({
      file_name: result.file_name,
      file_path: result.file_path,
      file_web_url: result.file_web_url,
      chunk_id: result.chunk_id,
      score: result['@search.score'],
    }));

    return NextResponse.json({
      answer,
      sources,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
