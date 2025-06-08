import { ALL_TAGS } from './tags.js';

// --- Элементы основного интерфейса ---
const aiQuestionElement = document.getElementById('ai-question');
const userInputElement = document.getElementById('user-input');
const submitButton = document.getElementById('submit-button');
const likeButton = document.getElementById('like-button');
const documentContentElement = document.getElementById('document-content');
const tagContainer = document.getElementById('tag-container');
const suggestTagsButton = document.getElementById('suggest-tags-button');
const nextQuestionButton = document.getElementById('next-question-button');
const blacklistQuestionButton = document.getElementById('blacklist-question-button');

// --- Элементы генерации документа ---
const generateDocButton = document.getElementById('generate-doc-button');
const regenerateDocButton = document.getElementById('regenerate-doc-button');
const saveDocButton = document.getElementById('save-doc-button');
const documentPreview = document.getElementById('document-preview');

// --- Элементы меню настроек ---
const exportStatsButton = document.getElementById('export-stats-button');
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
const gcsBucketInput = document.getElementById('gcs-bucket');

let conversationHistory = [];
let generationSettings = {};
let currentTags = new Set();
const MAX_TAGS = 5;

// --- Инициализация при запуске ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettingsAndModels();
    await displayQuestion();
    renderTagInput(); // Начальный рендеринг поля ввода тегов
});


// --- Основная логика ассистента ---
async function displayQuestion() {
    submitButton.disabled = true;
    likeButton.style.display = 'none';
    aiQuestionElement.innerText = 'Генерирую вопрос...';

    clearTags(); // Очищаем старые теги

    let nextQuestion;
    if (conversationHistory.length === 0) {
        nextQuestion = "Какова основная идея вашей игры? Опишите ее в одном предложении.";
    } else {
        const questionBlacklist = JSON.parse(localStorage.getItem('questionBlacklist') || '[]');
        nextQuestion = await window.api.generateQuestion(conversationHistory, generationSettings, questionBlacklist);
    }
    
    aiQuestionElement.innerText = nextQuestion;
    
    submitButton.disabled = false;
    likeButton.style.display = 'block';

    // Управляем отображением тегов
    // await getAndDisplayTags(nextQuestion); // Больше не вызываем автоматически

    conversationHistory.push({ question: nextQuestion, answer: null, tags: [] });
}

nextQuestionButton.addEventListener('click', displayQuestion);

blacklistQuestionButton.addEventListener('click', async () => {
    const questionToBlacklist = aiQuestionElement.innerText;
    if (questionToBlacklist && questionToBlacklist !== 'Генерирую вопрос...') {
        let blacklist = JSON.parse(localStorage.getItem('questionBlacklist') || '[]');
        if (!blacklist.includes(questionToBlacklist)) {
            blacklist.push(questionToBlacklist);
            localStorage.setItem('questionBlacklist', JSON.stringify(blacklist));
        }
        await displayQuestion(); // Запрашиваем новый вопрос
    }
});

suggestTagsButton.addEventListener('click', async () => {
    const currentQuestion = aiQuestionElement.innerText;
    if (currentQuestion && currentQuestion !== 'Генерирую вопрос...') {
        suggestTagsButton.disabled = true;
        suggestTagsButton.textContent = 'Думаю...';
        await getAndDisplayTags(currentQuestion);
        suggestTagsButton.disabled = false;
        suggestTagsButton.textContent = 'Предложить теги';
    }
});

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
    if (conversationHistory.length === 0) return;
    
    // Находим последний вопрос, на который еще не ответили
    const lastEntry = conversationHistory[conversationHistory.length - 1];
    if (lastEntry && !lastEntry.answer) {
        lastEntry.liked = true; // Помечаем вопрос как понравившийся
        console.log(`Вопрос "${lastEntry.question}" помечен как понравившийся.`);

        // Отправляем фидбек в облако
        window.api.collectFeedback({
            question: lastEntry.question,
            liked: true,
            timestamp: new Date().toISOString()
        }, generationSettings).then(result => console.log("Результат сбора фидбека:", result.message));

        likeButton.style.color = '#ffc107';
        setTimeout(() => { likeButton.style.color = '#cccccc'; }, 1000);
    }
});

// --- Логика генерации и сохранения документа ---
async function handleGenerateDocument() {
    generateDocButton.disabled = true;
    regenerateDocButton.disabled = true;
    documentPreview.value = 'Генерация документа... Пожалуйста, подождите.';
    documentPreview.style.display = 'block';

    // Отправляем на генерацию только те вопросы, на которые есть ответ
    const answeredHistory = conversationHistory.filter(turn => turn.answer && turn.answer.trim() !== '');
    if (answeredHistory.length === 0) {
        documentPreview.value = 'Вы еще не ответили ни на один вопрос. Документ не может быть создан.';
        generateDocButton.disabled = false;
        regenerateDocButton.disabled = false;
        return;
    }

    const generatedMarkdown = await window.api.generateDocument(answeredHistory, generationSettings);
    // generatedMarkdown теперь объект: { markdownContent, gcsMdPath, gcsJsonPath }
    documentPreview.value = generatedMarkdown.markdownContent;

    if (generatedMarkdown.gcsMdPath) {
        console.log("Документ сохранен в GCS:", generatedMarkdown.gcsMdPath);
        // Можно показать пользователю сообщение об этом
    }
    // Показываем/скрываем нужные кнопки
    generateDocButton.style.display = 'none';
    regenerateDocButton.style.display = 'inline-block';
    saveDocButton.style.display = 'inline-block';
    
    generateDocButton.disabled = false;
    regenerateDocButton.disabled = false;
}

