const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');

// --- ФУНКЦИИ API ---

/**
 * Инициализирует клиент для работы с Vertex AI.
 * @param {object} settings - Настройки, включая projectId, region и keyFilePath.
 * @returns {VertexAI}
 */
function getVertexAIClient(settings) {
    if (!settings.projectId || !settings.region) {
        throw new Error("Project ID и Region должны быть указаны в настройках.");
    }
    // Используем регион из настроек
    return new VertexAI({
        project: settings.projectId,
        location: settings.region,
        keyFilename: settings.keyFilePath // This will be empty, so ADC is used.
    });
}

/**
 * Генерирует следующий вопрос с помощью модели Gemini.
 * @param {Array} history - История диалога.
 * @param {object} settings - Настройки генерации.
 */
async function generateQuestionFromAPI(history, settings) {
    console.log("DEBUG: Попытка генерации вопроса с настройками:", settings);

    if (!settings.model) {
        return "Модель не выбрана в настройках.";
    }
    if (!settings.projectId) {
        return "Project ID не указан в настройках.";
    }

    try {
        const vertexAI = getVertexAIClient(settings);
        const generativeModel = vertexAI.getGenerativeModel({ model: settings.model });

        console.log(`DEBUG: Генерация вопроса с использованием модели ${settings.model} в регионе ${settings.region}...`);

        const chatHistory = history.map(turn => ({
            role: turn.answer ? "user" : "model",
            parts: [{ text: turn.answer || turn.question }]
        })).slice(0, -1);

        const lastUserAnswer = history.length > 0 && history[history.length - 1].answer 
            ? history[history.length - 1].answer 
            : "Я хочу создать игру. Помоги мне составить документ.";

        const prompt = `Ты - ассистент по игровому дизайну. Твоя задача - помочь пользователю создать документ по дизайну игры, задавая логичные и краткие вопросы.
    
        Вот предыдущий ответ пользователя: "${lastUserAnswer}"
        
        Задай ОДИН следующий логичный вопрос, который поможет пользователю лучше описать концепцию игры. Не повторяй вопросы, которые уже были заданы. Не добавляй никаких дополнительных фраз, только сам вопрос.`;

        const chat = generativeModel.startChat({
            history: chatHistory,
            generationConfig: {
                temperature: settings.temperature || 0.9,
                maxOutputTokens: settings.maxOutputTokens || 1024,
                topP: settings.topP || 1,
                topK: settings.topK || 1
            }
        });

        const result = await chat.sendMessage(prompt);
        const response = result.response;
        
        console.log("DEBUG: Ответ получен:", JSON.stringify(response));
        
        if (response.candidates && response.candidates.length > 0 && response.candidates[0].content.parts.length > 0) {
            return response.candidates[0].content.parts[0].text;
        } else {
            console.error("DEBUG: Получен пустой или некорректный ответ от API:", response);
            return "API вернул пустой ответ. Проверьте лог ошибок.";
        }

    } catch (error) {
        console.error("Ошибка при вызове Vertex AI API:", error);
        return `Произошла ошибка API: ${error.message}`;
    }
}

/**
 * Генерирует итоговый документ на основе истории диалога.
 * @param {Array} history - История диалога.
 * @param {object} settings - Настройки генерации.
 */
