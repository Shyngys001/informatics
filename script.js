// Храним данные о темах/вопросах
let topicsData = null;

// Какой индекс темы сейчас активен
let currentTopicIndex = 0;

// Хранение ответов пользователя: answers[userTopicIndex] = массив выбранных индексов
// Если userAnswers[i][j] = x, то это ответ на j-й вопрос темы i
let userAnswers = [];

// Хранение "пройденных" тем (true/false)
let topicPassed = [];

document.addEventListener('DOMContentLoaded', () => {
  loadData();
});

/* Загрузка JSON с вопросами */
function loadData() {
  fetch('data/questions.json')
    .then(resp => resp.json())
    .then(data => {
      topicsData = data.topics;
      initApp();
    })
    .catch(err => console.error('Ошибка загрузки вопросов:', err));
}

/* Инициализация: создаём список тем (слева) и показываем первую тему */
function initApp() {
  if (!topicsData || topicsData.length === 0) return;

  // Заполняем массивы
  userAnswers = topicsData.map(t => []);   // пустые ответы
  topicPassed = topicsData.map(t => false); // все false

  renderSidebar();
  showTopic(0);
}

/* Генерируем левый список глав (тем) */
function renderSidebar() {
  const sidebar = document.getElementById('sidebarTopics');
  sidebar.innerHTML = '<h2>Тақырыптар:</h2>';

  topicsData.forEach((topic, index) => {
    const link = document.createElement('a');
    link.className = 'topic-link';
    link.textContent = `${index + 1}. ${topic.title}`;
    link.href = 'javascript:void(0)';

    link.onclick = () => {
      // Если тема не заблокирована, показываем её
      if (!isTopicLocked(index)) {
        showTopic(index);
      }
    };
    sidebar.appendChild(link);
  });

  updateSidebarLock();
}

/* Проверяет, заблокирована ли тема:
   тема i заблокирована, если i > 0 и предыдущая не пройдена */
function isTopicLocked(i) {
  if (i === 0) return false; // первая тема всегда доступна
  // Доступна, если предыдущая тема пройдена
  return !topicPassed[i - 1];
}

/* Обновляет класс ссылок (locked / active) */
function updateSidebarLock() {
  const links = document.querySelectorAll('.topic-link');
  links.forEach((link, index) => {
    link.classList.remove('active');
    link.classList.remove('locked');
    if (isTopicLocked(index)) {
      link.classList.add('locked');
    }
    if (index === currentTopicIndex) {
      link.classList.add('active');
    }
  });
}

/* Показываем тему (index) справа */
function showTopic(index) {
  currentTopicIndex = index;
  updateSidebarLock();

  const topic = topicsData[index];
  const container = document.getElementById('topicContent');

  // Генерируем HTML вопросов
  let html = `
    <div class="topic-card">
      <h2>${topic.title}</h2>
  `;

  topic.questions.forEach((q, qIndex) => {
    html += `
      <div class="question-block">
        <p>${qIndex + 1}. ${q.question}</p>
        <div class="answers">
    `;
    q.answers.forEach((answerText, aIndex) => {
      // проверим, не выбрал ли уже пользователь ответ
      const isChecked = userAnswers[index][qIndex] === aIndex ? 'checked' : '';
      html += `
        <label>
          <input type="radio" name="q_${qIndex}" value="${aIndex}" ${isChecked}/>
          ${answerText}
        </label>
      `;
    });
    html += `</div></div>`;
  });

  // Кнопка завершения теста
  html += `
      <button class="finish-btn" onclick="finishTest()">Завершить тест</button>
    </div>
    <div id="resultsArea"></div>
  `;

  container.innerHTML = html;
}

