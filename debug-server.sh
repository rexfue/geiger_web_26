#!/bin/bash

# Debug Script für Geiger Web Server
# Diagnostiziert Probleme mit dem Container

set -e

CONTAINER_NAME="geiger_web_prod"
VOLUME_NAME="geiger_logs_prod"

echo "=========================================="
echo " Geiger Web Server Debug"
echo "=========================================="
echo ""

# 1. Container Status prüfen
echo ">>> Container Status:"
docker ps -a --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# 2. Container stoppen (falls läuft)
echo ">>> Stoppe Container..."
docker stop ${CONTAINER_NAME} 2>/dev/null || echo "Container war bereits gestoppt"
echo ""

# 3. Logs aus Volume extrahieren
echo ">>> Extrahiere Logs aus Volume..."
docker run --rm \
  -v ${VOLUME_NAME}:/logs \
  alpine:latest \
  cat /logs/geiger-web.log 2>/dev/null | tail -100 > /tmp/geiger-debug.log || echo "Keine Logs gefunden"

if [ -s /tmp/geiger-debug.log ]; then
  echo ">>> Letzte 100 Log-Zeilen:"
  cat /tmp/geiger-debug.log
  echo ""
else
  echo "Keine Logs im Volume gefunden"
  echo ""
fi

# 4. Container Umgebungsvariablen prüfen
echo ">>> Container Environment (ohne Passwörter):"
docker inspect ${CONTAINER_NAME} 2>/dev/null | jq -r '.[0].Config.Env[]' | grep -E '^MONGO|^DEBUG|^SERVERPORT|^TZ' || echo "Container nicht gefunden"
echo ""

# 5. MongoDB Verbindung testen
echo ">>> Teste MongoDB Verbindung:"
MONGOHOST=$(docker inspect ${CONTAINER_NAME} 2>/dev/null | jq -r '.[0].Config.Env[]' | grep '^MONGOHOST=' | cut -d'=' -f2)
MONGOPORT=$(docker inspect ${CONTAINER_NAME} 2>/dev/null | jq -r '.[0].Config.Env[]' | grep '^MONGOPORT=' | cut -d'=' -f2)

if [ ! -z "$MONGOHOST" ] && [ ! -z "$MONGOPORT" ]; then
  echo "Teste Verbindung zu ${MONGOHOST}:${MONGOPORT}..."
  timeout 5 bash -c "cat < /dev/null > /dev/tcp/${MONGOHOST}/${MONGOPORT}" 2>/dev/null && \
    echo "✓ MongoDB Port ist erreichbar" || \
    echo "✗ Fehler: MongoDB Port ${MONGOHOST}:${MONGOPORT} ist NICHT erreichbar!"
else
  echo "✗ MONGOHOST oder MONGOPORT nicht gesetzt"
fi
echo ""

# 6. Image Info
echo ">>> Image Info:"
docker inspect ${CONTAINER_NAME} 2>/dev/null | jq -r '.[0].Config.Image' || echo "Container nicht gefunden"
echo ""

# 7. Restart Count
echo ">>> Restart Count:"
docker inspect ${CONTAINER_NAME} 2>/dev/null | jq -r '.[0].RestartCount' || echo "Container nicht gefunden"
echo ""

echo "=========================================="
echo "Debug-Informationen gesammelt!"
echo "=========================================="
echo ""
echo "Vollständige Logs gespeichert in: /tmp/geiger-debug.log"
echo ""
echo "Nächste Schritte:"
echo ""
echo "1. Container OHNE Auto-Restart starten (um Logs zu sehen):"
echo "   docker run --rm -it \\"
echo "     -p 3005:3005 \\"
echo "     -e MONGOHOST=${MONGOHOST} \\"
echo "     -e MONGOPORT=${MONGOPORT} \\"
echo "     -e MONGOBASE=sensor_data \\"
echo "     -e MONGOAUTH=true \\"
echo "     -e MONGOUSRP=user:password \\"
echo "     -e TZ=Europe/Berlin \\"
echo "     docker.citysensor.de/geiger_web_26:latest"
echo ""
echo "2. Original Container wieder starten:"
echo "   docker start ${CONTAINER_NAME}"
echo ""
