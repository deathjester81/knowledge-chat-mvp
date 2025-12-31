# docs/setup_onedrive_graph.md

# Setup: OneDrive Cloud Zugriff via Microsoft Graph API

## Ziel (MVP)
- Nur dein OneDrive Account
- Cloud-only (kein Sync)
- Zugriff per App Registration (Azure Entra ID) + Client Secret
- MVP nutzt Folder Path aus ENV: ONEDRIVE_FOLDER_PATH

## 1) App Registration
Azure Portal → Entra ID → App registrations → New registration

- Name: `knowledge-chat-mvp`
- Supported account types:
  - MVP: Single tenant (nur dein Tenant)
  - Post-MVP: Multi-tenant (für Kunden) = später

Nach Erstellung notieren:
- MS_TENANT_ID (Directory/tenant ID)
- MS_CLIENT_ID (Application/client ID)

## 2) Client Secret
App → Certificates & secrets → New client secret
- Notiere MS_CLIENT_SECRET (nur einmal sichtbar)

## 3) API Permissions (Graph)
App → API permissions → Add permission → Microsoft Graph
- Delegated permissions (für User-Context) ODER Application permissions (service-to-service)

MVP Empfehlung:
- Application permissions, wenn du serverseitig ohne User-interaction laufen willst (aber Admin Consent nötig)
- Delegated permissions, wenn du User Login Flow nutzt

Für MVP pragmatisch:
- Delegated: User.Read, Files.Read.All
(Später: Sites.Read.All je nach Zugriffspfad)

Dann:
- Grant admin consent (falls verfügbar)

## 4) Auth Flow (MVP pragmatisch)
Für lokale Entwicklung:
- Device Code Flow ist schnell
Für Deploy:
- Authorization Code Flow mit Redirect URL (Vercel)

Redirect URLs:
- Lokal: http://localhost:3000/api/auth/callback
- Vercel: https://<project>.vercel.app/api/auth/callback

## 5) Folder Auswahl (MVP)
Wir nutzen ONEDRIVE_FOLDER_PATH:
Beispiele:
- /RCC_Wissen
- /RCC_Wissen/Prozesstheorie
- /RCC_Wissen/KI

Graph API Konzepte:
- List children eines Ordners
- Download file content
- Get webUrl für Quellenlink

## 6) Bilder (MVP)
- MVP: Index nur Metadaten + Dateiname + webUrl
- Post-MVP: OCR Pipeline (Azure Vision) → Text als chunk indexieren
