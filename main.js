const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { VertexAI } = require('@google-cloud/vertexai');

let vertexAI;
let generativeModel;

// --- НАСТРОЙКА VERTEX AI ---
function initAI() {
    try {
        console.log("DEBUG: Инициализация Vertex AI с использованием Application Default Credentials...");
        
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

async function getAvailableModels() {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Could not get access token');
    }

    const response = await fetch(`https://global-aiplatform.googleapis.com/v1/publishers/google/models`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const foundationModels = data.models
      .filter(model => model.supportedGenerationMethods.includes('generateContent') && model.name.includes('gemini'))
      .map(model => ({
        displayName: model.displayName,
        modelId: model.name.split('/').pop()
      }));

    return foundationModels;
  } catch (error) {
    console.error(`Ошибка при получении списка моделей для региона ${region}:`, error);
    return [];
  }
}

async function getAccessToken() {
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform'
  });
  const client = await auth.getClient();
  const accessToken = (await client.getAccessToken()).token;
  return accessToken;
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

  ipcMain.handle('get-models', async (event) => {
    return await getAvailableModels();
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
