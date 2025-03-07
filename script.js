/* ===== ПЕРЕМЕННАЯ ДЛЯ ХРАНЕНИЯ ГРУЗИМОГО JSON ===== */
let questionsData = null;

/* ===== ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ===== */
document.addEventListener('DOMContentLoaded', () => {
  // Сразу показываем теорию
  showSection('theory');
  // Грузим файл с вопросами
  loadQuestionsJSON();
});

/* ===== ФУНКЦИЯ ЗАГРУЗКИ JSON (вопросов) ===== */
function loadQuestionsJSON() {
  fetch('data/questions.json')
    .then(response => response.json())
    .then(data => {
      questionsData = data;
      renderTests();
    })
    .catch(error => {
      console.error('Ошибка загрузки вопросов:', error);
    });
}

/* ===== ПЕРЕКЛЮЧЕНИЕ РАЗДЕЛОВ ===== */
function showSection(sectionId) {
  const sections = document.querySelectorAll('.section');
  sections.forEach(sec => sec.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
}

/* ===== ПОСТРОЕНИЕ ТЕСТОВ НА СТРАНИЦЕ ===== */
function renderTests() {
  if (!questionsData) return;
  const testContainer = document.getElementById('testContainer');
  testContainer.innerHTML = ''; // очистим

  questionsData.topics.forEach(topic => {
    const topicName = topic.name;

    const topicTitle = document.createElement('h3');
    topicTitle.textContent = `Тема: ${topicName}`;
    testContainer.appendChild(topicTitle);

    topic.variants.forEach(variant => {
      const variantNumber = variant.variantNumber;
      
      // Создаём блок для теста
      const testBlock = document.createElement('div');
      testBlock.className = 'test-block';
      testBlock.setAttribute('data-topic', topicName);
      testBlock.setAttribute('data-variant', variantNumber);

      const variantTitle = document.createElement('h4');
      variantTitle.textContent = `Вариант ${variantNumber}`;
      testBlock.appendChild(variantTitle);

      // Выводим вопросы
      variant.questions.forEach((q, qIndex) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question';
        questionDiv.textContent = q.question;
        testBlock.appendChild(questionDiv);

        const answersDiv = document.createElement('div');
        answersDiv.className = 'answers';
        
        q.answers.forEach((answer, aIndex) => {
          const label = document.createElement('label');
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = `q_${topicName}_${variantNumber}_${qIndex}`;
          radio.value = aIndex;
          label.appendChild(radio);
          label.appendChild(document.createTextNode(answer));
          answersDiv.appendChild(label);
        });
        testBlock.appendChild(answersDiv);
      });

      // Кнопка "Отправить"
      const submitBtn = document.createElement('button');
      submitBtn.textContent = 'Отправить';
      submitBtn.onclick = () => submitTest(testBlock);
      testBlock.appendChild(submitBtn);

      testContainer.appendChild(testBlock);
    });
  });
}

/* ===== ОТПРАВКА ТЕСТА (ПРОВЕРКА) ===== */
function submitTest(testBlock) {
  const topic = testBlock.getAttribute('data-topic');
  const variant = testBlock.getAttribute('data-variant');

  // Собираем вопросы
  const questions = testBlock.querySelectorAll('.question');
  let correctCount = 0;
  let totalCount = 0;

  questions.forEach((questionDiv, qIndex) => {
    const radios = questionDiv.nextElementSibling.querySelectorAll('input[type="radio"]');
    let selectedValue = null;
    radios.forEach(radio => {
      if (radio.checked) {
        selectedValue = parseInt(radio.value, 10);
      }
    });
    totalCount++;

    // Находим правильный индекс из questionsData
    const questionData = getQuestionData(topic, variant, qIndex);
    if (!questionData) return;
    const correctIndex = questionData.correctIndex;

    if (selectedValue === correctIndex) {
      correctCount++;
    }
  });

  storeResult(topic, variant, correctCount, totalCount);

  alert(`Правильных ответов: ${correctCount} из ${totalCount}`);
}

/* ===== ПОИСК ДАННЫХ О КОНКРЕТНОМ ВОПРОСЕ В JSON ===== */
function getQuestionData(topicName, variantNumber, questionIndex) {
  if (!questionsData) return null;
  const topicObj = questionsData.topics.find(t => t.name === topicName);
  if (!topicObj) return null;
  const variantObj = topicObj.variants.find(v => v.variantNumber == variantNumber);
  if (!variantObj) return null;
  return variantObj.questions[questionIndex] || null;
}

/* ===== ХРАНЕНИЕ РЕЗУЛЬТАТОВ (LOCALSTORAGE) ===== */
function storeResult(topic, variant, correctCount, totalCount) {
  // структура: { "topic|variant": { correct: ..., total: ... }, ... }
  let results = JSON.parse(localStorage.getItem('testResults') || '{}');
  const key = topic + '|' + variant;

  results[key] = {
    correctCount: correctCount,
    total: totalCount
  };

  localStorage.setItem('testResults', JSON.stringify(results));
}

/* ===== ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ ===== */
function showResults() {
  let results = JSON.parse(localStorage.getItem('testResults') || '{}');
  let output = '<ul>';
  for (let key in results) {
    const { correctCount, total } = results[key];
    output += `<li><strong>${key}</strong>: ${correctCount} из ${total} верно</li>`;
  }
  output += '</ul>';
  if (Object.keys(results).length === 0) {
    output = '<p>Пока нет сданных тестов.</p>';
  }
  document.getElementById('resultsArea').innerHTML = output;
}

/* ===== AI-БОТ (GPT) ===== */
async function sendMessage() {
  const userInput = document.getElementById('userInput');
  const userText = userInput.value.trim();
  if (!userText) return;

  addChatMessage('Пользователь', userText, 'user');
  userInput.value = '';

  try {
    const botReply = await getBotResponse(userText);
    addChatMessage('AI-бот', botReply, 'bot');
  } catch (error) {
    addChatMessage('AI-бот', 'Ошибка при вызове API: ' + error.message, 'bot');
  }
}

/* 
   В реальном продакшене вы НЕ храните API-ключ на фронте! 
   Здесь - только демонстрационный пример. 
*/
async function getBotResponse(userText) {
  const openaiApiKey = ''; // <-- Вставьте СВОЙ ключ
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const requestBody = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful assistant that explains Informatics topics.' },
      { role: 'user', content: userText }
    ],
    max_tokens: 256,
    temperature: 0.7
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Неизвестная ошибка API');
  }

  const data = await response.json();
  // Берём финальный ответ (assistant)
  return data.choices[0].message.content.trim();
}

/* ===== ОТОБРАЖАЕМ СООБЩЕНИЯ В ЧАТЕ ===== */
function addChatMessage(author, text, cssClass) {
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', cssClass);
  messageDiv.innerHTML = `<strong>${author}:</strong> ${text}`;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* ===== ОТПРАВКА ПО ENTER ===== */
function handleKeyPress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}