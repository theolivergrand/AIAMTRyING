# Процесс создания ИИ-ассистента для игровой документации

**Примечание:** Этот документ является живым и должен постоянно обновляться по мере развития проекта.

---
### **Лог сессии: 08.06.2025**
---

1.  **Интеграция ИИ для предложения тегов**:
    *   Заменена функция-заглушка `suggestTagsMock` на полноценный вызов к API Gemini.
    *   В `main.js` добавлена функция `suggestTagsFromAPI`, которая формирует специальный промпт, передает его нейросети вместе со списком всех тегов и получает в ответ JSON-массив с наиболее релевантными тегами.
    *   В `preload.js` и `renderer.js` реализована передача вызова, что позволило связать фронтенд с новой бэкенд-логикой.

2.  **Реализация экспорта статистики для обучения**:
    *   Добавлена возможность экспортировать накопленную историю диалогов в формате JSON для последующего анализа и создания локальной модели предсказания тегов.
    *   В `index.html` и `style.css` добавлена кнопка "Экспорт статистики" в модальное окно настроек.
    *   В `main.js` создана функция `exportStatistics` и соответствующий IPC-обработчик, который форматирует данные (оставляя только пары "вопрос-теги") и открывает диалоговое окно для сохранения файла `training_data.json`.

---
### **Лог сессии: 07.06.2025**
---

Этот документ описывает шаги, предпринятые для создания прототипа десктопного приложения.

## 1. Цель

Создать интерактивное десктопное приложение, которое помогает пользователю составлять игровую документацию с помощью пошаговых вопросов от ИИ-ассистента.

## 2. Выбранные технологии

*   **Electron**: Фреймворк для создания десктопных приложений с использованием веб-технологий (HTML, CSS, JavaScript).
*   **@google/generative-ai**: Официальный SDK для работы с моделями Gemini.

## 3. Архитектура

После многочисленных проблем с аутентификацией и выбором правильного SDK, была выбрана самая надежная архитектура для Electron-приложений:

*   **Аутентификация:** Используется Application Default Credentials (ADC) через `gcloud auth application-default login`.
*   **SDK:** Используется пакет `@google-cloud/vertexai` и прямые вызовы REST API.
*   **Модель:** Используется `gemini-1.5-flash-preview-0514`.

### Получение API-ключа и активация API

