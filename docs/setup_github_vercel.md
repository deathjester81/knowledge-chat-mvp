# docs/setup_github_vercel.md

# Setup: GitHub + Vercel (Frontend + API)

## 1) GitHub Repo
1. Erstelle neues Repo: `knowledge-chat-mvp`
2. Lokal (Cursor Terminal):
   - git init
   - git add .
   - git commit -m "init"
3. Repo verbinden:
   - git remote add origin <repo-url>
   - git push -u origin main

## 2) Vercel Projekt
1. Vercel → New Project → Import Git Repository
2. Wähle `knowledge-chat-mvp`
3. Root Directory:
   - Wenn dein Next.js in `apps/web` liegt: setze Root Directory auf `apps/web`
   - Wenn es im Repo root liegt: Root Directory leer lassen

## 3) Environment Variables (Vercel)
Project Settings → Environment Variables:

OPENAI_API_KEY
OPENAI_CHAT_MODEL
OPENAI_EMBED_MODEL
AZURE_SEARCH_ENDPOINT
AZURE_SEARCH_API_KEY
AZURE_SEARCH_INDEX_NAME
MS_TENANT_ID
MS_CLIENT_ID
MS_CLIENT_SECRET
ONEDRIVE_FOLDER_PATH

Hinweis:
- Keine Secrets ins Repo committen.
- Lokal nutzt du `.env.local` (Next.js convention).

## 4) Deploy Flow
- Jeder Push auf `main` deployt automatisch.
- Preview Deployments für PRs sind automatisch (sehr hilfreich fürs UI Finetuning).

## 5) Domain
- Für MVP reicht: `https://<project>.vercel.app`
- Eigene Domain optional später.

## 6) Empfehlung für Ingestion
Vercel API Routes können für Ingestion zu langsam/limitiert sein.
MVP: Ingestion lokal triggern über /api/ingest.
Post-MVP: Ingestion als Azure Function/Worker (sauber & zuverlässig).
