/**
 * Manual ingestion endpoint: triggers OneDrive → Azure Search ingestion.
 * 
 * Checks for new or changed files and processes them.
 */

import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { resolve } from 'path';

export async function POST() {
  try {
    // Spawn the ingestion script
    // process.cwd() in Next.js API routes is apps/web
    const projectRoot = resolve(process.cwd(), '../..');
    const scriptPath = resolve(projectRoot, 'scripts/ingest_onedrive.ts');
    
    return new Promise((resolvePromise) => {
      // On Windows, use cmd.exe to run npx (finds it in PATH)
      // This avoids ENOENT errors when npx is not directly in PATH
      const isWindows = process.platform === 'win32';
      
      // Set a timeout (30 minutes max for ingestion)
      const timeout = setTimeout(() => {
        if (child && !child.killed) {
          child.kill();
          resolvePromise(
            NextResponse.json(
              {
                success: false,
                message: 'Ingestion timeout after 30 minutes',
                error: 'Process was terminated due to timeout',
              },
              { status: 500 }
            )
          );
        }
      }, 30 * 60 * 1000); // 30 minutes
      
      let child;
      if (isWindows) {
        // Windows: use cmd.exe /c to run npx
        child = spawn('cmd.exe', ['/c', 'npx', 'tsx', scriptPath], {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          env: process.env,
        });
      } else {
        // Unix/Mac: use npx directly
        child = spawn('npx', ['tsx', scriptPath], {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          env: process.env,
        });
      }

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        // Log to console for debugging
        console.log('[Ingest]', text.trim());
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        // Log to console for debugging
        console.error('[Ingest Error]', text.trim());
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        const allOutput = stdout + stderr;
        
        if (code === 0) {
          resolvePromise(
            NextResponse.json({
              success: true,
              message: 'Ingestion completed successfully',
              output: allOutput.split('\n').slice(-20).join('\n'), // Last 20 lines
            })
          );
        } else {
          // Extract error message from output
          const errorLines = allOutput
            .split('\n')
            .filter((line) => line.includes('Error') || line.includes('error') || line.includes('SKIPPED') || line.includes('FAILED'))
            .slice(-10)
            .join('\n');
          
          resolvePromise(
            NextResponse.json(
              {
                success: false,
                message: `Ingestion failed with exit code ${code}`,
                error: errorLines || allOutput.slice(-500), // Last 500 chars if no error lines
                exitCode: code,
              },
              { status: 500 }
            )
          );
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        console.error('[Ingest] Process error:', error);
        resolvePromise(
          NextResponse.json(
            {
              success: false,
              message: 'Failed to start ingestion process',
              error: error.message,
            },
            { status: 500 }
          )
        );
      });
    });
  } catch (error) {
    console.error('[Ingest] Route error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Ingestion error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
