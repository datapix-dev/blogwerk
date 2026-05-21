# Blogwerk — Deployment

## Setup

| | Details |
|---|---|
| **Domain** | https://blogwerk.astro-it.de |
| **Server** | 202.61.194.129 |
| **Projektpfad (Server)** | `/var/www/blogwerk` |
| **Repo** | `git@github.com:datapix-dev/blogwerk.git` |
| **Branch** | `main` |

## Lokaler Workflow

```bash
# 1. Entwickeln, dann committen
git add .
git commit -m "beschreibung"
git push origin main

# 2. Auf Server deployen
./deploy.sh
```

## deploy.sh

Das Script verbindet sich per SSH mit dem Server und führt `git pull` aus:

```bash
ssh root@202.61.194.129 "cd /var/www/blogwerk && git pull origin main"
```

## Server — manuell deployen

```bash
ssh root@202.61.194.129
cd /var/www/blogwerk
git pull origin main
```

## Server — Struktur

```
/var/www/blogwerk/          # Projektroot (git repo)
/etc/nginx/sites-enabled/blogwerk   # nginx Config
/var/log/nginx/blogwerk.access.log  # Access Log
/var/log/nginx/blogwerk.error.log   # Error Log
/etc/letsencrypt/live/blogwerk.astro-it.de/  # SSL Zertifikat (auto-renewal)
```

## SSL

Zertifikat via Let's Encrypt (Certbot), läuft bis **19. August 2026**, erneuert sich automatisch.

## nginx

Statische Dateien werden direkt aus `/var/www/blogwerk` ausgeliefert.  
Für einen App-Server (Node.js etc.) muss die nginx Config auf einen lokalen Port umgestellt werden:

```nginx
location / {
    proxy_pass http://127.0.0.1:PORT;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## SSH Keys

| Key | Verwendung |
|---|---|
| `~/.ssh/id_ed25519_github_personal` | Lokaler GitHub-Zugriff |
| Server `~/.ssh/id_ed25519` | Server → GitHub (Deploy Key, read-only) |
