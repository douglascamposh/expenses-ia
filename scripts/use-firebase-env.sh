#!/bin/sh
# Activa los archivos Firebase del ambiente (dev|qa) copiándolos a la raíz,
# donde app.json los espera (googleServicesFile). Uso: ./scripts/use-firebase-env.sh qa
set -eu

ENV="${1:-}"
if [ "$ENV" != "dev" ] && [ "$ENV" != "qa" ]; then
  echo "Uso: $0 <dev|qa>" >&2
  exit 1
fi

SRC_IOS="config/firebase/$ENV/GoogleService-Info.plist"
SRC_ANDROID="config/firebase/$ENV/google-services.json"

for f in "$SRC_IOS" "$SRC_ANDROID"; do
  if [ ! -f "$f" ]; then
    echo "Falta $f: no se puede activar el ambiente $ENV" >&2
    exit 1
  fi
done

cp "$SRC_IOS" ./GoogleService-Info.plist
cp "$SRC_ANDROID" ./google-services.json

# Si ya existen carpetas nativas generadas (expo prebuild no se re-ejecuta
# solo y Xcode compilaría con el plist viejo): actualizarlas también para
# que el próximo build embeba el ambiente correcto sin --clean.
if [ -f "ios/Kybo/GoogleService-Info.plist" ]; then
  cp "$SRC_IOS" ios/Kybo/GoogleService-Info.plist
  echo "Actualizado también: ios/Kybo/GoogleService-Info.plist"
fi
if [ -f "android/app/google-services.json" ]; then
  cp "$SRC_ANDROID" android/app/google-services.json
  echo "Actualizado también: android/app/google-services.json"
fi
echo "Firebase activo: $ENV"
