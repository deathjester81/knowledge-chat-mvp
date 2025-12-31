# docs/setup_azure.md

# Setup: Azure (Free Trial) + Azure AI Search

## Ziel
- Azure AI Search Service erstellen
- API Key + Endpoint sichern
- Index-Name definieren
- (Optional später) Azure Function für Ingestion

## 1) Azure Free Trial starten (wenn ready)
- azure.com/free
- Subscription aktivieren (Free Trial / Pay-as-you-go)

## 2) Resource Group
- Create Resource Group:
  - Name: `knowledge-chat-rg`
  - Region: Wähle eine Region nahe bei dir (EU/CH-nah), z.B. West Europe

## 3) Azure AI Search erstellen
- Create Resource: “Azure AI Search” (manchmal “Search”)
- Name: `kc-search-<unique>`
- Resource Group: `knowledge-chat-rg`
- Region: wie oben
- Pricing Tier: klein starten (MVP Tier)
  - Ziel: minimaler Fixpreis für MVP
  - Später skalierst du über Replicas/Partitions/tiers

## 4) Endpoint & Key holen
- Öffne Search Service → Keys
- Kopiere:
  - AZURE_SEARCH_ENDPOINT (z.B. https://kc-search-xxx.search.windows.net)
  - AZURE_SEARCH_API_KEY (Admin key)
- Lege Index Name fest:
  - `knowledge-chunks-v1`

## 5) Index Strategie (wichtig fürs Produktisieren)
Wir machen einen Index pro “Tenant” später möglich.
Für MVP: 1 Index `knowledge-chunks-v1`.
Später: `tenant_<id>_chunks_v1`

Index Felder (Concept):
- id (string, key)
- tenant_id (string, filterable)
- source (OneDrive)
- file_id, file_path, file_name
- file_web_url (clickable)
- content (text)
- content_vector (vector)
- language (de/en)
- chunk_id, chunk_offset
- created_at, updated_at
- content_hash (dedupe)
- mime_type

## 6) Kostenkontrolle (MVP)
- Starte mit kleiner Tier
- Nutze eine eingeschränkte Dokumentmenge (1–2 Ordner)
- Chunking konservativ (nicht zu klein, sonst explodiert Index)
- Messe Index size + chunk count

## 7) Optional: Azure Functions (Post-MVP)
Wenn Ingestion nicht mehr lokal laufen soll:
- Azure Functions App erstellen
- Timer Trigger für tägliches Re-Indexing
- Secrets in Azure Key Vault speichern
- Function ruft dieselbe Ingestion Logik auf
