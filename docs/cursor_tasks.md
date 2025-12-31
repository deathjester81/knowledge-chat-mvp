# Cursor Tasks — Knowledge Chat MVP (step-by-step)

## Regel
Nur ein Task zur Zeit. Nach jedem Task ein “Golden Path” Check.

---

## Task 0 — Windows/PowerShell Prereqs fixen
Ziel: npm/npx laufen lassen, ohne ExecutionPolicy-Block.

Akzeptanz:
- `node -v` und `npm -v` funktionieren
- `npx --version` funktioniert
- `npx create-next-app@latest --help` funktioniert

---

## Task 1 — Next.js App bootstrap
Ort: `apps/web/`

Akzeptanz:
- `npm run dev` startet
- Default Next.js Seite lädt

---

## Task 2 — Config loader + env sanity checks
Implementiere in `apps/web`:
- `src/lib/config.ts` liest required env vars
- wirft klare Error Messages (ohne secrets)

Akzeptanz:
- App startet und zeigt bei fehlenden env vars klare Fehlermeldung
- `.env.local` wird NICHT committed

---

## Task 3 — /api/status
Implementiere `src/app/api/status/route.ts`:
- returns JSON:
  - ok: boolean
  - graph: token fetch ok?
  - search: endpoint reachable?
  - timestamp

Akzeptanz:
- GET `/api/status` gibt 200 zurück und zeigt sinnvolle Checks

---

## Task 4 — Azure AI Search index script
In `/scripts`:
- `create_search_index` Script, das `knowledge-chunks-v1` anlegt
- muss vectorSearch profiles + algorithm (HNSW, cosine) sauber definieren
- dims = 3072 (embedding large)

Akzeptanz:
- Script läuft ohne Fehler und Index existiert

---

## Task 5 — Graph OneDrive listing (MVP)
In `/scripts` oder `apps/web/src/lib/msgraph.ts`:
- client_credentials token fetch
- list children for `ONEDRIVE_FOLDER_PATH`
- recursion optional (erst 1 Ebene ok)

Akzeptanz:
- Script/endpoint listet Dateien & Ordner im Zielpfad

---

## Task 6 — Ingestion MVP (nur .txt/.md)
Pipeline:
- download file content
- extract text (plain)
- chunk (z.B. 800–1200 tokens, overlap)
- embed via OpenAI
- upsert to Azure Search

Akzeptanz:
- 1 Testfile wird in Azure Search als mehrere chunks sichtbar

---

## Task 7 — /api/chat + UI
- Query embed
- Azure Search vector query topK
- prompt with citations
- UI: chat + sources list

Akzeptanz:
- Frage stellt → Antwort kommt → Quellenlinks sichtbar

---

## Task 8 — Hardening & productization prep
- dedupe via content_hash
- incremental updates via updated_at
- basic error handling + logging
- prepare customer checklist skeleton

Akzeptanz:
- Ingestion kann erneut laufen ohne alles zu duplizieren
