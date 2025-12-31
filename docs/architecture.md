# docs/architecture.md

# Architektur: Knowledge Chat MVP (Azure-first)

## Überblick
User → Chat UI (Next.js) → /api/chat
/api/chat:
  1) Embed query (OpenAI Embeddings)
  2) Azure AI Search vector query (topK)
  3) Build context pack (snippets + citations)
  4) Call OpenAI Chat model with system prompt + context
  5) Return answer + sources

Ingestion (MVP manuell):
User → /api/ingest (button)
/api/ingest:
  1) Graph: list files under ONEDRIVE_FOLDER_PATH
  2) For each file:
     - download
     - extract text (PDF/DOCX/PPTX/XLSX)
     - chunk
     - embed chunks
     - upsert to Azure Search
  3) Return summary: files processed, chunks created, errors

## RAG Prompting (MVP)
System:
- Antworte präzise.
- Wenn du etwas nicht in den Quellen findest: sag es klar.
- Zitiere Quellen: file_name + link + chunk_id.

User: Question
Context: top retrieved chunks

## Indexing (Azure AI Search)
- Store both `content` (text) + `content_vector` (embedding)
- Filterable fields: tenant_id, language, file_path, mime_type
- Dedup via content_hash (optional)

## Bilder / OCR
MVP:
- only metadata indexed
Post-MVP:
- OCR extracted text becomes additional chunks
- index those chunks with mime_type=image/* and ocr=true

## Model configuration (no hardcoding)
- OPENAI_CHAT_MODEL, OPENAI_EMBED_MODEL in env/config
- One config module returns currently active models
- UI can later allow switching providers

## Productization path
Phase 1 (MVP): single tenant, single index, manual ingest trigger
Phase 2: ingestion worker (Azure Function), scheduled updates
Phase 3: auth + user mgmt + multi-tenant + template deploy
Phase 4: personas + memory + persistent chat + FAQ modules

## Template strategy
- Keep everything config-driven:
  - tenantId
  - folderPath
  - indexName
  - branding (logo/colors)
- Provide a “tenant bootstrap” script to create index + env scaffolding
