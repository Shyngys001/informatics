// ========================= GLOBALS ========================= //

// Храним данные о темах/вопросах (из questions.json)
let topicsData = null;

// Индекс текущей (активной) темы
let currentTopicIndex = 0;

// Массив ответов пользователя: userAnswers[i][j] – выбранный вариант на j-й вопрос темы i
let userAnswers = [];

// Массив, помечающий, пройдена ли тема (true/false)
let topicPassed = [];

// Массив с деталями по каждой теме (для пояснений)
let detailResults = [];

// Флаг, указывающий, что сейчас загружается объяснение от AI
let explanationLoading = false;

// ========================= ON LOAD ========================= //

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

// ========================= ИНИЦИАЛИЗАЦИЯ ========================= //

function initApp() {
  if (!topicsData || topicsData.length === 0) return;

  userAnswers = topicsData.map(() => []);    // Пустые ответы
  topicPassed = topicsData.map(() => false); // Все темы изначально не пройдены

  renderSidebar();
  showTopic(0);
}

/* Рендеринг левого меню с темами */
function renderSidebar() {
  const sidebar = document.getElementById('sidebarTopics');
  sidebar.innerHTML = '<h2>Тақырыптар:</h2>';

  topicsData.forEach((topic, index) => {
    const link = document.createElement('a');
    link.className = 'topic-link';
    link.textContent = `${index + 1}. ${topic.title}`;
    link.href = 'javascript:void(0)';
    link.onclick = () => {
      if (!isTopicLocked(index)) {
        showTopic(index);
      }
    };
    sidebar.appendChild(link);
  });

  updateSidebarLock();
}

/* Тема заблокирована, если предыдущая не пройдена */
function isTopicLocked(i) {
  if (i === 0) return false;
  return !topicPassed[i - 1];
}

/* Обновление классов ссылок в меню */
function updateSidebarLock() {
  const links = document.querySelectorAll('.topic-link');
  links.forEach((link, index) => {
    link.classList.remove('active', 'locked');
    if (isTopicLocked(index)) {
      link.classList.add('locked');
    }
    if (index === currentTopicIndex) {
      link.classList.add('active');
    }
  });
}

/* Отображение выбранной темы справа */
function showTopic(index) {
  currentTopicIndex = index;
  updateSidebarLock();

  const topic = topicsData[index];
  const container = document.getElementById('topicContent');

  let html = `
    <div class="topic-card">
      <h2>${topic.title}</h2>
  `;

  topic.questions.forEach((q, qIndex) => {
    const userAnswerIdx = userAnswers[index][qIndex] || -1;
    html += `
      <div class="question-block">
        <p>${qIndex + 1}. ${q.question}</p>
        <div class="answers">
    `;
    q.answers.forEach((answerText, aIndex) => {
      const checked = (userAnswerIdx === aIndex) ? 'checked' : '';
      html += `
        <label>
          <input type="radio" name="q_${qIndex}" value="${aIndex}" ${checked} />
          ${answerText}
        </label>
      `;
    });
    html += `</div></div>`;
  });

  html += `
      <button class="finish-btn" onclick="finishTest()">
        Тестті аяқтау
      </button>
    </div>
    <div id="resultsArea"></div>
  `;
  container.innerHTML = html;
}

// ========================= ЗАВЕРШЕНИЕ ТЕСТА ========================= //

