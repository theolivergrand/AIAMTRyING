import { ALL_TAGS } from './tags.js';

// --- Элементы основного интерфейса ---
const aiQuestionElement = document.getElementById('ai-question');
const userInputElement = document.getElementById('user-input');
const submitButton = document.getElementById('submit-button');
const likeButton = document.getElementById('like-button');
const documentContentElement = document.getElementById('document-content');
const tagContainer = document.getElementById('tag-container');

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
let currentTags = new Set();
const MAX_TAGS = 5;

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

    // Управляем отображением тегов
    await getAndDisplayTags(nextQuestion);

    conversationHistory.push({ question: nextQuestion, answer: null, tags: [] });
}

submitButton.addEventListener('click', async () => {
    const userAnswer = userInputElement.value;
    if (userAnswer.trim() === '' || submitButton.disabled) return;

    const lastEntry = conversationHistory[conversationHistory.length - 1];
    if (lastEntry) {
        lastEntry.answer = userAnswer;
        lastEntry.tags = Array.from(currentTags); // Сохраняем теги

        const entry = document.createElement('div');
        let tagsHTML = lastEntry.tags.map(tag => `<span class="doc-tag">${tag}</span>`).join(' ');
        entry.innerHTML = `<h3>${lastEntry.question}</h3><p>${lastEntry.answer}</p><div class="doc-tags">${tagsHTML}</div>`;
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
    // Закрываем автокомплит, если клик был вне его
    if (!event.target.closest('.autocomplete-suggestions') && !event.target.matches('#tag-input')) {
        clearAutocomplete();
    }
});

// --- Логика Тегов ---

async function getAndDisplayTags(question) {
    tagContainer.innerHTML = '';
    currentTags.clear();

    // TODO: Заменить на реальный вызов API для получения умных подсказок
    const suggestedTags = suggestTagsMock(question); 
    
    suggestedTags.forEach(tag => addTag(tag));

    renderTagInput();
}

function suggestTagsMock(question) {
    const suggestions = new Set();
    const words = question.toLowerCase().split(/\s+/);
    if (words.includes('концепция') || words.includes('идея')) {
        suggestions.add('Vision');
    }
    if (words.includes('механика') || words.includes('геймплей')) {
        suggestions.add('игровая механика');
    }
    if (words.includes('персонаж') || words.includes('герой')) {
        suggestions.add('персонаж');
    }
    return Array.from(suggestions);
}

function renderTag(tagName) {
    const tagElement = document.createElement('div');
    tagElement.className = 'tag';
    tagElement.textContent = tagName;

    const removeElement = document.createElement('span');
    removeElement.className = 'remove-tag';
    removeElement.textContent = 'x';
    removeElement.onclick = () => {
        currentTags.delete(tagName);
        tagContainer.removeChild(tagElement);
        updateTagInputState();
    };

    tagElement.appendChild(removeElement);
    return tagElement;
}

function addTag(tagName) {
    if (tagName && !currentTags.has(tagName) && currentTags.size < MAX_TAGS) {
        currentTags.add(tagName);
        const tagElement = renderTag(tagName);
        tagContainer.insertBefore(tagElement, tagContainer.querySelector('#tag-input'));
        updateTagInputState();
    }
}

function updateTagInputState() {
    const tagInputElement = document.getElementById('tag-input');
    if (tagInputElement) {
        if (currentTags.size >= MAX_TAGS) {
            tagInputElement.style.display = 'none';
        } else {
            tagInputElement.style.display = 'block';
            tagInputElement.value = '';
        }
    }
}

function renderTagInput() {
    if (currentTags.size >= MAX_TAGS) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'tag-input';
    input.placeholder = 'Добавить тег...';
    input.onkeydown = handleTagInputKeydown;
    input.oninput = handleTagInput;
    
    tagContainer.appendChild(input);
    input.focus();
}

function handleTagInputKeydown(e) {
    const input = e.target;
    const suggestionsContainer = document.querySelector('.autocomplete-suggestions');
    
    if (e.key === 'Enter') {
        e.preventDefault();
        const activeSuggestion = suggestionsContainer?.querySelector('.active');
        if (activeSuggestion) {
            addTag(activeSuggestion.textContent);
            clearAutocomplete();
            input.value = '';
        } else if (input.value.trim()) {
            addTag(input.value.trim());
            input.value = '';
        }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const suggestions = suggestionsContainer?.querySelectorAll('div');
        if (!suggestions || suggestions.length === 0) return;

        let activeIndex = -1;
        suggestions.forEach((s, i) => {
            if (s.classList.contains('active')) {
                activeIndex = i;
                s.classList.remove('active');
            }
        });

        if (e.key === 'ArrowDown') {
            activeIndex = (activeIndex + 1) % suggestions.length;
        } else {
            activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
        }
        
        suggestions[activeIndex].classList.add('active');
    } else if (e.key === 'Escape') {
        clearAutocomplete();
    }
}

function handleTagInput(e) {
    const input = e.target;
    const value = input.value.toLowerCase();
    clearAutocomplete();

    if (value.length < 1) return;

    const suggestions = ALL_TAGS.filter(tag => 
        tag.toLowerCase().includes(value) && !currentTags.has(tag)
    );

    if (suggestions.length > 0) {
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'autocomplete-suggestions';
        
        suggestions.slice(0, 5).forEach(suggestion => {
            const div = document.createElement('div');
            div.textContent = suggestion;
            div.onclick = () => {
                addTag(suggestion);
                clearAutocomplete();
                input.value = '';
                document.getElementById('tag-input')?.focus();
            };
            suggestionsContainer.appendChild(div);
        });

        // Позиционирование контейнера
        tagContainer.appendChild(suggestionsContainer);
        const inputRect = input.getBoundingClientRect();
        suggestionsContainer.style.left = `${inputRect.left}px`;
        suggestionsContainer.style.top = `${inputRect.bottom}px`;
        suggestionsContainer.style.width = `${inputRect.width}px`;
    }
}

function clearAutocomplete() {
    const suggestionsContainer = document.querySelector('.autocomplete-suggestions');
    if (suggestionsContainer) {
        suggestionsContainer.remove();
    }
}
