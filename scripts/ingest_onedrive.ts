/**
 * Ingestion script: OneDrive → Text Extraction → Chunking → Embeddings → Azure Search
 * 
 * Supported file types: .txt, .md, .pdf, .docx, .pptx
 */

// Dynamic imports will be done in the functions that need them

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

// Import from web app (we'll need to adjust paths or copy functions)
// For now, let's implement the core logic here

const requiredEnvVars = [
  "OPENAI_API_KEY",
  "OPENAI_EMBED_MODEL",
  "MS_TENANT_ID",
  "MS_CLIENT_ID",
  "MS_CLIENT_SECRET",
  "ONEDRIVE_USER_PRINCIPAL_NAME",
  "ONEDRIVE_FOLDER_PATH",
  "AZURE_SEARCH_ENDPOINT",
  "AZURE_SEARCH_API_KEY",
  "AZURE_SEARCH_INDEX_NAME",
] as const;

function validateEnv() {
  const missing: string[] = [];
  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  return {
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
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

interface OneDriveItem {
  id: string;
  name: string;
  webUrl: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  lastModifiedDateTime?: string;
  size?: number;
}

interface OneDriveListResponse {
  value: OneDriveItem[];
  "@odata.nextLink"?: string;
}

// Graph Token
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getGraphToken(config: ReturnType<typeof validateEnv>): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${config.msGraph.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.msGraph.clientId,
    client_secret: config.msGraph.clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Graph token fetch failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
  return data.access_token;
}

// Get drive info
async function getUserOneDriveInfo(
  accessToken: string,
  userPrincipalName: string
): Promise<{ driveId: string; rootId: string }> {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userPrincipalName)}/drive`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get OneDrive drive: ${response.status}`);
  }

  const data = await response.json();
  const rootUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userPrincipalName)}/drive/root`;
  const rootResponse = await fetch(rootUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!rootResponse.ok) {
    throw new Error(`Failed to get OneDrive root: ${rootResponse.status}`);
  }

  const rootData = await rootResponse.json();
  return {
    driveId: data.id,
    rootId: rootData.id,
  };
}

// List OneDrive files recursively (only .txt and .md)
async function listOneDriveFiles(
  accessToken: string,
  driveId: string,
  rootId: string,
  folderPath: string
): Promise<OneDriveItem[]> {
  // Find target folder
  const rootChildrenUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${rootId}/children`;
  const rootChildrenResponse = await fetch(rootChildrenUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!rootChildrenResponse.ok) {
    throw new Error(`Failed to list root children: ${rootChildrenResponse.status}`);
  }

  const rootChildrenData: OneDriveListResponse = await rootChildrenResponse.json();
  const folderName = folderPath.replace(/^\//, "");
  const folder = rootChildrenData.value.find(
    (item) => item.name === folderName && item.folder !== undefined
  );

  if (!folder) {
    throw new Error(`Folder not found: ${folderName}`);
  }

  const folderId = folder.id.includes("!") ? folder.id.split("!")[1] : folder.id;
  const allFiles: OneDriveItem[] = [];

  // Recursively list all files
  async function listRecursive(itemId: string) {
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/children`;
    let nextLink: string | undefined = url;

    while (nextLink) {
      const response = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to list folder: ${response.status}`);
      }

      const data: OneDriveListResponse = await response.json();

      for (const item of data.value) {
        if (item.file) {
          // Supported file types: .pdf, .docx, .xlsx (pptx optional)
          const ext = item.name.split(".").pop()?.toLowerCase();
          if (ext === "pdf" || ext === "docx" || ext === "xlsx" || ext === "pptx") {
            // Ensure we have lastModifiedDateTime and size
            const fileItem: OneDriveItem = {
              ...item,
              lastModifiedDateTime: (item as any).lastModifiedDateTime,
              size: (item as any).size,
            };
            allFiles.push(fileItem);
          }
        } else if (item.folder) {
          // Recursively list subfolders
          const childId = item.id.includes("!") ? item.id.split("!")[1] : item.id;
          await listRecursive(childId);
        }
      }

      nextLink = data["@odata.nextLink"];
    }
  }

  await listRecursive(folderId);
  return allFiles;
}

