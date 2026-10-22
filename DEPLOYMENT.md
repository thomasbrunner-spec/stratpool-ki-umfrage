# Deployment (Coolify auf Hostinger-VPS)

1. **DNS:** A-Record `umfrage.stratpool.pro` → IP des VPS (Subdomain vorher mit Thomas bestätigen).
2. **Coolify:** Neue Application → Public Repository `https://github.com/thomasbrunner-spec/stratpool-ki-umfrage`, Branch `main`,
   Build Pack **Dockerfile**, Port **3000**, Domain `https://umfrage.stratpool.pro`.
3. **Persistent Storage:** Volume auf `/app/data` (SQLite-Datei `umfrage.db`). Ohne Volume gehen Daten beim Redeploy verloren.
4. **Environment Variables:**

   | Variable | Pflicht | Hinweis |
   |---|---|---|
   | `JWT_SECRET` | ja | `openssl rand -hex 32`; Server startet ohne nicht |
   | `ADMIN_PASSWORD` | empfohlen | sonst First-Run-Setup unter `/admin` – direkt nach dem Deploy selbst ausführen |
   | `ANTHROPIC_API_KEY` | für KI-Zusammenfassung | ohne Key funktioniert alles außer der KI-Zusammenfassung |
   | `DATA_DIR` | nein | Default `/app/data` |

5. **Webhook/Auto-Deploy** aktivieren, danach: `git push origin main` → Coolify baut neu.
6. **Smoke-Test:** `https://umfrage.stratpool.pro/api/health` → `{"ok":true}`, `/admin` anmelden, Projekt anlegen.

Backup: JSON-Export je Projekt im Admin (Einstellungen & Export) oder Volume-Backup in Coolify.
Löschung nach Projektende: Admin → Einstellungen → „Projekt und alle Daten löschen“.
