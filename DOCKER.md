# Docker Deployment Anleitung

## Übersicht

Es gibt zwei Docker Compose Konfigurationen:
- `docker-compose.local.yml` - Für lokale Entwicklung (mit externem MongoDB)
- `docker-compose.prod.yml` - Für Server/Produktion (mit externem MongoDB)

Beide Konfigurationen verwenden einen **externen MongoDB Server** und starten keinen eigenen MongoDB Container.

## Lokale Entwicklung

### Voraussetzungen
- Docker und Docker Compose installiert
- Zugriff auf MongoDB Server (lokal oder remote)

### Konfiguration

Die lokale Entwicklung verwendet einen **externen MongoDB Server**. Konfiguriere die Verbindung:

**Option 1: .env.local Datei verwenden (empfohlen)**
```bash
cp .env.local .env.local.custom
nano .env.local.custom  # Anpassen
docker compose -f docker-compose.local.yml --env-file .env.local.custom up
```

**Option 2: Direkt in docker-compose.local.yml anpassen**
Ändere die Environment-Variablen im File entsprechend deinem Setup.

**MongoDB auf Host-Maschine:**
```yaml
- MONGOHOST=host.docker.internal  # für Mac/Windows
- MONGOHOST=172.17.0.1            # für Linux
```

**MongoDB auf anderem Server:**
```yaml
- MONGOHOST=mongodb-dev.example.com
- MONGOPORT=27017
- MONGOAUTH=true
- MONGOUSRP=user:password
```

### Verwendung

```bash
# Starten (baut beim ersten Mal automatisch das Image)
docker compose -f docker-compose.local.yml up

# Mit .env.local
docker compose -f docker-compose.local.yml --env-file .env.local up

# Im Hintergrund starten
docker compose -f docker-compose.local.yml up -d

# Logs anzeigen
docker compose -f docker-compose.local.yml logs -f

# Stoppen
docker compose -f docker-compose.local.yml down
```

### Zugriff
- Anwendung: http://localhost:3005/fs/

### Hinweis: network_mode host

Wenn MongoDB auf `localhost` der Host-Maschine läuft, kannst du in `docker-compose.local.yml` auskommentieren:
```yaml
network_mode: host
```
Dann ist die App direkt auf dem Host-Netzwerk und kann `localhost:27017` erreichen.

## Server/Produktion

### Voraussetzungen
- Docker und Docker Compose installiert
- Zugriff auf externen MongoDB Server
- Image auf docker.citysensor.de Registry

### Erste Einrichtung

1. **Environment-Datei erstellen:**
   ```bash
   cp .env.example .env
   nano .env  # oder ein anderer Editor
   ```

2. **Werte in .env anpassen:**
   ```env
   MONGOHOST=ihre-mongodb-server.example.com
   MONGOPORT=27017
   MONGOBASE=allsensors
   MONGOAUTH=true
   MONGOUSRP=admin:securepassword
   ```

3. **Zur Registry einloggen:**
   ```bash
   docker login docker.citysensor.de
   ```

4. **Image pullen:**
   ```bash
   docker compose -f docker-compose.prod.yml pull
   ```

### Deployment

```bash
# Starten
docker compose -f docker-compose.prod.yml up -d

# Status prüfen
docker compose -f docker-compose.prod.yml ps

# Logs anzeigen
docker compose -f docker-compose.prod.yml logs -f geiger-web

# Neustarten
docker compose -f docker-compose.prod.yml restart

# Stoppen
docker compose -f docker-compose.prod.yml down
```

### Update auf neue Version

```bash
# Neues Image pullen
docker compose -f docker-compose.prod.yml pull

# Container neu starten mit neuem Image
docker compose -f docker-compose.prod.yml up -d

# Alte Images aufräumen
docker image prune -f
```

### Monitoring

```bash
# Live Logs
docker compose -f docker-compose.prod.yml logs -f

# Ressourcen-Nutzung
docker stats geiger_web_prod

# Health Check Status
docker inspect --format='{{.State.Health.Status}}' geiger_web_prod
```

## Build & Push (für Entwickler)

Das deploy.sh Script übernimmt Build und Push automatisch:

```bash
# Mit automatischem Datums-Tag
./deploy.sh

# Mit spezifischem Tag
TAG=v2.9.6 ./deploy.sh
```

Oder manuell:

```bash
# Image bauen
docker build -t docker.citysensor.de/geiger_web_26:latest .

# Image zu Registry pushen
docker push docker.citysensor.de/geiger_web_26:latest
```

## Troubleshooting

### Container startet nicht
```bash
# Detaillierte Logs
docker compose -f docker-compose.prod.yml logs geiger-web

# Container Shell betreten
docker exec -it geiger_web_prod sh
```

### MongoDB Verbindungsprobleme
- Prüfe MONGOHOST und MONGOPORT in .env oder .env.local
- Prüfe Netzwerk-Konnektivität: `docker exec -it geiger_web_prod ping mongodb`
- Prüfe MongoDB Credentials
- **Lokal:** Wenn MongoDB auf localhost läuft, verwende `MONGOHOST=host.docker.internal` (Mac/Windows) oder `MONGOHOST=172.17.0.1` (Linux)
- **Lokal:** Alternativ aktiviere `network_mode: host` in docker-compose.local.yml

### Port bereits belegt
Ändere EXTERNAL_PORT in .env auf einen anderen Port:
```env
EXTERNAL_PORT=3006
```

### Logs zu groß
Die Produktionskonfiguration limitiert Logs auf 3 × 10MB. Bei Bedarf anpassen in docker-compose.prod.yml:
```yaml
logging:
  options:
    max-size: "10m"
    max-file: "3"
```

## Sicherheitshinweise

1. **.env Datei NIEMALS ins Git committen!**
   - Ist bereits in .gitignore
   - Enthält sensible Zugangsdaten

2. **Starke Passwörter verwenden**
   - Besonders für Produktions-MongoDB

3. **Firewall konfigurieren**
   - Nur notwendige Ports öffnen
   - MongoDB Port (27017) nicht öffentlich zugänglich machen

4. **Regelmäßige Updates**
   - Base Image (node:alpine) aktuell halten
   - Dependencies in package.json aktualisieren

## Systemanforderungen

### Lokal
- Minimum: 2 GB RAM, 2 CPU Cores
- Docker >= 20.10
- Docker Compose >= 2.0 (oder Docker mit integriertem compose plugin)

### Server
- Empfohlen: 2 GB RAM, 2 CPU Cores
- Anpassbar in docker-compose.prod.yml unter `deploy.resources`