async function finishTest() {
  const topic = topicsData[currentTopicIndex];
  const resultsArea = document.getElementById('resultsArea');

  // 1) Сохранить ответы
  topic.questions.forEach((q, qIndex) => {
    const radios = document.getElementsByName(`q_${qIndex}`);
    let chosen = -1;
    radios.forEach(r => {
      if (r.checked) {
        chosen = parseInt(r.value, 10);
      }
    });
    userAnswers[currentTopicIndex][qIndex] = chosen;
  });

  // 2) Проверить, все ли вопросы отвечены
  for (let i = 0; i < topic.questions.length; i++) {
    if (userAnswers[currentTopicIndex][i] === undefined || userAnswers[currentTopicIndex][i] < 0) {
      resultsArea.innerHTML = `<p style="color:red; font-weight:600;">Алдымен барлық сұрақтарға жауап беріңіз.</p>`;
      return;
    }
  }

  // 3) Формирование сводки результатов
  let correctCount = 0;
  detailResults = [];
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

  // Тема считается пройденной (если все вопросы отвечены)
  topicPassed[currentTopicIndex] = true;

  // 4) Генерируем HTML-результатов с кнопками "Түсініктемені көру"
  let summaryHTML = `
    <h3>Нәтиже: ${correctCount} / ${topic.questions.length} дұрыс</h3>
    <p style="color:green; font-weight:600;">Тест аяқталды. Келесі тақырыпқа өтуге болады.</p>
    <div class="results-summary">
  `;
  detailResults.forEach((dr, i) => {
    const userAnswerText = dr.answers[dr.userIndex];
    const correctAnswerText = dr.answers[dr.correctIndex];
    const isCorrect = (dr.userIndex === dr.correctIndex);
    const cssClass = isCorrect ? 'result-correct' : 'result-wrong';
    summaryHTML += `
      <div class="result-item ${cssClass}">
        <strong>Сұрақ:</strong> ${dr.question}<br/>
        <strong>Жауабыңыз:</strong> ${userAnswerText}<br/>
        <strong>Дұрыс жауап:</strong> ${correctAnswerText}<br/>
        <button class="explain-btn" onclick="showExplanation(${i})">Түсініктемені көру</button>
        <div id="explanation_${i}" class="explanation" style="display:none;"></div>
      </div>
    `;
  });
  summaryHTML += `</div>`;
  resultsArea.innerHTML = summaryHTML;

  // 5) Разблокировать следующую тему, если она есть
  if (currentTopicIndex < topicsData.length - 1) {
    updateSidebarLock();
  }
}

// ========================= ПОКАЗ ОБЪЯСНЕНИЯ ========================= //

async function showExplanation(i) {
  // Если уже идет загрузка какого-либо объяснения, не разрешаем новый запрос
  if (explanationLoading) {
    alert("Пожалуйста, дождитесь загрузки текущего ответа.");
    return;
  }

  const explanationEl = document.getElementById(`explanation_${i}`);
  
  // Если уже показан, скрываем
  if (explanationEl.style.display === 'block') {
    explanationEl.style.display = 'none';
    return;
  }
  
  // Если текст еще не загружен, делаем запрос
  if (!explanationEl.textContent.trim()) {
    explanationLoading = true;
    explanationEl.style.display = 'block';
    explanationEl.textContent = 'AI түсініктемесін жүктеу...';
    try {
      const dr = detailResults[i];
      const explanation = await getAiExplanation(
        dr.question,
        dr.answers[dr.userIndex],
        dr.answers[dr.correctIndex]
      );
      explanationEl.textContent = explanation;
    } catch (error) {
      explanationEl.textContent = 'AI түсініктемесін алу қате: ' + error.message;
    }
    explanationLoading = false;
    return;
  }
  
  // Если уже загружен, просто показываем
  explanationEl.style.display = 'block';
}

// ========================= GPT ФУНКЦИЯ ========================= //

async function getAiExplanation(questionText, userAnswerText, correctAnswerText) {
  const apiKey = ''; // <-- Замените на ваш действующий ключ или используйте серверную прокси
  const apiUrl = 'https://api.openai.com/v1/chat/completions';

  const systemMsg = {
    role: 'system',
    content: `Сен информатика сұрақтарының дұрыс жауабын түсіндіретін көмекшісің.`
  };
  const userMsg = {
    role: 'user',
    content: `
Сұрақ: ${questionText}

Пайдаланушының жауабы: ${userAnswerText}
Дұрыс жауап: ${correctAnswerText}

Неліктен ${correctAnswerText} дұрыс? 
Егер пайдаланушы қателескен болса, қатенің себебін түсіндір.
Қарапайым, түсінікті тілде жауап бер.`
  };

  const body = {
    model: 'gpt-4',          // Используем модель GPT-4
    messages: [systemMsg, userMsg],
    max_tokens: 700,         // Увеличенный лимит токенов для расширенного ответа
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
    throw new Error(err.error?.message || 'GPT API белгісіз қате');
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}