#!/bin/sh
# Genera el APK del ambiente (dev|qa) y tipo (debug|release).
# - debug: rápido, cliente dev, requiere Metro (npx expo start).
# - release: autónomo (bundle embebido, sin Metro). Firmado con llave debug:
#   sirve para QA por sideload, no para Play Store.
# Uso: ./scripts/build-apk.sh qa release
set -eu

ENV="${1:-qa}"
TYPE="${2:-debug}"
if [ "$ENV" != "dev" ] && [ "$ENV" != "qa" ]; then
  echo "Uso: $0 <dev|qa> [debug|release]" >&2
  exit 1
fi
if [ "$TYPE" != "debug" ] && [ "$TYPE" != "release" ]; then
  echo "Uso: $0 <dev|qa> [debug|release]" >&2
  exit 1
fi

./scripts/use-firebase-env.sh "$ENV"

if [ "$ENV" = "qa" ]; then ENVFILE=".env.qa"; else ENVFILE=".env"; fi
if [ ! -f "$ENVFILE" ]; then
  echo "Falta $ENVFILE" >&2
  exit 1
fi

# SDK de Android (Android Studio lo instala ahí por defecto en macOS).
if [ -z "${ANDROID_HOME:-}" ]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi
if [ ! -d "$ANDROID_HOME/platform-tools" ]; then
  echo "No se encontró el SDK Android en $ANDROID_HOME" >&2
  exit 1
fi

# Las EXPO_PUBLIC_* se incrustan en el bundle JS durante el build.
if [ "$TYPE" = "release" ]; then
  TASK="assembleRelease"
  APK="android/app/build/outputs/apk/release/app-release.apk"
else
  TASK="assembleDebug"
  APK="android/app/build/outputs/apk/debug/app-debug.apk"
fi
dotenv -e "$ENVFILE" -- ./android/gradlew -p android "$TASK"

echo "APK listo: $APK"
