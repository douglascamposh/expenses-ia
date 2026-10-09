#!/bin/sh
# Genera el Android App Bundle (AAB) firmado para Play Store.
# Requiere upload keystore en ~/.gradle/gradle.properties (ver README interno).
# Uso: ./scripts/build-aab.sh qa   → android/app/build/outputs/bundle/release/app-release.aab
set -eu

ENV="${1:-qa}"
if [ "$ENV" != "dev" ] && [ "$ENV" != "qa" ]; then
  echo "Uso: $0 <dev|qa>" >&2
  exit 1
fi

./scripts/use-firebase-env.sh "$ENV"

if [ "$ENV" = "qa" ]; then ENVFILE=".env.qa"; else ENVFILE=".env"; fi
if [ ! -f "$ENVFILE" ]; then
  echo "Falta $ENVFILE" >&2
  exit 1
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi

# El AAB para Play debe ir firmado con la upload key, nunca con debug.
for prop in MYAPP_UPLOAD_STORE_FILE MYAPP_UPLOAD_KEY_ALIAS MYAPP_UPLOAD_STORE_PASSWORD MYAPP_UPLOAD_KEY_PASSWORD; do
  if ! grep -q "^${prop}=" "$HOME/.gradle/gradle.properties" 2>/dev/null; then
    echo "Falta $prop en ~/.gradle/gradle.properties: el AAB saldría firmado con debug y Play lo rechaza." >&2
    exit 1
  fi
done
if ! grep -q "MYAPP_UPLOAD_STORE_FILE" android/app/build.gradle 2>/dev/null; then
  echo "android/app/build.gradle no tiene la firma upload (se pierde con prebuild --clean): re-aplicarla antes de compilar." >&2
  exit 1
fi

dotenv -e "$ENVFILE" -- ./android/gradlew -p android bundleRelease

echo "AAB listo: android/app/build/outputs/bundle/release/app-release.aab"