// Download file content (returns Buffer for binary files)
async function downloadFileContent(
  accessToken: string,
  driveId: string,
  itemId: string
): Promise<Buffer> {
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Extract text from file based on type
async function extractTextFromFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "txt":
    case "md":
      return buffer.toString("utf-8");

    case "pdf":
      try {
        // pdf-parse v2 uses PDFParse class
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        const { PDFParse } = require("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        return result.text ?? "";
      } catch (error) {
        throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : error}`);
      }

    case "docx":
      try {
        // Use require for CommonJS module
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        const mammoth = require("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } catch (error) {
        throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : error}`);
      }

    case "pptx":
      try {
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        const PPTX2Json = require("pptx2json");
        const parser = new PPTX2Json();
        
        // Use buffer2json to avoid temp file
        const json = await parser.buffer2json(buffer);
        
        // Extract text from all slides - parse XML structure
        const textParts: string[] = [];
        
        // Find all slide XML files
        const slideFiles = Object.keys(json).filter((key) => 
          key.startsWith("ppt/slides/slide") && key.endsWith(".xml")
        );
        
        for (const slideFile of slideFiles) {
          const slideXml = json[slideFile];
          if (slideXml && slideXml["p:sld"]) {
            // Extract text from slide XML structure
            const extractTextFromNode = (node: any): string[] => {
              const texts: string[] = [];
              if (typeof node === "string") {
                texts.push(node);
              } else if (Array.isArray(node)) {
                for (const item of node) {
                  texts.push(...extractTextFromNode(item));
                }
              } else if (typeof node === "object" && node !== null) {
                // Check for text nodes (a:t in PowerPoint XML)
                if (node["a:t"]) {
                  const textNodes = Array.isArray(node["a:t"]) ? node["a:t"] : [node["a:t"]];
                  for (const textNode of textNodes) {
                    if (typeof textNode === "string") {
                      texts.push(textNode);
                    } else if (textNode._) {
                      texts.push(textNode._);
                    }
                  }
                }
                // Recursively check all properties
                for (const key in node) {
                  texts.push(...extractTextFromNode(node[key]));
                }
              }
              return texts;
            };
            
            const slideTexts = extractTextFromNode(slideXml);
            textParts.push(...slideTexts.filter((t) => t && t.trim().length > 0));
          }
        }
        
        const result = textParts.join(" ").trim();
        if (!result) {
          console.warn(`No text extracted from PPTX file: ${fileName}`);
          return "";
        }
        return result;
      } catch (error) {
        throw new Error(`PPTX parsing failed: ${error instanceof Error ? error.message : error}`);
      }

    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

// Chunk text (simple approach: ~1000 chars per chunk with overlap)
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;
    
    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > start + chunkSize * 0.5) {
        end = breakPoint + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    // Guardrail: Drop chunks < 200 chars
    if (chunk.length >= 200) {
      chunks.push(chunk);
    }
    start = end - overlap;
    
    if (start >= text.length) break;
  }

  return chunks;
}

// Get embeddings from OpenAI
async function getEmbedding(
  text: string,
  apiKey: string,
  model: string
): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
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

// Get already indexed files from Azure Search (file_id + updated_at)
async function getIndexedFiles(
  endpoint: string,
  apiKey: string,
  indexName: string,
  tenantId: string
): Promise<Map<string, string>> {
  // Map: file_id -> updated_at (ISO string)
  const indexedFiles = new Map<string, string>();
  
  let skip = 0;
  const top = 1000; // Azure Search max
  
  while (true) {
    const url = `${endpoint}/indexes/${indexName}/docs/search?api-version=2024-03-01-Preview`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        filter: `tenant_id eq '${tenantId}'`,
        select: 'file_id,updated_at',
        top: top,
        skip: skip,
        orderby: 'file_id',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure Search query failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const results = data.value || [];
    
    if (results.length === 0) break;
    
    // Group by file_id, keep latest updated_at
    for (const doc of results) {
      if (doc.file_id) {
        const existing = indexedFiles.get(doc.file_id);
        if (!existing || (doc.updated_at && doc.updated_at > existing)) {
          indexedFiles.set(doc.file_id, doc.updated_at || '');
        }
      }
    }
    
    if (results.length < top) break; // No more results
    skip += top;
  }
  
  return indexedFiles;
}

