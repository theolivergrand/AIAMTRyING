const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { VertexAI } = require('@google-cloud/vertexai');
const { ModelServiceClient } = require('@google-cloud/aiplatform');

let vertexAI;
let generativeModel;

// --- НАСТРОЙКА VERTEX AI ---
function initAI() {
    try {
        console.log("DEBUG: Инициализация Vertex AI с сервисным аккаунтом...");

        process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'authfiles', 'gdd-suite-c531d4fedee0.json');
        
        vertexAI = new VertexAI({
            project: 'gdd-suite',
            location: 'europe-west1'
        });

        console.log("DEBUG: Vertex AI инициализирован успешно");
        return { success: true };
    } catch (error) {
        console.error("Ошибка инициализации Vertex AI:", error);
        return { success: false, error: error.message };
    }
}

async function getAvailableModels(region) {
    console.warn("DEBUG: getAvailableModels is disabled pending a fix for ModelServiceClient.");
    return [];
}

async function generateQuestionFromAPI(history, settings) {
  if (!vertexAI) {
    return "AI не был инициализирован. Проверьте настройки аутентификации.";
  }

  const modelName = settings.model || 'gemini-1.5-flash-preview-0514';
  generativeModel = vertexAI.getGenerativeModel({ model: modelName });

  console.log(`DEBUG: Генерация вопроса с использованием модели ${modelName}...`);

  const chatHistory = history.map(turn => ({
    role: turn.answer ? "user" : "model",
    parts: [{ text: turn.answer || turn.question }]
  })).slice(0, -1);

  const lastUserAnswer = history.length > 0 && history[history.length - 1].answer ? history[history.length - 1].answer : "Я хочу создать игру. Помоги мне составить документ.";

  const prompt = `Ты - ассистент по игровому дизайну. Твоя задача - помочь пользователю создать документ по дизайну игры, задавая логичные и краткие вопросы.
    
    Вот предыдущий ответ пользователя: "${lastUserAnswer}"
    
    Задай ОДИН следующий логичный вопрос, который поможет пользователю лучше описать концепцию игры. Не повторяй вопросы, которые уже были заданы. Не добавляй никаких дополнительных фраз, только сам вопрос.`;

  try {
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
    
    return response.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Ошибка при вызове Vertex AI API:", error);
    return `Произошла ошибка API: ${error.message}`;
  }
}
// -------------------------


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
  const initResult = initAI();
  if (!initResult.success) {
      console.error("Не удалось инициализировать AI, приложение может работать некорректно.");
  }

  ipcMain.handle('generate-question', async (event, history, settings) => {
    return await generateQuestionFromAPI(history, settings);
  });

  ipcMain.handle('get-models-for-region', async (event, region) => {
    return await getAvailableModels(region);
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
