# ASTRONEX — музей брошенных космических аппаратов

```
astronex/
├── frontend/        HTML / CSS / JS (css/theme.css — цвета и шрифты в одном месте)
│   └── models/      сюда кладутся .glb (имена — в data/exhibits.json, поле "model")
├── backend/         Flask API (пока пусто)
└── data/exhibits.json   данные экспонатов
```

## Запуск
- **Просто посмотреть:** открыть `frontend/index.html` двойным кликом — сайт работает.
- **С 3D-моделями (.glb):** нужен локальный сервер, иначе браузер не даст прочитать .glb.
  Двойной клик по `run.command` (macOS/Linux) или `run.bat` (Windows),
  либо из папки astronex/: `python3 -m http.server 8000` → http://localhost:8000/frontend/index.html

## Interactive Explore (кнопка перед музеем)
Сценарий: кнопка → страница уезжает в стороны и затемняется → `frontend/video/intro.mp4` → затемнение →
Луна и Марс → выбор планеты (она приближается) → метки заброшенных объектов → панель с информацией и 3D-объектом.
- **Видео:** положить `frontend/video/intro.mp4` (сейчас там заглушка 4 сек). Кнопка Skip и клавиша Esc пропускают видео.
- **Метки:** поле `markers` у каждого экспоната в `data/exhibits.json` (planet: moon|mars, lat, lon в градусах, -180..180).
- **Планеты и объекты сейчас абстрактные.** Когда появятся настоящие:
  - объект: положить `.glb` в `frontend/models/` с именем из поля `model` — панель сама покажет его вместо заглушки (нужен локальный сервер: run.command / run.bat);
  - планета: положить `frontend/textures/moon.jpg` и `mars.jpg` (равнопромежуточная проекция, долгота -180..180).
- **Код 3D** лежит в `frontend/src/explore/`. Сайту нужен только готовый `frontend/js/explore.bundle.js`.
  Если правите код: `cd tools && npm install && npm run build`.

## 3D-модели
Для страниц экспонатов (`exhibit.html`) и панели Interactive Explore:
Пока файла нет, на странице виден слот «3D MODEL SLOT» с именем нужного файла.
Как только .glb появляется в `frontend/models/`, сайт сам подхватывает его.
Имена файлов: apollo-lm, lrv, surveyor3, mer, ingenuity, sojourner, viking, phoenix, insight, pioneer, dawn (.glb).

## Добавить экспонат
1. Добавить объект в `data/exhibits.json` → массив `exhibits` (hall: moon | mars | deep).
2. Выполнить `python3 data/build.py` — он обновит `data/exhibits.js` (его читает сайт; Flask-API может отдавать JSON напрямую).
