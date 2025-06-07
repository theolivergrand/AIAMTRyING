const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { VertexAI } = require('@google-cloud/vertexai');

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

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
