const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI;
let model;

// --- НАСТРОЙКА GOOGLE GENERATIVE AI ---
ipcMain.handle('init-ai', (event, apiKey) => {
    try {
        console.log("DEBUG: Инициализация GenAI...");
        console.log("DEBUG: Текущая директория:", process.cwd());
        
        // Используем API-ключ из переменной окружения или из файла
        const API_KEY = process.env.GOOGLE_API_KEY || apiKey;
        
        if (!API_KEY) {
            console.error("API-ключ не найден. Пожалуйста, установите переменную окружения GOOGLE_API_KEY или передайте ключ через параметр.");
            return { success: false, error: "API-ключ не найден" };
        }
        
        // Инициализируем Google Generative AI с API-ключом
        genAI = new GoogleGenerativeAI(API_KEY);
        
        // Модель будет создаваться динамически при каждом запросе
        console.log("DEBUG: GenAI инициализирован успешно");
        return { success: true };
    } catch (error) {
        console.error("Ошибка инициализации GenAI:", error);
        return { success: false, error: error.message };
    }
});

async function generateQuestionFromAPI(history, settings) {
  if (!genAI) {
    return "AI не был инициализирован.";
  }

  // Получаем модель на основе настроек
  const modelName = settings.model || 'gemini-2.5-flash-preview-05-20';
  const model = genAI.getGenerativeModel({ model: modelName });

  console.log(`DEBUG: Генерация вопроса с использованием модели ${modelName}...`);
  console.log("DEBUG: История диалога:", JSON.stringify(history));

  try {
    // Создаем чат с настройками из интерфейса
    const chat = model.startChat({
      generationConfig: {
        temperature: settings.temperature || 0.9,
        maxOutputTokens: settings.maxOutputTokens || 1024,
        topP: settings.topP || 1,
        topK: settings.topK || 1
      }
    });

    // Формируем историю сообщений
    let lastMessage = "";
    if (history.length > 0) {
      for (const turn of history) {
        if (turn.question && turn.answer) {
          // Добавляем предыдущие сообщения в историю чата
          await chat.sendMessage(turn.question);
          lastMessage = turn.answer;
        }
      }
    }

    // Отправляем последний ответ пользователя и получаем следующий вопрос
    console.log("DEBUG: Отправка сообщения в API:", lastMessage || "Начало диалога");
    
    // Добавляем инструкции к запросу
    const prompt = `Ты - ассистент по игровому дизайну. Твоя задача - помочь пользователю создать документ по дизайну игры, задавая логичные и краткие вопросы.
    
    Вот предыдущий ответ пользователя: "${lastMessage || "Я хочу создать игру. Помоги мне составить документ."}"
    
    Задай ОДИН следующий логичный вопрос, который поможет пользователю лучше описать концепцию игры. Не повторяй вопросы, которые уже были заданы. Не добавляй никаких дополнительных фраз, только сам вопрос.`;
    
    const result = await chat.sendMessage(prompt);
    
    console.log("DEBUG: Ответ получен:", JSON.stringify(result));
    
    const fallbackQuestions = [
      "Какой жанр у вашей игры?",
      "Кто будет целевой аудиторией вашей игры?",
      "Какие основные механики будут в вашей игре?",
      "Какая будет визуальная стилистика вашей игры?",
      "Какую историю или сюжет вы планируете для вашей игры?",
      "Какие платформы вы рассматриваете для выпуска вашей игры?",
      "Какие уникальные особенности будут отличать вашу игру от конкурентов?",
      "Как вы планируете монетизировать вашу игру?",
      "Какие ресурсы вам потребуются для разработки этой игры?",
      "Что еще вы хотели бы добавить в документ по дизайну вашей игры?"
    ];

    const getFallbackQuestion = () => {
        // history.length будет от 1 и выше, а индекс массива с 0
        const index = history.length - 1;
        return fallbackQuestions[index] || fallbackQuestions[fallbackQuestions.length - 1];
    };

    try {
      const nextQuestion = result.response.text();
      if (nextQuestion && nextQuestion.trim() !== '') {
        return nextQuestion;
      } else {
        console.log("DEBUG: Ответ от API пустой, используем запасной вопрос.");
        return getFallbackQuestion();
      }
    } catch (error) {
      console.error("Ошибка при извлечении текста из ответа, используем запасной вопрос:", error);
      return getFallbackQuestion();
    }
  } catch (error) {
    console.error("Ошибка при вызове GenAI API:", error);
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
