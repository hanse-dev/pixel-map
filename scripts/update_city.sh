#!/bin/bash
# Refresh everything that depends on a city's map bundle, then build the site.
# Run after copying a new bundle to cities/<city>/:  scripts/update_city.sh luebeck
set -eo pipefail
cd "$(dirname "$0")/.."
CITY=${1:?usage: update_city.sh CITY}
PY=${PYTHON:-python3}
echo "== Wikipedia, Wikidata, Commons für Gebäude im Paket"
$PY scripts/fetch_info.py cities/$CITY --lang de 2>/dev/null | tail -1
if [ -f config/stolpersteine.$CITY.txt ]; then
  echo "== Stolpersteine"
  $PY scripts/fetch_stolpersteine.py $CITY "$(cat config/stolpersteine.$CITY.txt)"
fi
echo "== Build"
$PY scripts/build.py
