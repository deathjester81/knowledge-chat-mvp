/**
 * Quick script to check how many documents are in Azure Search index
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function checkIndex() {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
  const apiKey = process.env.AZURE_SEARCH_API_KEY;
  const indexName = process.env.AZURE_SEARCH_INDEX_NAME;

  if (!endpoint || !apiKey || !indexName) {
    throw new Error("Missing Azure Search environment variables");
  }

  // Count documents using $count=true
  const url = `${endpoint}/indexes/${indexName}/docs/$count?api-version=2023-11-01`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "api-key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to count documents: ${response.status} - ${errorText}`);
  }

  const count = await response.json();
  console.log(`\n📊 Documents in index '${indexName}': ${count.value || count}\n`);
  
  // Also get a sample document
  const sampleUrl = `${endpoint}/indexes/${indexName}/docs/search?api-version=2023-11-01&$top=1`;
  const sampleResponse = await fetch(sampleUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      search: "*",
      select: "id, file_name, chunk_offset, content",
    }),
  });

  if (sampleResponse.ok) {
    const sampleData = await sampleResponse.json();
    if (sampleData.value && sampleData.value.length > 0) {
      const doc = sampleData.value[0];
      console.log("📄 Sample document:");
      console.log(`   File: ${doc.file_name}`);
      console.log(`   Chunk: ${doc.chunk_offset}`);
      console.log(`   Content preview: ${doc.content?.substring(0, 100)}...\n`);
    }
  }
}

checkIndex().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