generateDocButton.addEventListener('click', handleGenerateDocument);
regenerateDocButton.addEventListener('click', handleGenerateDocument); // Перегенерация вызывает ту же функцию

saveDocButton.addEventListener('click', async () => {
    const markdownContent = documentPreview.value;
    if (!markdownContent) {
        alert('Нет документа для сохранения.');
        return;
    }

    saveDocButton.disabled = true;
    saveDocButton.textContent = 'Сохранение...';

    const result = await window.api.saveDocument(markdownContent, conversationHistory, generationSettings);

    if (result.success) {
        alert(result.message); // Простое уведомление
    } else {
        alert(`Ошибка сохранения: ${result.message}`);
    }

    saveDocButton.disabled = false;
    saveDocButton.textContent = 'Сохранить';
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
            maxOutputTokens: 16384, // Увеличено по умолчанию
            topP: 1,
            topK: 1,
            projectId: '',
            region: 'us-central1',
            model: 'gemini-1.5-pro-latest',
            gcsBucket: '',
        };
    }
    
    temperatureInput.value = generationSettings.temperature;
    maxOutputTokensInput.value = generationSettings.maxOutputTokens;
    topPInput.value = generationSettings.topP;
    topKInput.value = generationSettings.topK;
    projectIdInput.value = generationSettings.projectId;
    regionInput.value = generationSettings.region;
    gcsBucketInput.value = generationSettings.gcsBucket;

    populateModelList();
    modelInput.value = generationSettings.model;
    populateProjectIdList();

    // Показываем настройки, если Project ID не задан
    if (!generationSettings.projectId) {
        settingsModal.style.display = 'block';
    }
}

function populateModelList() {
    const models = [
        { id: "gemini-2.5-pro-preview-06-05", name: "gemini-2.5-pro-preview-06-05" },
        { id: "gemini-2.5-flash-preview-05-20", name: "gemini-2.5-flash-preview-05-20" },
        { id: "gemini-2.0-flash", name: "gemini-2.0-flash" },
        { id: "gemini-2.0-flash-preview-image-generation", name: "gemini-2.0-flash-preview-image-generation" },
        { id: "gemini-2.0-flash-lite", name: "gemini-2.0-flash-lite" },
        { id: "gemini-1.5-flash", name: "gemini-1.5-flash" },
        { id: "gemini-embedding-exp", name: "gemini-embedding-exp" }
    ];

    modelInput.innerHTML = '';
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
    modelInput.appendChild(option);
    });
}

function populateProjectIdList() {
    const projectIdList = document.getElementById('project-id-list');
    const savedProjectIds = JSON.parse(localStorage.getItem('savedProjectIds') || '[]');
    
    projectIdList.innerHTML = ''; // Очищаем старые опции
    savedProjectIds.forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        projectIdList.appendChild(option);
    });
}

function saveSettings() {
    generationSettings = {
        temperature: parseFloat(temperatureInput.value) || 0.9,
        maxOutputTokens: parseInt(maxOutputTokensInput.value) || 16384,
        topP: parseFloat(topPInput.value) || 1,
        topK: parseInt(topKInput.value) || 1,
        projectId: projectIdInput.value.trim(),
        region: regionInput.value,
        model: modelInput.value,
        gcsBucket: gcsBucketInput.value.trim(),
    };
    localStorage.setItem('generationSettings', JSON.stringify(generationSettings));

    // Сохраняем ID проекта в историю
    const newProjectId = projectIdInput.value.trim();
    if (newProjectId) {
        let savedProjectIds = JSON.parse(localStorage.getItem('savedProjectIds') || '[]');
        if (!savedProjectIds.includes(newProjectId)) {
            savedProjectIds.push(newProjectId);
            localStorage.setItem('savedProjectIds', JSON.stringify(savedProjectIds));
            // Обновляем datalist в реальном времени
            populateProjectIdList();
        }
    }

    settingsModal.style.display = 'none';
}

settingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'block';
});

closeButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

saveSettingsButton.addEventListener('click', saveSettings);

exportStatsButton.addEventListener('click', async () => {
    const result = await window.api.exportStatistics(conversationHistory, generationSettings);
    if (result.success) {
        alert(result.message);
    } else {
        alert(`Ошибка экспорта: ${result.message}`);
    }
});

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
    try {
        const suggestedTags = await window.api.suggestTags(question, ALL_TAGS, generationSettings);
        
        if (Array.isArray(suggestedTags) && suggestedTags.length > 0) {
            // Добавляем каждый тег как отдельную плашку с #
            suggestedTags.forEach(tag => {
                addTag(`#${tag}`);
            });
        }
    } catch (error) {
        console.error("Ошибка при получении подсказок тегов:", error);
        alert("Не удалось получить подсказки тегов из-за ошибки сервера.");
    }
}

function clearTags() {
    tagContainer.innerHTML = ''; // Очищаем DOM-элементы
    currentTags.clear(); // Очищаем набор данных
    renderTagInput(); // Восстанавливаем поле для ввода
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
