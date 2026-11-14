@echo off
rem Windows: двойной клик. Запускает локальный сервер и открывает сайт.
cd /d "%~dp0"
start "" "http://localhost:8000/frontend/index.html"
python -m http.server 8000