async function generateDocumentFromAPI(history, settings) {
    console.log("DEBUG: Попытка генерации документа с настройками:", settings);

    if (!settings.model || !settings.projectId) {
        return "Модель или Project ID не указаны в настройках.";
    }

    try {
        const vertexAI = getVertexAIClient(settings);
        const generativeModel = vertexAI.getGenerativeModel({ model: settings.model });

        const formattedHistory = history
            .filter(turn => turn.answer) // Убираем последний вопрос без ответа
            .map(turn => `### ${turn.question}\n\n${turn.answer}\n\n**Теги: ${turn.tags.join(', ')}**`)
            .join('\n\n---\n\n');

        const prompt = `Ты — опытный сценарист и геймдизайнер. Твоя задача — взять серию вопросов, ответов и тегов и превратить их в связный, хорошо структурированный и отформатированный в Markdown документ (GDD - Game Design Document).

        **Инструкции:**
        1.  **Проанализируй весь диалог:** Внимательно изучи всю историю переписки, чтобы понять общую концепцию игры.
        2.  **Создай логичную структуру:** Не просто перечисляй ответы. Сгруппируй информацию по смысловым блокам (например, "Концепция", "Игровой процесс", "Персонажи", "Мир игры" и т.д.), используя теги как подсказки.
        3.  **Используй Markdown:** Отформатируй документ с помощью заголовков (#, ##, ###), списков (* или -) и выделения текста (**жирный**, *курсив*).
        4.  **Напиши связный текст:** Преврати сухие ответы в полноценные разделы документа. Добавь связующие фразы, чтобы текст читался легко и приятно.
        5.  **Не выдумывай лишнего:** Основывайся только на информации из диалога.

        Вот история диалога для обработки:
        ---
        ${formattedHistory}
        ---

        Создай из этого полноценный GDD в формате Markdown.`;

        const result = await generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: settings.temperature || 0.7, // Температуру можно сделать чуть ниже для более предсказуемого результата
                maxOutputTokens: settings.maxOutputTokens || 2048, // Может понадобиться больше токенов для полного документа
                topP: settings.topP || 1,
                topK: settings.topK || 1
            }
        });

        const response = result.response;
        if (response.candidates && response.candidates.length > 0 && response.candidates[0].content.parts.length > 0) {
            return response.candidates[0].content.parts[0].text;
        } else {
            console.error("DEBUG: Получен пустой или некорректный ответ от API при генерации документа:", response);
            return "API вернул пустой ответ. Проверьте лог ошибок.";
        }

    } catch (error) {
        console.error("Ошибка при вызове Vertex AI API для генерации документа:", error);
        return `Произошла ошибка API: ${error.message}`;
    }
}

/**
 * Сохраняет документ локально.
 * @param {string} markdownContent - Содержимое документа в формате Markdown.
 * @param {Array} history - История диалога для сохранения в JSON.
 * @param {object} settings - Настройки, включая gcsBucket.
 */
