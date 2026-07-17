# Deployment — zeugnisvalidator.it.bzz.ch

Statische React/Vite-App, ausgeliefert als Docker-Container hinter Apache-Reverse-Proxy.
Keine Secrets nötig — die App ist rein clientseitig.

## Architektur

```
Browser ──HTTPS──> Apache (it.bzz.ch, 94.176.239.144)
                     │  vhost zeugnisvalidator.it.bzz.ch (Let's Encrypt)
                     └─ ProxyPass ──> 127.0.0.1:8091 ──> Docker "zeugnisvalidator"
                                                          (nginx-unprivileged, non-root, Port 8080 intern)
```

- **Server:** it.bzz.ch (Ubuntu 20.04, Docker, Apache 2.4)
- **App-User:** `zeugnisvalidator` (Home `/opt/zeugnisvalidator`, Mitglied der `docker`-Gruppe, kein sudo)
- **Code auf Server:** `/opt/zeugnisvalidator/app`
- **Port:** 8091 (nur Loopback; 8090 = ferienkalender, 3001 = untis-mcp)
- **SSH:** Key `~/.ssh/maurizi.kevin` ist als `authorized_key` für `zeugnisvalidator` UND `root` hinterlegt.
  Normale Deploys laufen als `zeugnisvalidator` — root nur für Apache/Certbot/User-Verwaltung.

## Redeploy (Normalfall)

```bash
./deploy.sh
```

Macht: rsync der Quellen → `docker compose build` → `up -d` → Smoke-Test.
Der Build läuft im Container (multi-stage: node:22-alpine → nginxinc/nginx-unprivileged:alpine).

## Erst-Setup (bereits erledigt am 2026-07-17, für Reproduktion)

### 1. User anlegen (als root)

```bash
useradd -m -d /opt/zeugnisvalidator -s /bin/bash zeugnisvalidator
usermod -aG docker zeugnisvalidator
mkdir -p /opt/zeugnisvalidator/{.ssh,app}
# Public Key nach /opt/zeugnisvalidator/.ssh/authorized_keys
chmod 700 /opt/zeugnisvalidator/.ssh
chmod 600 /opt/zeugnisvalidator/.ssh/authorized_keys
chown -R zeugnisvalidator:zeugnisvalidator /opt/zeugnisvalidator
```

### 2. Container (als zeugnisvalidator)

```bash
# Quellen nach /opt/zeugnisvalidator/app (rsync, siehe deploy.sh)
cd /opt/zeugnisvalidator/app
docker compose build && docker compose up -d
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8091/   # -> 200
```

### 3. Apache-Vhosts (als root)

`/etc/apache2/sites-available/zeugnisvalidator.it.bzz.ch.conf` (Port 80):
nur ACME-Challenge-Alias auf `/var/www/certbot` + Redirect auf HTTPS
(Muster: ferienkalender.it.bzz.ch.conf).

`/etc/apache2/sites-available/zeugnisvalidator.it.bzz.ch-le-ssl.conf` (Port 443):
`ProxyPass / http://127.0.0.1:8091/` + Let's-Encrypt-Zertifikatspfade
(Muster: ferienkalender.it.bzz.ch-le-ssl.conf).

```bash
a2ensite zeugnisvalidator.it.bzz.ch.conf zeugnisvalidator.it.bzz.ch-le-ssl.conf
apache2ctl configtest && systemctl reload apache2
```

### 4. Zertifikat (als root)

`certbot --apache` ist auf dem Server defekt (Augeas-Fehler) — **webroot verwenden**:

```bash
certbot certonly --webroot -w /var/www/certbot -d zeugnisvalidator.it.bzz.ch \
  --key-type ecdsa --non-interactive --agree-tos
```

Renewal läuft über die bestehende certbot-Automatik (webroot, wie die anderen Certs).

## Sicherheits-Entscheide

- Eigener User pro App, kein sudo; Container-Prozess läuft non-root (nginx-unprivileged).
- Container bindet **nur 127.0.0.1** — von außen geht alles durch Apache/TLS.
- `no-new-privileges` im Compose-File.
- Keine Secrets in Repo oder Container (rein statische App); `.env*` in `.dockerignore`/`.gitignore`.
- DNS: `*.it.bzz.ch` zeigt bereits auf den Server — kein DNS-Eintrag nötig.

## Nützliche Kommandos

```bash
# Logs
ssh -i ~/.ssh/maurizi.kevin zeugnisvalidator@it.bzz.ch 'docker logs --tail 50 zeugnisvalidator'
# Container-Status
ssh -i ~/.ssh/maurizi.kevin zeugnisvalidator@it.bzz.ch 'docker ps --filter name=zeugnisvalidator'
# Apache-Logs (root)
ssh -i ~/.ssh/maurizi.kevin root@it.bzz.ch 'tail -20 /var/log/apache2/zeugnisvalidator_error.log'
```
