const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');

// --- ЛОКАЛЬНЫЕ ФУНКЦИИ (РАБОТА С ФАЙЛАМИ) ---

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

        await bucket.upload(mdFilePath, { destination: mdFileName });
        await bucket.upload(jsonFilePath, { destination: jsonFileName });

        console.log(`Файлы ${mdFileName} и ${jsonFileName} загружены в ${bucketName}.`);
        return { success: true };

    } catch (error) {
        console.error('Ошибка при загрузке в Google Cloud Storage:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Сохраняет документ локально и, если указано, в облаке.
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

        await fs.promises.writeFile(filePath, markdownContent, 'utf-8');
        const jsonFilePath = filePath.replace(/\.md$/, '.json');
        await fs.promises.writeFile(jsonFilePath, JSON.stringify(history, null, 2), 'utf-8');

        let cloudMessage = '';
        if (settings.gcsBucket) {
            const cloudResult = await uploadToCloud(settings.gcsBucket, filePath, jsonFilePath);
            cloudMessage = cloudResult.success 
                ? `\nФайлы также успешно загружены в GCS бакет: ${settings.gcsBucket}`
                : `\nОшибка при загрузке в GCS: ${cloudResult.message}`;
        }

        return { success: true, message: `Документ успешно сохранен в ${filePath}.${cloudMessage}` };

    } catch (error) {
        console.error('Ошибка при сохранении файла:', error);
        return { success: false, message: `Не удалось сохранить файл: ${error.message}` };
    }
}

/**
 * Экспортирует статистику в JSON файл.
 */
async function exportStatistics(history) {
    try {
        const { filePath, canceled } = await dialog.showSaveDialog({
            title: 'Экспортировать статистику для обучения',
            defaultPath: 'training_data.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });

        if (canceled || !filePath) {
            return { success: false, message: 'Экспорт отменен.' };
        }

        const trainingData = history
            .filter(turn => turn.answer && turn.tags && turn.tags.length > 0)
            .map(turn => ({ question: turn.question, tags: turn.tags }));

        await fs.promises.writeFile(filePath, JSON.stringify(trainingData, null, 2), 'utf-8');
        return { success: true, message: `Статистика успешно экспортирована в ${filePath}` };

    } catch (error) {
        console.error('Ошибка при экспорте статистики:', error);
        return { success: false, message: `Не удалось экспортировать статистику: ${error.message}` };
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
  const cloudFunctionBaseUrl = 'https://api-6u3bp3wewa-ey.a.run.app';

  // Общая функция для вызова облачных API
  async function callCloudApi(endpoint, body) {
    try {
      console.log(`Вызов облачной функции: ${cloudFunctionBaseUrl}${endpoint}`);
      const response = await fetch(`${cloudFunctionBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ошибка сети: ${response.status} ${response.statusText} - ${errorBody}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Ошибка при вызове ${endpoint}:`, error);
      return { error: error.message };
    }
  }

  // --- ОБРАБОТЧИКИ IPC (СВЯЗЬ С ИНТЕРФЕЙСОМ) ---

  ipcMain.handle('generate-question', async (event, history, settings) => {
    const result = await callCloudApi('/generateQuestion', { history, settings });
    return result.error ? `Ошибка: ${result.error}` : result.question;
  });

  ipcMain.handle('generate-document', async (event, history, settings) => {
    const result = await callCloudApi('/generateDocument', { history, settings });
    return result.error ? `Ошибка: ${result.error}` : result.document;
  });
  
  ipcMain.handle('suggest-tags', async (event, question, allTags) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const rendererSettings = await window.webContents.executeJavaScript('localStorage.getItem("generationSettings");', true);
    const parsedSettings = JSON.parse(rendererSettings || '{}');
    const result = await callCloudApi('/suggestTags', { question, allTags, settings: parsedSettings });
    return result.error ? [] : result.tags;
  });

  // Локальные обработчики
  ipcMain.handle('save-document', saveDocument);
  ipcMain.handle('export-statistics', (event, history) => exportStatistics(history));

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