async function saveDocument(markdownContent, history, settings) {
    try {
        const { filePath, canceled } = await dialog.showSaveDialog({
            title: 'Сохранить документ',
            defaultPath: 'game-design-document.md',
            filters: [
                { name: 'Markdown', extensions: ['md'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (canceled || !filePath) {
            return { success: false, message: 'Сохранение отменено.' };
        }

        // Сохраняем .md файл
        await fs.writeFile(filePath, markdownContent, 'utf-8');

        // Сохраняем .json файл с историей
        const jsonFilePath = filePath.replace(/\.md$/, '.json');
        await fs.writeFile(jsonFilePath, JSON.stringify(history, null, 2), 'utf-8');

        let cloudMessage = '';
        // Загружаем в облако, если указан бакет
        if (settings.gcsBucket) {
            const cloudResult = await uploadToCloud(settings.gcsBucket, filePath, jsonFilePath);
            if (cloudResult.success) {
                cloudMessage = `\nФайлы также успешно загружены в GCS бакет: ${settings.gcsBucket}`;
            } else {
                cloudMessage = `\nОшибка при загрузке в GCS: ${cloudResult.message}`;
            }
        }

        return { success: true, message: `Документ успешно сохранен в ${filePath}.${cloudMessage}` };

    } catch (error) {
        console.error('Ошибка при сохранении файла:', error);
        return { success: false, message: `Не удалось сохранить файл: ${error.message}` };
    }
}

/**
 * Экспортирует статистику (историю диалога) в JSON файл.
 * @param {Array} history - История диалога.
 */
async function exportStatistics(history) {
    try {
        const { filePath, canceled } = await dialog.showSaveDialog({
            title: 'Экспортировать статистику для обучения',
            defaultPath: 'training_data.json',
            filters: [
                { name: 'JSON', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (canceled || !filePath) {
            return { success: false, message: 'Экспорт отменен.' };
        }

        // Оставляем только вопросы с ответами и тегами
        const trainingData = history
            .filter(turn => turn.answer && turn.tags && turn.tags.length > 0)
            .map(turn => ({
                question: turn.question,
                tags: turn.tags
            }));

        await fs.promises.writeFile(filePath, JSON.stringify(trainingData, null, 2), 'utf-8');

        return { success: true, message: `Статистика успешно экспортирована в ${filePath}` };

    } catch (error) {
        console.error('Ошибка при экспорте статистики:', error);
        return { success: false, message: `Не удалось экспортировать статистику: ${error.message}` };
    }
}

/**
 * Предлагает теги для вопроса с помощью модели Gemini.
 * @param {string} question - Текст вопроса.
 * @param {string[]} allTags - Массив всех возможных тегов.
 * @param {object} settings - Настройки генерации.
 */
async function suggestTagsFromAPI(question, allTags, settings) {
    console.log("DEBUG: Попытка предложить теги для вопроса:", question);

    if (!settings.model || !settings.projectId) {
        console.error("DEBUG: Модель или Project ID не указаны в настройках для предложения тегов.");
        return []; // Возвращаем пустой массив, если нет настроек
    }

    try {
        const vertexAI = getVertexAIClient(settings);
        const generativeModel = vertexAI.getGenerativeModel({ model: settings.model });

        const prompt = `Проанализируй следующий вопрос от ассистента по геймдизайну и выбери до 3 наиболее подходящих тегов из предоставленного списка.
        
Вопрос: "${question}"

Список доступных тегов:
${allTags.join(', ')}

Твой ответ должен быть JSON-массивом, содержащим только строки с выбранными тегами. Например: ["тег1", "тег2", "тег3"].
Не добавляй никаких объяснений или дополнительного текста, только JSON-массив.`;

        const result = await generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2, // Низкая температура для более детерминированного выбора
                maxOutputTokens: 100,
                topP: 1,
                topK: 1
            }
        });

        const responseText = result.response.candidates[0].content.parts[0].text;
        console.log("DEBUG: Сырой ответ от API для тегов:", responseText);

        // Пытаемся извлечь JSON из ответа
        const jsonMatch = responseText.match(/\[.*\]/);
        if (jsonMatch) {
            const tags = JSON.parse(jsonMatch[0]);
            console.log("DEBUG: Предложенные теги:", tags);
            return tags;
        } else {
            console.error("DEBUG: Не удалось найти JSON-массив в ответе API:", responseText);
            return [];
        }

    } catch (error) {
        console.error("Ошибка при вызове Vertex AI API для предложения тегов:", error);
        return []; // Возвращаем пустой массив в случае ошибки
    }
}


/**
 * Загружает файлы в Google Cloud Storage.
 * @param {string} bucketName - Имя бакета.
 * @param {string} mdFilePath - Путь к .md файлу.
 * @param {string} jsonFilePath - Путь к .json файлу.
 */
async function uploadToCloud(bucketName, mdFilePath, jsonFilePath) {
    try {
        const storage = new Storage();
        const bucket = storage.bucket(bucketName);

        const mdFileName = path.basename(mdFilePath);
        const jsonFileName = path.basename(jsonFilePath);

        // Загружаем оба файла
        await bucket.upload(mdFilePath, { destination: mdFileName });
        await bucket.upload(jsonFilePath, { destination: jsonFileName });

        console.log(`Файлы ${mdFileName} и ${jsonFileName} загружены в ${bucketName}.`);
        return { success: true };

    } catch (error) {
        console.error('Ошибка при загрузке в Google Cloud Storage:', error);
        return { success: false, message: error.message };
    }
}

// --- НАСТРОЙКА ELECTRON ---

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools(); 
}

app.whenReady().then(() => {
  ipcMain.handle('generate-question', async (event, history, settings) => {
    return await generateQuestionFromAPI(history, settings);
  });

  ipcMain.handle('generate-document', async (event, history, settings) => {
    return await generateDocumentFromAPI(history, settings);
  });

  ipcMain.handle('save-document', async (event, markdownContent, history, settings) => {
    return await saveDocument(markdownContent, history, settings);
  });

  ipcMain.handle('suggest-tags', async (event, question, allTags, settings) => {
    // Важно передавать настройки из renderer.js, так как они там хранятся
    const window = BrowserWindow.fromWebContents(event.sender);
    const rendererSettings = await window.webContents.executeJavaScript('localStorage.getItem("generationSettings");', true);
    const parsedSettings = JSON.parse(rendererSettings);
    return await suggestTagsFromAPI(question, allTags, parsedSettings);
  });

  ipcMain.handle('export-statistics', async (event, history) => {
    return await exportStatistics(history);
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
