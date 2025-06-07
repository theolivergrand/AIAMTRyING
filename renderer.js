// --- Элементы основного интерфейса ---
const aiQuestionElement = document.getElementById('ai-question');
const userInputElement = document.getElementById('user-input');
const submitButton = document.getElementById('submit-button');
const likeButton = document.getElementById('like-button');
const documentContentElement = document.getElementById('document-content');

// --- Элементы меню настроек ---
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const closeButton = document.querySelector('.close-button');
const saveSettingsButton = document.getElementById('save-settings-button');
const temperatureInput = document.getElementById('temperature');
const maxOutputTokensInput = document.getElementById('maxOutputTokens');
const topPInput = document.getElementById('topP');
const topKInput = document.getElementById('topK');
const projectIdInput = document.getElementById('project-id');
const regionInput = document.getElementById('region');
const modelInput = document.getElementById('model');

let conversationHistory = [];
let generationSettings = {};

// --- Инициализация при запуске ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettingsAndModels();
    await displayQuestion();
});


// --- Основная логика ассистента ---
async function displayQuestion() {
    submitButton.disabled = true;
    likeButton.style.display = 'none';
    aiQuestionElement.innerText = 'Генерирую вопрос...';

    let nextQuestion;
    if (conversationHistory.length === 0) {
        nextQuestion = "Какова основная идея вашей игры? Опишите ее в одном предложении.";
    } else {
        nextQuestion = await window.api.generateQuestion(conversationHistory, generationSettings);
    }
    
    aiQuestionElement.innerText = nextQuestion;
    
    submitButton.disabled = false;
    likeButton.style.display = 'block';

    conversationHistory.push({ question: nextQuestion, answer: null });
}

submitButton.addEventListener('click', async () => {
    const userAnswer = userInputElement.value;
    if (userAnswer.trim() === '' || submitButton.disabled) return;

    const lastEntry = conversationHistory[conversationHistory.length - 1];
    if (lastEntry) {
        lastEntry.answer = userAnswer;

        const entry = document.createElement('div');
        entry.innerHTML = `<h3>${lastEntry.question}</h3><p>${lastEntry.answer}</p>`;
        documentContentElement.appendChild(entry);

        userInputElement.value = '';
        await displayQuestion();
    }
});

likeButton.addEventListener('click', () => {
    if (conversationHistory.length < 2) return;

    const previousInteraction = conversationHistory[conversationHistory.length - 2];
    const relevantQuestion = previousInteraction.question;
    const relevantAnswer = previousInteraction.answer;
    const likedQuestion = conversationHistory[conversationHistory.length - 1].question;
    
    console.log("--- ДАННЫЕ ДЛЯ ОБУЧЕНИЯ ---");
    console.log("ПРЕДЫДУЩИЙ ВОПРОС ИИ:", relevantQuestion);
    console.log("ПРЕДЫДУЩИЙ ОТВЕТ ПОЛЬЗОВАТЕЛЯ:", relevantAnswer);
    console.log("ПОНРАВИВШИЙСЯ ВОПРОС ИИ:", likedQuestion);
    console.log("--------------------------");

    likeButton.style.color = '#ffc107'; 
    setTimeout(() => { likeButton.style.color = '#cccccc'; }, 1000);
});

// --- Логика меню настроек ---
async function loadSettingsAndModels() {
    const savedSettings = localStorage.getItem('generationSettings');
    if (savedSettings) {
        generationSettings = JSON.parse(savedSettings);
    } else {
        // Значения по умолчанию
        generationSettings = {
            temperature: 0.9,
            maxOutputTokens: 1024,
            topP: 1,
            topK: 1,
            projectId: '',
            region: 'us-central1',
            model: 'gemini-1.5-pro-latest',
        };
    }
    
    temperatureInput.value = generationSettings.temperature;
    maxOutputTokensInput.value = generationSettings.maxOutputTokens;
    topPInput.value = generationSettings.topP;
    topKInput.value = generationSettings.topK;
    projectIdInput.value = generationSettings.projectId;
    regionInput.value = generationSettings.region;

    populateModelList();
    modelInput.value = generationSettings.model;
}

function populateModelList() {
    const models = [
        { id: "gemini-2.5-flash-preview-05-20", name: "gemini-2.5-flash-preview-05-20" },
        { id: "gemini-2.0-flash-001", name: "gemini-2.0-flash-001" },
        { id: "gemini-2.0-flash-lite-001", name: "gemini-2.0-flash-lite-001" },
        { id: "gemini-1.5-pro-002", name: "gemini-1.5-pro-002" },
        { id: "gemini-1.5-flash-002", name: "gemini-1.5-flash-002" },
        { id: "gemini-embedding-001", name: "gemini-embedding-001" },
        { id: "imagegeneration@002", name: "imagegeneration@002" },
        { id: "imagegeneration@005", name: "imagegeneration@005" },
        { id: "imagegeneration@006", name: "imagegeneration@006" },
        { id: "imagen-3.0-generate-001", name: "imagen-3.0-generate-001" },
        { id: "imagen-3.0-fast-generate-001", name: "imagen-3.0-fast-generate-001" },
        { id: "imagen-3.0-capability-001", name: "imagen-3.0-capability-001" },
        { id: "imagen-3.0-generate-002", name: "imagen-3.0-generate-002" }
    ];

    modelInput.innerHTML = '';
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelInput.appendChild(option);
    });
}

function saveSettings() {
    generationSettings = {
        temperature: parseFloat(temperatureInput.value) || 0.9,
        maxOutputTokens: parseInt(maxOutputTokensInput.value) || 1024,
        topP: parseFloat(topPInput.value) || 1,
        topK: parseInt(topKInput.value) || 1,
        projectId: projectIdInput.value,
        region: regionInput.value,
        model: modelInput.value,
    };
    localStorage.setItem('generationSettings', JSON.stringify(generationSettings));
    settingsModal.style.display = 'none';
}

settingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'block';
});

closeButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

saveSettingsButton.addEventListener('click', saveSettings);

window.addEventListener('click', (event) => {
    if (event.target == settingsModal) {
        settingsModal.style.display = 'none';
    }
});
