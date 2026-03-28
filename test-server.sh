#!/bin/bash

# Test Script - Startet Container OHNE Auto-Restart
# So können wir die Fehlermeldungen direkt sehen

echo "=========================================="
echo " Test-Start (ohne Auto-Restart)"
echo "=========================================="
echo ""
echo "Der Container wird im Vordergrund gestartet."
echo "Fehler werden direkt angezeigt."
echo "Zum Beenden: Ctrl+C"
echo ""
echo "Starte in 3 Sekunden..."
sleep 3

docker run --rm -it \
  -p 3005:3005 \
  -e MONGOHOST=207.180.224.98 \
  -e MONGOPORT=20019 \
  -e MONGOBASE=sensor_data \
  -e MONGOAUTH=true \
  -e MONGOUSRP=rexfueAdmin:D6grTasE56 \
  -e TZ=Europe/Berlin \
  -e DEBUG=true \
  docker.citysensor.de/geiger_web_26:latest
