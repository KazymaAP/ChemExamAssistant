# ChemExam Assistant

Телеграм WebApp для подготовки к экзамену по химии.

## Что сделано в этой итерации
- Проект разделён на модули: `index.html`, `styles.css`, `app.js`, `config.js`, `storageService.js`, `data/questions.js`.
- Банк вопросов вынесен из основного кода в отдельный файл `data/questions.js`.
- Введён конфиг `APP_CONFIG` и `STORAGE_KEYS`.
- Добавлен сервис хранения `storageService` (обёртка над `localStorage` с безопасным чтением/записью).
- Добавлены DevEx-файлы: ESLint, Prettier, CI workflow, smoke-test, CODEOWNERS, review checklist, CHANGELOG.
- Добавлен CSP и skip-link для доступности.

## Быстрый запуск
```bash
python3 -m http.server 4173
# открыть http://localhost:4173
```

## Разработка
```bash
npm ci
npm run lint
npm test
```

## Структура
- `index.html` — минимальная оболочка приложения.
- `styles.css` — стили.
- `app.js` — логика приложения и UI-рендеринг.
- `config.js` — конфигурация и константы.
- `storageService.js` — безопасная работа с хранилищем.
- `data/questions.js` — банк вопросов.
- `tests/smoke.mjs` — базовая smoke-проверка структуры.

## Следующие шаги
1. Декомпозиция `app.js` на `router`, `store`, `ui/components`, `features/*`.
2. Unit-тесты для поиска/прогресса/статистики.
3. E2E smoke (Playwright) для ключевых сценариев.
4. Lighthouse CI и performance budgets.
