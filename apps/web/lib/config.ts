/**
 * Environment configuration loader with validation.
 * Never logs secrets or sensitive values.
 */

type Config = {
  // OpenAI
  openai: {
    apiKey: string;
    chatModel: string;
    embedModel: string;
  };
  // Microsoft Graph
  msGraph: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    onedriveUserPrincipalName: string;
    onedriveFolderPath: string;
  };
  // Azure AI Search
  azureSearch: {
    endpoint: string;
    apiKey: string;
    indexName: string;
  };
};

const requiredEnvVars = [
  'OPENAI_API_KEY',
  'OPENAI_CHAT_MODEL',
  'OPENAI_EMBED_MODEL',
  'MS_TENANT_ID',
  'MS_CLIENT_ID',
  'MS_CLIENT_SECRET',
  'ONEDRIVE_USER_PRINCIPAL_NAME',
  'ONEDRIVE_FOLDER_PATH',
  'AZURE_SEARCH_ENDPOINT',
  'AZURE_SEARCH_API_KEY',
  'AZURE_SEARCH_INDEX_NAME',
] as const;

function validateEnv(): Config {
  const missing: string[] = [];

  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  return {
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      chatModel: process.env.OPENAI_CHAT_MODEL!,
      embedModel: process.env.OPENAI_EMBED_MODEL!,
    },
    msGraph: {
      tenantId: process.env.MS_TENANT_ID!,
      clientId: process.env.MS_CLIENT_ID!,
      clientSecret: process.env.MS_CLIENT_SECRET!,
      onedriveUserPrincipalName: process.env.ONEDRIVE_USER_PRINCIPAL_NAME!,
      onedriveFolderPath: process.env.ONEDRIVE_FOLDER_PATH!,
    },
    azureSearch: {
      endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
      apiKey: process.env.AZURE_SEARCH_API_KEY!,
      indexName: process.env.AZURE_SEARCH_INDEX_NAME!,
    },
  };
}

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = validateEnv();
  }
  return cachedConfig;
}

