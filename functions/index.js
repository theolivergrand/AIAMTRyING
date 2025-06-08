const express = require('express');
const bodyParser = require('body-parser');
const { VertexAI } = require('@google-cloud/vertexai');

const app = express();
app.use(bodyParser.json());

// --- Утилиты ---

function getVertexAIClient(settings) {
    if (!settings.projectId || !settings.region) {
        throw new Error("Project ID и Region должны быть указаны в настройках.");
    }
    return new VertexAI({ project: settings.projectId, location: settings.region });
}

function getGenerationConfig(settings) {
    return {
        temperature: settings.temperature || 0.9,
        maxOutputTokens: settings.maxOutputTokens || 1024,
        topP: settings.topP || 1,
        topK: settings.topK || 1,
    };
}

// --- Логика API ---

async function generateQuestionFromAPI(history, settings) {
    const vertexAI = getVertexAIClient(settings);
    const generativeModel = vertexAI.getGenerativeModel({ model: settings.model });
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
        generationConfig: getGenerationConfig(settings) // ИСПРАВЛЕНО
    });
    const result = await chat.sendMessage(prompt);
    const response = result.response;
    if (response.candidates && response.candidates.length > 0 && response.candidates[0].content.parts.length > 0) {
        return response.candidates[0].content.parts[0].text;
    }
    throw new Error("API вернул пустой ответ.");
}

async function generateDocumentFromAPI(history, settings) {
    const vertexAI = getVertexAIClient(settings);
    const generativeModel = vertexAI.getGenerativeModel({ model: settings.model });
    const formattedHistory = history
        .filter(turn => turn.answer)
        .map(turn => `### ${turn.question}\n\n${turn.answer}\n\n**Теги: ${turn.tags.join(', ')}**`)
        .join('\n\n---\n\n');
    const prompt = `Ты — опытный сценарист и геймдизайнер. Твоя задача — взять серию вопросов, ответов и тегов и превратить их в связный, хорошо структурированный и отформатированный в Markdown документ (GDD - Game Design Document).
    Инструкции:
    1.  Проанализируй весь диалог.
    2.  Создай логичную структуру, используя теги как подсказки.
    3.  Используй Markdown.
    4.  Напиши связный текст.
    5.  Основывайся только на информации из диалога.
    Вот история диалога для обработки:
    ---
    ${formattedHistory}
    ---
    Создай из этого полноценный GDD в формате Markdown.`;
    
    const result = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: getGenerationConfig(settings) // ИСПРАВЛЕНО
    });
    const response = result.response;
    if (response.candidates && response.candidates.length > 0 && response.candidates[0].content.parts.length > 0) {
        return response.candidates[0].content.parts[0].text;
    }
    throw new Error("API вернул пустой ответ при генерации документа.");
}

async function suggestTagsFromAPI(question, allTags, settings) {
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
        generationConfig: getGenerationConfig(settings)
    });
    if (!result.response.candidates || result.response.candidates.length === 0 || !result.response.candidates[0].content || !result.response.candidates[0].content.parts || result.response.candidates[0].content.parts.length === 0) {
        console.warn("API для тегов вернул пустой или некорректный ответ.");
        return [];
    }
    const responseText = result.response.candidates[0].content.parts[0].text;
    const jsonMatch = responseText.match(/\[.*\]/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    }
    return [];
}

// --- Обработчики HTTP ---

app.post('/generateQuestion', async (req, res) => {
    try {
        const { history, settings } = req.body;
        const question = await generateQuestionFromAPI(history, settings);
        res.status(200).json({ question });
    } catch (error) {
        console.error("Ошибка в /generateQuestion:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/generateDocument', async (req, res) => {
    try {
        const { history, settings } = req.body;
        const document = await generateDocumentFromAPI(history, settings);
        res.status(200).json({ document });
    } catch (error) {
        console.error("Ошибка в /generateDocument:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/suggestTags', async (req, res) => {
    try {
        const { question, allTags, settings } = req.body;
        const tags = await suggestTagsFromAPI(question, allTags, settings);
        res.status(200).json({ tags });
    } catch (error) {
        console.error("Ошибка в /suggestTags:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Экспорт ---
// Среда Google Cloud Functions автоматически запускает сервер.
// Нам нужно только экспортировать приложение Express.
exports.api = app;
