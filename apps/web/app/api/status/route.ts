import { getConfig } from '@/lib/config';
import { NextResponse } from 'next/server';

type StatusResponse = {
  ok: boolean;
  graphTokenOk: boolean;
  searchOk: boolean;
  errors: string[];
  timestamp: string;
};

async function checkGraphToken(): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = getConfig();
    const tokenUrl = `https://login.microsoftonline.com/${config.msGraph.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.msGraph.clientId,
      client_secret: config.msGraph.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `Graph token fetch failed: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    if (!data.access_token) {
      return {
        ok: false,
        error: 'Graph token response missing access_token',
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkAzureSearch(): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = getConfig();
    const searchUrl = `${config.azureSearch.endpoint}/indexes?api-version=2023-11-01`;

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'api-key': config.azureSearch.apiKey,
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Azure Search request failed: ${response.status} ${response.statusText}`,
      };
    }

    // Try to parse JSON to ensure it's a valid response
    await response.json();

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET(): Promise<NextResponse<StatusResponse>> {
  const errors: string[] = [];

  // Try to get config first - if it fails, we'll catch it
  let configError: string | null = null;
  try {
    getConfig();
  } catch (error) {
    configError = error instanceof Error ? error.message : 'Config validation failed';
    errors.push(`Config: ${configError}`);
  }

  // If config failed, return early
  if (configError) {
    return NextResponse.json(
      {
        ok: false,
        graphTokenOk: false,
        searchOk: false,
        errors,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  // Check Graph token
  const graphCheck = await checkGraphToken();
  if (!graphCheck.ok) {
    errors.push(`Graph token: ${graphCheck.error}`);
  }

  // Check Azure Search
  const searchCheck = await checkAzureSearch();
  if (!searchCheck.ok) {
    errors.push(`Azure Search: ${searchCheck.error}`);
  }

  const response: StatusResponse = {
    ok: graphCheck.ok && searchCheck.ok,
    graphTokenOk: graphCheck.ok,
    searchOk: searchCheck.ok,
    errors,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: 200 });
}

