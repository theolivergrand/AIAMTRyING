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
const modelInput = document.getElementById('model');

let conversationHistory = [];
let lastUserAnswer = "";
let generationSettings = {};

// --- Создаем модальное окно для API-ключа ---
function createApiKeyModal() {
    const modal = document.createElement('div');
    modal.className = 'api-key-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';
    
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '400px';
    modalContent.style.textAlign = 'center';
    
    const title = document.createElement('h2');
    title.textContent = 'Введите ваш API-ключ Google AI';
    
    const description = document.createElement('p');
    description.textContent = 'Пожалуйста, введите ваш API-ключ от Google AI Studio для начала работы.';
    
    const input = document.createElement('input');
    input.type = 'password';
    input.id = 'api-key-input';
    input.placeholder = 'API-ключ...';
    input.style.width = '100%';
    input.style.padding = '10px';
    input.style.marginBottom = '10px';
    input.style.boxSizing = 'border-box';
    
    const button = document.createElement('button');
    button.textContent = 'Сохранить и начать';
    button.style.padding = '10px 15px';
    button.style.backgroundColor = '#007bff';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    
    modalContent.appendChild(title);
    modalContent.appendChild(description);
    modalContent.appendChild(input);
    modalContent.appendChild(button);
    modal.appendChild(modalContent);
    
    document.body.appendChild(modal);
    
    return new Promise((resolve) => {
        button.addEventListener('click', () => {
            const apiKey = input.value;
            document.body.removeChild(modal);
            resolve(apiKey);
        });
    });
}

// --- Инициализация AI при запуске ---
document.addEventListener('DOMContentLoaded', async () => {
    loadSettings(); // Загружаем настройки при старте

    // Запрашиваем API-ключ у пользователя через модальное окно
    const apiKey = await createApiKeyModal();
    
    if (!apiKey) {
        aiQuestionElement.innerText = "API-ключ не предоставлен. Перезагрузите страницу, чтобы попробовать снова.";
        return;
    }
    
    const result = await window.api.initAI(apiKey);
    if (result.success) {
        await displayQuestion();
    } else {
        aiQuestionElement.innerText = `Ошибка инициализации AI: ${result.error}`;
    }
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
        // Передаем историю и настройки в главный процесс
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

    // Проверяем, что у нас есть история диалога и последний элемент
    if (conversationHistory.length > 0) {
        const lastEntry = conversationHistory[conversationHistory.length - 1];
        if (lastEntry) {
            lastEntry.answer = userAnswer;
            lastUserAnswer = userAnswer;

            const entry = document.createElement('div');
            entry.innerHTML = `<h3>${lastEntry.question}</h3><p>${lastEntry.answer}</p>`;
            documentContentElement.appendChild(entry);

            userInputElement.value = '';
            
            await displayQuestion();
        } else {
            console.error("Последний элемент истории диалога не найден");
        }
    } else {
        console.error("История диалога пуста");
        // Если история пуста, создаем первый элемент
        conversationHistory.push({ 
            question: "Какова основная идея вашей игры? Опишите ее в одном предложении.", 
            answer: userAnswer 
        });
        
        const entry = document.createElement('div');
        entry.innerHTML = `<h3>Какова основная идея вашей игры? Опишите ее в одном предложении.</h3><p>${userAnswer}</p>`;
        documentContentElement.appendChild(entry);

        userInputElement.value = '';
        
        await displayQuestion();
    }
});

likeButton.addEventListener('click', () => {
    if (conversationHistory.length < 2) return;

    const relevantAnswer = conversationHistory[conversationHistory.length - 2].answer;
    const likedQuestion = conversationHistory[conversationHistory.length - 1].question;
    
    console.log("--- ДАННЫЕ ДЛЯ ОБУЧЕНИЯ ---");
    console.log("ПРЕДЫДУЩИЙ ОТВЕТ ПОЛЬЗОВАТЕЛЯ:", relevantAnswer);
    console.log("ПОНРАВИВШИЙСЯ ВОПРОС ИИ:", likedQuestion);
    console.log("--------------------------");

    likeButton.style.color = '#ffc107'; 
    setTimeout(() => { likeButton.style.color = '#cccccc'; }, 1000);
});

// --- Логика меню настроек ---
function loadSettings() {
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
            model: 'gemini-2.5-flash-preview-05-20'
        };
    }
    // Устанавливаем значения в поля ввода
    temperatureInput.value = generationSettings.temperature;
    maxOutputTokensInput.value = generationSettings.maxOutputTokens;
    topPInput.value = generationSettings.topP;
    topKInput.value = generationSettings.topK;
    modelInput.value = generationSettings.model;
}

function saveSettings() {
    generationSettings = {
        temperature: parseFloat(temperatureInput.value) || 0.9,
        maxOutputTokens: parseInt(maxOutputTokensInput.value) || 1024,
        topP: parseFloat(topPInput.value) || 1,
        topK: parseInt(topKInput.value) || 1,
        model: modelInput.value || 'gemini-2.5-flash-preview-05-20'
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
