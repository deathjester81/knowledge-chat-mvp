# Knowledge Chat MVP (OneDrive → Azure AI Search → Chat)

## Ziel
Ein produktisierbares RAG-Webapp-MVP:
- Quelle: OneDrive for Business (Microsoft 365 Tenant) via Microsoft Graph
- Index: Azure AI Search (Vector Search, HNSW)
- Chat UI: Next.js (App Router) mit Antworten + Quellenlinks
- Demo-fähig in 1–2 Wochen
- Später: Kunden-Setup in < 1 Tag (Checkliste + Scripts)

## Aktueller Stand (Infra)
✅ Microsoft 365 Tenant + Domain + Mail  
✅ Graph App Registration + Application Permissions + Token-Test OK  
✅ Azure Subscription + Resource Group `rg-kairos-rag-mvp`  
✅ Azure AI Search Service erstellt (Basic)

## Repo-Struktur (Soll)
- `docs/` – Projektbriefing & Aufgaben
- `apps/web/` – Next.js App (UI + API routes)
- `scripts/` – Index erstellen, Ingestion (OneDrive → Embeddings → Search)

## Environment
`.env.local` liegt im Repo-Root und wird NIE committed.

Benötigte Keys:
- OPENAI_API_KEY
- OPENAI_CHAT_MODEL
- OPENAI_EMBED_MODEL=text-embedding-3-large (3072 dims)
- MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET
- ONEDRIVE_USER_PRINCIPAL_NAME
- ONEDRIVE_FOLDER_PATH
- AZURE_SEARCH_ENDPOINT / AZURE_SEARCH_API_KEY / AZURE_SEARCH_INDEX_NAME

## Golden Path (MVP)
1. `/api/status` → Env OK, Graph Token OK, Azure Search erreichbar
2. `scripts/create_search_index.*` → Index `knowledge-chunks-v1` erstellen
3. `scripts/ingest_onedrive.*` → OneDrive Ordner rekursiv indexieren
4. `/api/chat` → Query embed → vector search → Antwort + Quellen
5. UI → Chat + Quellenpanel

## Hinweise
- Keine Secrets loggen.
- Kein Portal-“Click Ops” für Index/Ingester: alles per Script.
- Wenn etwas klemmt: zuerst `/api/status` grün machen.
