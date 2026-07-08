#!/bin/bash
# Régénère les extraits du catalogue : WAV (synthèse) puis M4A (AAC 64 kbps).
# afconvert est fourni avec macOS. Usage : bash scripts/build-previews.sh
set -e
cd "$(dirname "$0")/.."
node scripts/generate-previews.mjs
cd assets/previews
for f in *.wav; do
  afconvert -f m4af -d aac -b 64000 "$f" "${f%.wav}.m4a"
  rm "$f"
done
echo "M4A prêts dans assets/previews/"
