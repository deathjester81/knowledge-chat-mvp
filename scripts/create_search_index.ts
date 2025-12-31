/**
 * Creates or updates the Azure AI Search index for knowledge chunks.
 * 
 * Requirements:
 * - Vector dimension: 3072 (text-embedding-3-large)
 * - Algorithm: HNSW with cosine similarity
 * - Must define vectorSearch profiles explicitly
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env.local from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

const requiredEnvVars = [
  "AZURE_SEARCH_ENDPOINT",
  "AZURE_SEARCH_API_KEY",
  "AZURE_SEARCH_INDEX_NAME",
] as const;

function validateEnv(): {
  endpoint: string;
  apiKey: string;
  indexName: string;
} {
  const missing: string[] = [];

  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  return {
    endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
    apiKey: process.env.AZURE_SEARCH_API_KEY!,
    indexName: process.env.AZURE_SEARCH_INDEX_NAME!,
  };
}

interface IndexDefinition {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    key?: boolean;
    searchable?: boolean;
    filterable?: boolean;
    sortable?: boolean;
    retrievable?: boolean;
    vectorSearchDimensions?: number;
    vectorSearchProfile?: string;
  }>;
  vectorSearch?: {
    algorithms: Array<{
      name: string;
      kind: string;
      parameters?: {
        metric?: string;
        m?: number;
        efConstruction?: number;
        efSearch?: number;
      };
    }>;
    profiles: Array<{
      name: string;
      algorithm: string;
    }>;
  };
}

function createIndexDefinition(indexName: string): IndexDefinition {
  return {
    name: indexName,
    fields: [
      {
        name: "id",
        type: "Edm.String",
        key: true,
        retrievable: true,
      },
      {
        name: "tenant_id",
        type: "Edm.String",
        filterable: true,
        retrievable: true,
      },
      {
        name: "source",
        type: "Edm.String",
        filterable: true,
        retrievable: true,
      },
      {
        name: "file_id",
        type: "Edm.String",
        filterable: true,
        retrievable: true,
      },
      {
        name: "file_path",
        type: "Edm.String",
        filterable: true,
        retrievable: true,
      },
      {
        name: "file_name",
        type: "Edm.String",
        filterable: true,
        retrievable: true,
      },
      {
        name: "file_web_url",
        type: "Edm.String",
        retrievable: true,
      },
      {
        name: "mime_type",
        type: "Edm.String",
        filterable: true,
        retrievable: true,
      },
      {
        name: "language",
        type: "Edm.String",
        filterable: true,
        retrievable: true,
      },
      {
        name: "chunk_id",
        type: "Edm.String",
        filterable: true,
        retrievable: true,
      },
      {
        name: "chunk_offset",
        type: "Edm.Int32",
        filterable: true,
        sortable: true,
        retrievable: true,
      },
      {
        name: "content",
        type: "Edm.String",
        searchable: true,
        retrievable: true,
      },
      {
        name: "content_vector",
        type: "Collection(Edm.Single)",
        dimensions: 3072,
        vectorSearchProfile: "v1",
        retrievable: true,
      },
      {
        name: "content_hash",
        type: "Edm.String",
        filterable: true,
        retrievable: true,
      },
      {
        name: "updated_at",
        type: "Edm.DateTimeOffset",
        filterable: true,
        sortable: true,
        retrievable: true,
      },
    ],
    vectorSearch: {
      algorithms: [
        {
          name: "hnsw-cosine",
          kind: "hnsw",
          hnswParameters: {
            metric: "cosine",
            m: 4,
            efConstruction: 400,
            efSearch: 500,
          },
        },
      ],
      profiles: [
        {
          name: "v1",
          algorithm: "hnsw-cosine",
        },
      ],
    },
  };
}

async function createOrUpdateIndex(
  endpoint: string,
  apiKey: string,
  indexName: string
): Promise<void> {
  const indexUrl = `${endpoint}/indexes/${indexName}?api-version=2024-03-01-Preview`;
  const indexDefinition = createIndexDefinition(indexName);

  console.log(`Creating/updating index: ${indexName}`);
  console.log(`Endpoint: ${endpoint}`);

  const response = await fetch(indexUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(indexDefinition),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create/update index: ${response.status} ${response.statusText}\n${errorText}`
    );
  }

  const result = await response.json();
  console.log("✅ Index created/updated successfully");
  console.log(`Index name: ${result.name}`);
  console.log(`Fields: ${result.fields?.length || 0}`);
}

async function main() {
  try {
    const config = validateEnv();
    await createOrUpdateIndex(config.endpoint, config.apiKey, config.indexName);
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

