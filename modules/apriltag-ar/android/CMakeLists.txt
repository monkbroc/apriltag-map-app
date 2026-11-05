cmake_minimum_required(VERSION 3.22.1)
project(apriltag_ar C)

set(CPP_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../cpp)
file(GLOB APRILTAG_SOURCES ${CPP_DIR}/apriltag/*.c ${CPP_DIR}/apriltag/common/*.c)

add_library(apriltag_ar SHARED
  ${APRILTAG_SOURCES}
  ${CPP_DIR}/atag_bridge.c
  ${CMAKE_CURRENT_SOURCE_DIR}/src/main/cpp/atag_jni.c)

target_include_directories(apriltag_ar PRIVATE ${CPP_DIR} ${CPP_DIR}/apriltag)
target_link_libraries(apriltag_ar log m)
