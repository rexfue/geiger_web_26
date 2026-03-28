#!/bin/bash

# Deploy Script für laufschrift
# Baut das Docker Image und lädt es zu docker.citysensor.de hoch

set -e


# Konfiguration
REGISTRY="docker.citysensor.de"
IMAGE_NAME="geiger_web_26"
TAG="${TAG:-$(date +%Y%m%d%H%M)}"  # default Datum
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"

# Build-Datum
BUILD_DATE=$(date +%d.%m.%Y)

echo "=========================================="
echo " Deploy Script"
echo "=========================================="
echo "Registry: ${REGISTRY}"
echo "Image: ${IMAGE_NAME}"
echo "Tag: ${TAG}"
echo "Build-Datum: ${BUILD_DATE}"
echo "=========================================="
echo ""

# 1. Login zur Registry (falls noch nicht eingeloggt)
echo ">>> Login zu ${REGISTRY}..."
docker login "${REGISTRY}"
echo ""

# 2. Multiplatform Builder einrichten (docker-container driver erforderlich)
echo ">>> Richte Multiplatform Builder ein..."
if ! docker buildx inspect multiplatform-builder &>/dev/null; then
  docker buildx create --name multiplatform-builder --driver docker-container --bootstrap
fi
docker buildx use multiplatform-builder
echo ""

# 3. Docker Image bauen und pushen (Multiplatform)
echo ">>> Baue Multiplatform Docker Image und pushe zu Registry..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg BUILD_DATE="${BUILD_DATE}" \
  -t "${FULL_IMAGE}" \
  --push \
  .

# 4. Keep :latest in sync for simple rollbacks and manual usage.
echo ">>> Tagge das image zusätzlich als :latest ..."
docker buildx imagetools create \
  -t "${REGISTRY}/${IMAGE_NAME}:latest" \
  "${FULL_IMAGE}"


echo ">>> Build und Push erfolgreich!"

echo ""
echo "=========================================="
echo "✓ Deploy erfolgreich abgeschlossen!"
echo "=========================================="
echo ""
echo "Auf dem Server ausführen:"
echo "  docker pull ${FULL_IMAGE}"
echo "  docker-compose -f docker-compose.prod.yml up -d"
echo ""
