/**
 * Check if ingestion is available (not on Vercel serverless)
 */

import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  // Ingestion is not available on Vercel serverless functions
  const isAvailable = !process.env.VERCEL;
  
  return NextResponse.json({ available: isAvailable });
}
