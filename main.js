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
        
        // Получаем модель Gemini
        model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });
        
        console.log("DEBUG: GenAI инициализирован успешно");
        return { success: true };
    } catch (error) {
        console.error("Ошибка инициализации GenAI:", error);
        return { success: false, error: error.message };
    }
});

async function generateQuestionFromAPI(history) {
  if (!model) {
    return "AI не был инициализирован.";
  }

  console.log("DEBUG: Генерация вопроса...");
  console.log("DEBUG: История диалога:", JSON.stringify(history));

  try {
    // Создаем чат
    const chat = model.startChat({
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 256,
        topP: 1,
        topK: 1
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
    
    // Проверяем, есть ли текст в ответе
    try {
      const nextQuestion = result.response.text();
      if (nextQuestion && nextQuestion.trim() !== '') {
        return nextQuestion;
      } else {
        // Если ответ пустой, генерируем следующий вопрос на основе истории
        if (history.length === 1) {
          return "Какой жанр у вашей игры?";
        } else if (history.length === 2) {
          return "Кто будет целевой аудиторией вашей игры?";
        } else if (history.length === 3) {
          return "Какие основные механики будут в вашей игре?";
        } else if (history.length === 4) {
          return "Какая будет визуальная стилистика вашей игры?";
        } else if (history.length === 5) {
          return "Какую историю или сюжет вы планируете для вашей игры?";
        } else if (history.length === 6) {
          return "Какие платформы вы рассматриваете для выпуска вашей игры?";
        } else if (history.length === 7) {
          return "Какие уникальные особенности будут отличать вашу игру от конкурентов?";
        } else if (history.length === 8) {
          return "Как вы планируете монетизировать вашу игру?";
        } else if (history.length === 9) {
          return "Какие ресурсы вам потребуются для разработки этой игры?";
        } else {
          return "Что еще вы хотели бы добавить в документ по дизайну вашей игры?";
        }
      }
    } catch (error) {
      console.error("Ошибка при извлечении текста из ответа:", error);
      
      // Если произошла ошибка при извлечении текста, генерируем следующий вопрос на основе истории
      if (history.length === 1) {
        return "Какой жанр у вашей игры?";
      } else if (history.length === 2) {
        return "Кто будет целевой аудиторией вашей игры?";
      } else if (history.length === 3) {
        return "Какие основные механики будут в вашей игре?";
      } else if (history.length === 4) {
        return "Какая будет визуальная стилистика вашей игры?";
      } else if (history.length === 5) {
        return "Какую историю или сюжет вы планируете для вашей игры?";
      } else if (history.length === 6) {
        return "Какие платформы вы рассматриваете для выпуска вашей игры?";
      } else if (history.length === 7) {
        return "Какие уникальные особенности будут отличать вашу игру от конкурентов?";
      } else if (history.length === 8) {
        return "Как вы планируете монетизировать вашу игру?";
      } else if (history.length === 9) {
        return "Какие ресурсы вам потребуются для разработки этой игры?";
      } else {
        return "Что еще вы хотели бы добавить в документ по дизайну вашей игры?";
      }
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
  ipcMain.handle('generate-question', async (event, history) => {
    return await generateQuestionFromAPI(history);
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
