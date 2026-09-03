cmake_minimum_required(VERSION 3.22.1)
project(whisper-engine)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# whisper.cpp — add as subdirectory if vendor exists, otherwise expect prebuilt
if(EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/../../../vendor/whisper.cpp/CMakeLists.txt)
  add_subdirectory(../../../vendor/whisper.cpp ${CMAKE_BINARY_DIR}/whisper.cpp)
else()
  find_package(whisper QUIET)
endif()

# Our wrapper
add_library(whisper-engine SHARED
  src/main/cpp/WhisperEngineJNI.cpp
  ../src/WhisperEngine.cpp
)

target_include_directories(whisper-engine PRIVATE
  ../src
  ../../../vendor/whisper.cpp/include
  ../../../vendor/whisper.cpp/ggml/include
)

find_library(log-lib log)

target_link_libraries(whisper-engine
  whisper
  ggml
  ggml-base
  ${log-lib}
  android
)

# Only arm64-v8a for POC (faster build, smaller AAB)
# Build via expo prebuild will set abiFilters via gradle