// Upsert to Azure Search
async function upsertToAzureSearch(
  documents: Array<{
    id: string;
    tenant_id: string;
    source: string;
    file_id: string;
    file_path: string;
    file_name: string;
    file_web_url: string;
    mime_type: string;
    language: string;
    chunk_id: string;
    chunk_offset: number;
    content: string;
    content_vector: number[];
    content_hash: string;
    updated_at: string;
  }>,
  endpoint: string,
  apiKey: string,
  indexName: string
): Promise<void> {
  const url = `${endpoint}/indexes/${indexName}/docs/index?api-version=2023-11-01`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      value: documents,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure Search upsert failed: ${response.status} - ${errorText}`);
  }
}

// Simple hash function for content_hash
function hashContent(content: string): string {
  // Simple hash - in production, use crypto.createHash
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

async function main() {
  try {
    console.log("🚀 Starting OneDrive ingestion...");
    const config = validateEnv();

    // Get Graph token
    console.log("📡 Getting Graph token...");
    const accessToken = await getGraphToken(config);

    // Get drive info
    console.log("📂 Getting OneDrive info...");
    const driveInfo = await getUserOneDriveInfo(
      accessToken,
      config.msGraph.onedriveUserPrincipalName
    );

    // Get already indexed files from Azure Search
    console.log("🔍 Checking already indexed files...");
    const indexedFiles = await getIndexedFiles(
      config.azureSearch.endpoint,
      config.azureSearch.apiKey,
      config.azureSearch.indexName,
      config.msGraph.tenantId
    );
    console.log(`   Found ${indexedFiles.size} already indexed files`);

    // List files
    console.log("📋 Listing files...");
    const files = await listOneDriveFiles(
      accessToken,
      driveInfo.driveId,
      driveInfo.rootId,
      config.msGraph.onedriveFolderPath
    );
    console.log(`Found ${files.length} files`);

    if (files.length === 0) {
      console.log("⚠️  No files found. Exiting.");
      process.exit(0);
    }

    // Process files
    const allDocuments: Array<{
      id: string;
      tenant_id: string;
      source: string;
      file_id: string;
      file_path: string;
      file_name: string;
      file_web_url: string;
      mime_type: string;
      language: string;
      chunk_id: string;
      chunk_offset: number;
      content: string;
      content_vector: number[];
      content_hash: string;
      updated_at: string;
    }> = [];

    // Guardrail constants
    const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
    const MAX_TEXT_LENGTH = 300000; // 300k chars
    const MAX_CHUNKS = 300;

    let skippedCount = 0;
    let skippedUnchangedCount = 0;
    let skippedXlsxCount = 0;
    let newCount = 0;
    let updatedCount = 0;

    // First pass: categorize all files
    console.log(`\n📋 Categorizing ${files.length} files...`);
    const fileCategories: Array<{ file: OneDriveItem; category: 'new' | 'updated' | 'unchanged' | 'xlsx' }> = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = file.id.includes("!") ? file.id.split("!")[1] : file.id;
      const ext = file.name.split(".").pop()?.toLowerCase();
      
      // Check for XLSX early
      if (ext === "xlsx") {
        fileCategories.push({ file, category: 'xlsx' });
        continue;
      }
      
      // Check if file is already indexed
      const indexedUpdatedAt = indexedFiles.get(fileId);
      const fileModifiedAt = file.lastModifiedDateTime;
      
      if (indexedUpdatedAt && fileModifiedAt) {
        const indexedDate = new Date(indexedUpdatedAt);
        const fileDate = new Date(fileModifiedAt);
        
        if (fileDate <= indexedDate) {
          fileCategories.push({ file, category: 'unchanged' });
        } else {
          fileCategories.push({ file, category: 'updated' });
        }
      } else {
        fileCategories.push({ file, category: 'new' });
      }
    }
    
    // Log summary (only show if there are files to process or problems)
    const newFiles = fileCategories.filter(f => f.category === 'new').length;
    const updatedFiles = fileCategories.filter(f => f.category === 'updated').length;
    const unchangedFiles = fileCategories.filter(f => f.category === 'unchanged').length;
    const xlsxFiles = fileCategories.filter(f => f.category === 'xlsx').length;
    
    if (newFiles > 0 || updatedFiles > 0 || xlsxFiles > 0) {
      console.log(`\n📋 Files to process:`);
      if (newFiles > 0) console.log(`   ✨ New: ${newFiles}`);
      if (updatedFiles > 0) console.log(`   🔄 Updated: ${updatedFiles}`);
      if (xlsxFiles > 0) console.log(`   ⚠️  XLSX (not supported): ${xlsxFiles}`);
      if (unchangedFiles > 0) console.log(`   ⏭️  Unchanged: ${unchangedFiles} (skipped silently)`);
      console.log(``);
    }

    // Second pass: process files
    for (let i = 0; i < fileCategories.length; i++) {
      const { file, category } = fileCategories[i];
      const fileId = file.id.includes("!") ? file.id.split("!")[1] : file.id;
      
      if (category === 'xlsx') {
        // Log XLSX files (unsupported type - problem case)
        console.log(`⚠️  ${i + 1}/${files.length}: ${file.name} (XLSX not supported)`);
        skippedXlsxCount++;
        skippedCount++;
        continue;
      }
      
      if (category === 'unchanged') {
        // Skip unchanged files silently (normal case)
        skippedUnchangedCount++;
        skippedCount++;
        continue;
      }
      
      if (category === 'updated') {
        console.log(`🔄 ${i + 1}/${files.length}: ${file.name} (modified)`);
        updatedCount++;
      } else {
        console.log(`✨ ${i + 1}/${files.length}: ${file.name}`);
        newCount++;
      }
      
      const indexedUpdatedAt = indexedFiles.get(fileId);
      const fileModifiedAt = file.lastModifiedDateTime;

      try {
        // Guardrail 1: File size check
        if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
          console.log(`⚠️  ${i + 1}/${files.length}: ${file.name} (too large: ${Math.round(file.size / 1024 / 1024)}MB)`);
          skippedCount++;
          // Adjust counts: if it was counted as "new" or "updated", reduce those counts
          if (!indexedUpdatedAt) {
            newCount--;
          } else if (fileModifiedAt && new Date(fileModifiedAt) > new Date(indexedUpdatedAt)) {
            updatedCount--;
          }
          continue;
        }

        // Download
        const fileBuffer = await downloadFileContent(accessToken, driveInfo.driveId, fileId);
        console.log(`   Downloaded: ${fileBuffer.length} bytes`);
        
        // Guardrail 1 (after download): Check actual buffer size
        if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
          console.log(`⚠️  ${i + 1}/${files.length}: ${file.name} (too large: ${Math.round(fileBuffer.length / 1024 / 1024)}MB)`);
          skippedCount++;
          // Adjust counts: if it was counted as "new" or "updated", reduce those counts
          if (!indexedUpdatedAt) {
            newCount--;
          } else if (fileModifiedAt && new Date(fileModifiedAt) > new Date(indexedUpdatedAt)) {
            updatedCount--;
          }
          continue;
        }
        
        // Check file type before extraction
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "xlsx") {
          console.log(`   ⚠️  SKIPPED_XLSX_NOT_SUPPORTED: ${file.name} (XLSX extraction not implemented)`);
          skippedCount++;
          // Adjust counts: if it was counted as "new" or "updated", reduce those counts
          if (!indexedUpdatedAt) {
            newCount--;
          } else if (fileModifiedAt && new Date(fileModifiedAt) > new Date(indexedUpdatedAt)) {
            updatedCount--;
          }
          continue;
        }

        // Extract text
        const content = await extractTextFromFile(fileBuffer, file.name);
        console.log(`   Extracted text: ${content.length} chars`);
        
        // Guardrail 2: Content length check
        if (content.length > MAX_TEXT_LENGTH) {
          console.log(`⚠️  ${i + 1}/${files.length}: ${file.name} (too much text: ${content.length} chars, max ${MAX_TEXT_LENGTH})`);
          skippedCount++;
          // Adjust counts: if it was counted as "new" or "updated", reduce those counts
          if (!indexedUpdatedAt) {
            newCount--;
          } else if (fileModifiedAt && new Date(fileModifiedAt) > new Date(indexedUpdatedAt)) {
            updatedCount--;
          }
          continue;
        }
        
        // Mini-Test: Log first 200 chars for first PDF and PPTX
        if (i < 2 && (file.name.toLowerCase().endsWith(".pdf") || file.name.toLowerCase().endsWith(".pptx"))) {
          const preview = content.substring(0, 200).replace(/\s+/g, " ").trim();
          console.log(`   Preview (first 200 chars): ${preview}...`);
        }

        // Chunk
        const chunks = chunkText(content);
        console.log(`   Chunked into ${chunks.length} chunks`);
        
        // Guardrail 3: Chunk count check
        if (chunks.length > MAX_CHUNKS) {
          console.log(`   ⚠️  SKIPPED_TOO_MANY_CHUNKS: ${file.name} (${chunks.length} chunks, max ${MAX_CHUNKS})`);
          continue;
        }

        // Embed and create documents
        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
          const chunk = chunks[chunkIdx];
          console.log(`   Embedding chunk ${chunkIdx + 1}/${chunks.length}...`);

          const embedding = await getEmbedding(
            chunk,
            config.openai.apiKey,
            config.openai.embedModel
          );

          const chunkId = `${fileId}_chunk_${chunkIdx}`;
          const docId = `${fileId}_${chunkIdx}`;
          const contentHash = hashContent(chunk);

          // Use file's lastModifiedDateTime if available, otherwise current time
          const updatedAt = file.lastModifiedDateTime 
            ? new Date(file.lastModifiedDateTime).toISOString()
            : new Date().toISOString();

          allDocuments.push({
            id: docId,
            tenant_id: config.msGraph.tenantId,
            source: "onedrive",
            file_id: fileId,
            file_path: file.name, // Simplified for MVP
            file_name: file.name,
            file_web_url: file.webUrl,
            mime_type: file.file?.mimeType || "text/plain",
            language: "de", // Default, could detect later
            chunk_id: chunkId,
            chunk_offset: chunkIdx,
            content: chunk,
            content_vector: embedding,
            content_hash: contentHash,
            updated_at: updatedAt,
          });
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${file.name}:`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    // Summary before upsert
    console.log(`\n📊 Summary:`);
    console.log(`   ✨ New files: ${newCount}`);
    console.log(`   🔄 Updated files: ${updatedCount}`);
    console.log(`   ⏭️  Skipped (unchanged): ${skippedUnchangedCount}`);
    if (skippedXlsxCount > 0) {
      console.log(`   📊 Skipped (XLSX not supported): ${skippedXlsxCount}`);
    }
    console.log(`   📄 Total documents to upsert: ${allDocuments.length}`);

    // Pipeline Guard: Allow exit if all files were skipped (already up to date or unsupported types)
    if (allDocuments.length === 0) {
      if (skippedCount > 0) {
        console.log("\n✅ No documents to upsert. All files were skipped (unchanged or unsupported types like XLSX).");
        process.exit(0);
      } else {
        console.error("\n❌ Ingestion failed: No documents were processed and upserted.");
        console.error("   Check file parsing errors above.");
        process.exit(1);
      }
    }

    // Upsert to Azure Search
    console.log(`\n📤 Upserting ${allDocuments.length} documents to Azure Search...`);
    
    // Batch upsert (Azure Search allows up to 1000 docs per batch)
    const batchSize = 100;
    for (let i = 0; i < allDocuments.length; i += batchSize) {
      const batch = allDocuments.slice(i, i + batchSize);
      console.log(`   Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allDocuments.length / batchSize)}...`);
      await upsertToAzureSearch(batch, config.azureSearch.endpoint, config.azureSearch.apiKey, config.azureSearch.indexName);
    }

    console.log("\n✅ Ingestion completed successfully!");
    console.log(`\n📊 Final Summary:`);
    console.log(`   ✨ New files processed: ${newCount}`);
    console.log(`   🔄 Updated files processed: ${updatedCount}`);
    console.log(`   ⏭️  Skipped (unchanged): ${skippedCount}`);
    console.log(`   📄 Total documents upserted: ${allDocuments.length}`);
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