1.  Перейдите на страницу [Google AI Studio](https://ai.google.dev/).
2.  Войдите в свой аккаунт Google.
3.  Перейдите в раздел "API Keys".
4.  Создайте новый API-ключ.
5.  Скопируйте ключ и вставьте его в приложение при запросе.

### Активация Generative Language API

Если вы получаете ошибку "Generative Language API has not been used in project ... before or it is disabled", выполните следующие шаги:

1. Перейдите по ссылке из сообщения об ошибке или откройте [Google Cloud Console](https://console.cloud.google.com/).
2. Выберите проект, указанный в сообщении об ошибке.
3. В меню слева выберите "APIs & Services" > "Library".
4. Найдите "Generative Language API" и нажмите на него.
5. Нажмите кнопку "Enable" для активации API.
6. Подождите несколько минут, пока изменения вступят в силу.
7. Перезапустите приложение и попробуйте снова.

## 4. Реализованные шаги

1.  **Инициализация проекта и базовый интерфейс**: Создана основа Electron-приложения с интерфейсом на две панели.
2.  **Прототипирование сбора данных**: В интерфейс добавлена кнопка "👍" для оценки качества вопросов.
3.  **Реализация интеграции с Gemini**:
    *   **`package.json`**: Установлены зависимости `@google-cloud/vertexai` и `@google-cloud/aiplatform`.
    *   **`main.js`**: Реализована аутентификация через Application Default Credentials и вызовы к Vertex AI REST API.
    *   **`renderer.js`**: Обновлена логика для работы с `global` регионом.
4.  **Внедрение системы тегов**:
    *   **`tags.js`**: Создан модуль с полным списком тегов для GDD.
    *   **`index.html`**: Добавлен контейнер для отображения UI тегов.
    *   **`style.css`**: Реализованы стили для поля ввода тегов, самих тегов и списка автодополнения.
    *   **`renderer.js`**: Добавлена основная логика:
        *   Отображение UI для тегов под вопросом.
        *   Автодополнение при вводе на основе списка из `tags.js`.
        *   Возможность добавлять (до 5) и удалять теги.
        *   Сохранение выбранных тегов в историю диалога и отображение их в итоговом документе.
        *   Добавлена заглушка (`suggestTagsMock`) для будущей интеграции с ИИ для автоматического предложения тегов.

## 5. Текущий результат

Создан работающий прототип, использующий Vertex AI. Приложение успешно подключается к Gemini, используя Application Default Credentials.

## 6. Альтернативные подходы

### 6.1. Использование Vertex AI для доступа к Gemini

Изначально мы пытались использовать Vertex AI для доступа к моделям Gemini, но столкнулись с рядом проблем:

1. **Проблема с аутентификацией**: Сначала мы пытались использовать файл учетных данных сервисного аккаунта (`credentials.json`), затем перешли на Application Default Credentials (ADC) через `gcloud auth application-default login`.

2. **Проблема с форматом запроса**: Когда аутентификация заработала, мы получили ошибку `INVALID_ARGUMENT: Request contains an invalid argument`.

3. **Архитектурное ограничение**: Когда мы попытались использовать модели Gemini через Vertex AI, получили ошибку `Gemini cannot be accessed through Vertex Predict/RawPredict API`.

Важно понимать, что для работы с Gemini через Vertex AI нельзя использовать стандартные методы `predict` или `rawPredict`. Вместо этого нужно использовать специальные методы `generateContent` и `streamGenerateContent`, которые доступны через пакет `@google-cloud/vertexai`.

Правильный код для работы с Gemini через Vertex AI выглядит примерно так:

```javascript
const {VertexAI} = require('@google-cloud/vertexai');

// Инициализация Vertex AI
const vertexAI = new VertexAI({
  project: 'your-project-id',
  location: 'us-central1',
});

// Доступ к модели Gemini
const generativeModel = vertexAI.preview.getGenerativeModel({
  model: 'gemini-1.5-flash-001',
  generationConfig: {
    temperature: 0.9,
    maxOutputTokens: 256,
  },
});

// Использование модели
async function generateContent(prompt) {
  const result = await generativeModel.generateContent({
    contents: [{role: 'user', parts: [{text: prompt}]}],
  });
  
  return result.response.text();
}
```

### 6.2. Использование Claude через Vertex AI

Если вы хотите использовать модели Claude от Anthropic через Vertex AI, вам потребуется использовать `@google-cloud/aiplatform` и стандартные методы `predict`:

```javascript
const { PredictionServiceClient } = require('@google-cloud/aiplatform');

// Инициализация клиента
const client = new PredictionServiceClient({
  apiEndpoint: 'us-central1-aiplatform.googleapis.com'
});

// Путь к модели Claude
const modelName = 'projects/YOUR_PROJECT/locations/us-central1/publishers/anthropic/models/claude-3-sonnet@20240229';

// Функция для отправки запроса
async function generateWithClaude(prompt) {
  const request = {
    endpoint: modelName,
    instances: [
      {
        prompt: `\n\nHuman: ${prompt}\n\nAssistant:`
      }
    ],
    parameters: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      topK: 40,
      topP: 0.95,
    },
  };
  
  const [response] = await client.predict(request);
  return response.predictions[0].content;
}
```

## 7. Дальнейшие шаги

*   **Создание локальной модели предсказания тегов**: Использовать экспортированные данные (`training_data.json`) для создания (с помощью ИИ) локального скрипта, который сможет предлагать теги без обращения к API.
*   **Улучшение промптов**: Продолжать эксперименты с системными инструкциями в `main.js` для получения более качественных вопросов и более точных предложений по тегам.
*   **Сохранение и загрузка сессии**: Реализовать полноценное сохранение и загрузку всей сессии работы (истории диалога) в один файл.
*   **Настройка удаленного хранилища**: Реализовать автоматическую отправку данных для обучения в облачное хранилище (например, Google Cloud Storage) после каждой сессии.
