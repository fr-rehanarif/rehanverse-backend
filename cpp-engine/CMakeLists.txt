cmake_minimum_required(VERSION 3.16)
project(RehanverseLogicEngine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(logic_engine main.cpp)

if(MSVC)
    target_compile_options(logic_engine PRIVATE /W4)
else()
    target_compile_options(logic_engine PRIVATE -Wall -Wextra -pedantic)
endif()