/* 
  По нажатию «Завершить тест»: 
    1) Сохраняем выбранные ответы 
    2) Проверяем, заполнены ли все вопросы 
    3) Разблокируем следующую главу (НЕ важно, сколько правильных ответов) 
    4) Выводим разбор с подсветкой правильного/неправильного ответа 
    5) Вызываем GPT для пояснений
*/
async function finishTest() {
  const topic = topicsData[currentTopicIndex];
  const resultsArea = document.getElementById('resultsArea');

  // 1) Собираем ответы
  topic.questions.forEach((q, qIndex) => {
    const radios = document.getElementsByName(`q_${qIndex}`);
    let chosen = -1;
    radios.forEach(r => {
      if (r.checked) chosen = parseInt(r.value, 10);
    });
    userAnswers[currentTopicIndex][qIndex] = chosen;
  });

  // 2) Проверяем, все ли вопросы отвечены
  for (let i = 0; i < topic.questions.length; i++) {
    if (userAnswers[currentTopicIndex][i] === undefined || userAnswers[currentTopicIndex][i] < 0) {
      resultsArea.innerHTML = `
        <p style="color:red;">
          Сначала ответьте на все вопросы, прежде чем завершить тест.
        </p>`;
      return;
    }
  }

  // 3) Формируем результаты (что верно, что нет)
  let correctCount = 0;
  const detailResults = [];

  for (let i = 0; i < topic.questions.length; i++) {
    const userIndex = userAnswers[currentTopicIndex][i];
    const correctIndex = topic.questions[i].correctIndex;
    const isCorrect = (userIndex === correctIndex);
    if (isCorrect) correctCount++;
    detailResults.push({
      question: topic.questions[i].question,
      userIndex,
      correctIndex,
      answers: topic.questions[i].answers
    });
  }

  // Считаем тему пройденной, раз все вопросы заполнены (НЕ важно, сколько правильных)
  topicPassed[currentTopicIndex] = true;

  // 4) Генерируем сводку
  let summaryHTML = `
    <h3>Результат теста: ${correctCount} / ${topic.questions.length} верно</h3>
    <p style="color:green;">
      Тест завершён. Теперь вы можете перейти к следующей главе.
    </p>
    <div class="results-summary">
  `;

  for (let i = 0; i < detailResults.length; i++) {
    const dr = detailResults[i];
    const userAnswerText = dr.answers[dr.userIndex];
    const correctAnswerText = dr.answers[dr.correctIndex];
    const isCorrect = (dr.userIndex === dr.correctIndex);

    // CSS для блока: зелёный если верно, красный если нет
    const cssClass = isCorrect ? 'result-correct' : 'result-wrong';
    summaryHTML += `<div class="result-item ${cssClass}">`;
    summaryHTML += `<strong>Вопрос:</strong> ${dr.question}<br/>`;
    summaryHTML += `<strong>Ваш ответ:</strong> ${userAnswerText}<br/>`;
    summaryHTML += `<strong>Правильный ответ:</strong> ${correctAnswerText}<br/>`;

    // Место для показа объяснения от GPT
    summaryHTML += `
      <div id="explanation_${i}" class="explanation">
        Идёт загрузка объяснения от AI...
      </div>
    `;

    summaryHTML += `</div>`;
  }
  summaryHTML += `</div>`;
  resultsArea.innerHTML = summaryHTML;

  // Асинхронно запрашиваем AI объяснение для каждого вопроса
  for (let i = 0; i < detailResults.length; i++) {
    const dr = detailResults[i];
    const userAnswerText = dr.answers[dr.userIndex];
    const correctAnswerText = dr.answers[dr.correctIndex];

    // Элемент, куда вставим пояснение
    const explanationEl = document.getElementById(`explanation_${i}`);
    try {
      const explanation = await getAiExplanation(
        dr.question, 
        userAnswerText, 
        correctAnswerText
      );
      explanationEl.textContent = explanation;
    } catch (err) {
      explanationEl.textContent = 'Ошибка при получении пояснения от AI: ' + err.message;
    }
  }

  // 5) Разблокируем следующую тему, если не последняя
  if (currentTopicIndex < topicsData.length - 1) {
    updateSidebarLock();
  }
}

/* ===== ПРИМЕР ВЫЗОВА GPT ДЛЯ ПОЛУЧЕНИЯ ОБЪЯСНЕНИЯ =====
   Лучше это делать на бэкенде, а не на фронте! 
   Здесь – только учебный пример.
*/
async function getAiExplanation(questionText, userAnswerText, correctAnswerText) {
  const apiKey = 'DUMMY_OPENAI_API_KEY'; // В реальном проекте НЕ хранить на фронте!
  const apiUrl = 'https://api.openai.com/v1/chat/completions';

  const systemMsg = {
    role: 'system',
    content: `Ты - помощник, который поясняет правильные ответы на вопросы по информатике.`
  };
  const userMsg = {
    role: 'user',
    content: `
Вопрос: ${questionText}

Ответ пользователя: ${userAnswerText}
Правильный ответ: ${correctAnswerText}

Объясни, почему правильный ответ именно ${correctAnswerText}, 
и в чём ошибка, если пользователь выбрал ${userAnswerText} (или в чём логика, если верно).
Используй простой, понятный язык.`
  };

  const body = {
    model: 'gpt-3.5-turbo',
    messages: [systemMsg, userMsg],
    max_tokens: 150,
    temperature: 0.7
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Неизвестная ошибка GPT API');
  }
  const data = await response.json();
  const assistantMsg = data.choices[0].message.content.trim();
  return assistantMsg;
}