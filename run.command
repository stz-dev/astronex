#!/bin/bash
# macOS/Linux: двойной клик (или ./run.command). Запускает локальный сервер и открывает сайт.
cd "$(dirname "$0")"
( sleep 1; (open "http://localhost:8000/frontend/index.html" || xdg-open "http://localhost:8000/frontend/index.html") >/dev/null 2>&1 ) &
python3 -m http.server 8000
