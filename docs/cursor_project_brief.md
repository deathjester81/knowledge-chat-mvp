# Knowledge Chat MVP — Cursor Project Brief (Guardrails)

## Goal
Build a professional, productizable RAG web app that indexes content from OneDrive for Business (Microsoft 365 tenant) into Azure AI Search (vector index) and provides a chat UI with grounded answers + source links.

Target: demo-ready in 1–2 weeks, and later customer setup in < 1 day.

## Non-goals (MVP)
- No SharePoint Sites / Teams libraries in v1 (OneDrive only).
- No OCR / image-to-text in v1.
- No multi-user auth flows in v1 (no user login UI).
- No background job orchestration (Azure Functions) in v1.
- No advanced relevance tuning or reranking in v1.
- No role-based access model beyond “single tenant admin app”.

## Decisions / Architecture (MVP)
- Frontend: Next.js (App Router) + TypeScript + Tailwind.
- Deployment later: Vercel (but work locally first).
- Source: OneDrive for Business via Microsoft Graph.
- Graph auth: **Application permissions + client_credentials** (no delegated/user auth).
- Vector store: Azure AI Search.
- LLM + embeddings: OpenAI API.
- Index creation and ingestion must be **scriptable/reproducible**, not click-ops in portal.

## Environment Variables
Project uses a root `.env.local` (DO NOT COMMIT):

### OpenAI
- OPENAI_API_KEY=
- OPENAI_CHAT_MODEL=
- OPENAI_EMBED_MODEL=text-embedding-3-large  (=> 3072 dims)

### Microsoft Graph (OneDrive for Business)
- MS_TENANT_ID=
- MS_CLIENT_ID=
- MS_CLIENT_SECRET=
- ONEDRIVE_USER_PRINCIPAL_NAME=fabri@kairos-systems.ch
- ONEDRIVE_FOLDER_PATH=/RAG_Wissen

### Azure AI Search
- AZURE_SEARCH_ENDPOINT=
- AZURE_SEARCH_API_KEY=
- AZURE_SEARCH_INDEX_NAME=knowledge-chunks-v1

## Azure AI Search Index Requirements (CRITICAL)
The index MUST define vectorSearch profiles and algorithms explicitly, otherwise Azure errors like:
"index.vectorSearch.profiles.algorithm cannot be null or undefined."

Embedding model is `text-embedding-3-large` => vector dimension **3072**.

Index should include at least:
- id (key)
- tenant_id (filterable)
- source (filterable)
- file_id, file_path, file_name (filterable)
- file_web_url
- mime_type (filterable)
- language (filterable)
- chunk_id (filterable)
- chunk_offset (filterable/int)
- content (searchable)
- content_vector (vector: dims=3072, profile=v1)
- content_hash (filterable)
- updated_at (filterable/sortable)

Vector algorithm: HNSW (cosine).

## MVP Flow (Golden Path)
1) `/api/status` returns:
   - env sanity check OK
   - can fetch Graph token via client_credentials
   - can reach Azure Search endpoint (basic ping)
2) Index creation script creates/updates `knowledge-chunks-v1`.
3) Ingestion script:
   - List OneDrive folder recursively starting from ONEDRIVE_FOLDER_PATH
   - For each supported file: download content
   - Extract text (start with .txt/.md first; add pdf/docx later)
   - Chunk text
   - Embed chunks via OpenAI embeddings
   - Upsert documents to Azure AI Search
4) Chat endpoint:
   - Embed query
   - Vector search topK
   - Build context (citations with file_web_url + file_path + chunk_id)
   - Call OpenAI chat model
   - Return answer + sources
5) UI:
   - Text input, answer area, sources list with clickable links

## Supported File Types (phased)
Phase 1 (fast demo):
- .txt, .md

Phase 2:
- .pdf, .docx (text extraction)

## Security / Operational Guardrails
- Never commit `.env.local` or secrets.
- Log only high-level errors; never log tokens or secrets.
- Keep Graph permissions minimal long-term (MVP may be broader, but plan to reduce).
- Customer setup later should be a checklist + script-first approach.

## Project Structure (expected)
repo root:
- docs/
- apps/web/        (Next.js)
- scripts/         (index creation + ingestion)
- README.md
- .gitignore
- .env.local (local only)
