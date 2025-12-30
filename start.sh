#!/bin/bash

# frontend와 backend 동시에 실행 가능
# backend 실행
cd backend
if ! command -v node &> /dev/null
then
    echo "Node.js가 설치되어 있지 않습니다. 설치해주세요."
    exit 1
fi

# 백엔드 서버 실행
node server.js
