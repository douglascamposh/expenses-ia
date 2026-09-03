# vendor / whisper.cpp

Este directorio debe contener `whisper.cpp` como submódulo:

```bash
git submodule add https://github.com/ggerganov/whisper.cpp vendor/whisper.cpp
git checkout v1.7.4   # versión pinneada para POC
```

Para POC sin NDK build, el wrapper funciona en modo mock (JS lanza `MODEL_NOT_FOUND` si el modelo no está copiado).
El build real requiere NDK 26 + CMake 3.22 y se activa vía `npx expo prebuild`.

Estructura esperada:
```
vendor/whisper.cpp/
  include/whisper.h
  src/whisper.cpp
  ggml/
```
