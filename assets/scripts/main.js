document.addEventListener('DOMContentLoaded', () => {
  const authForm = document.getElementById('auth-form');
  const signupBtn = document.getElementById('signup-btn');
  const contactForm = document.getElementById('contact-form');
  const curriculumEl = document.getElementById('curriculum');
  const courseHeaderEl = document.getElementById('course-header');
  const accountCoursesEl = document.getElementById('account-courses');
  const achievementsListEl = document.getElementById('achievements-list');
  const topicsEl = document.getElementById('topics');
  const lessonsEl = document.getElementById('lessons');
  const lessonTitleEl = document.getElementById('lesson-title');
  const authNav = document.getElementById('auth-nav');

  // Simple auth state with localStorage
  function setAuthState(isAuthed) {
    localStorage.setItem('lq_authed', isAuthed ? '1' : '0');
    updateAuthNav();
  }
  function isAuthed() { return localStorage.getItem('lq_authed') === '1'; }
  function updateAuthNav() {
    const authLinks = document.querySelectorAll('[data-auth]');
    const logoutLinks = document.querySelectorAll('[data-logout]');
    const xpIndicator = document.getElementById('xp-indicator');
    if (xpIndicator) xpIndicator.textContent = `XP ${getXP()}`;
    if (isAuthed()) {
      authLinks.forEach(l=> l.style.display = 'none');
      logoutLinks.forEach(l=> l.style.display = '');
    } else {
      authLinks.forEach(l=> l.style.display = '');
      logoutLinks.forEach(l=> l.style.display = 'none');
    }
  }
  updateAuthNav();

  // Local-only mode (no backend sync)
  function getCurrentUserId() {
    return localStorage.getItem('lq_user_id') || 'local-user';
  }
  function setCurrentUserId(uid) {
    if (uid) localStorage.setItem('lq_user_id', uid);
  }

  // Remove API usage; keep helpers as no-ops
  async function apiGet() { return {}; }
  async function apiPost() { return { ok: true }; }

  // User state (localStorage only)
  async function loadUser() {
    if (localStorage.getItem('lq_xp') == null) localStorage.setItem('lq_xp', '0');
    if (!localStorage.getItem('lq_banner_selected')) localStorage.setItem('lq_banner_selected', 'default-white');
    updateGlobalIndicators();
  }

  // Build courses locally
  let COURSES = {};
  let COURSES_BY_ID = {};
  function buildCourseLocal(title, id) {
    const topicsBase = [
      { key: 'survival', title: 'Выживание: приветствия, покупки, кафе' },
      { key: 'daily', title: 'Повседневность: дом, работа, расписание' },
      { key: 'travel', title: 'Путешествия: транспорт, отели, ситуации' },
      { key: 'grammar', title: 'Грамматика: времена, модальные, конструкции' },
      { key: 'communication', title: 'Коммуникация: диалоги, small talk, email' }
    ];
    const course = { id, title, topics: topicsBase.map(t=>({ key: t.key, title: t.title, lessons: Array.from({length:20}, (_,i)=>({ id: `${t.key}-${i+1}`, title: `${t.title} ${i+1}` })) })) };
    return course;
  }
  function initCoursesLocal() {
    const list = [
      buildCourseLocal('Английский язык', 'english'),
      buildCourseLocal('Испанский язык', 'spanish'),
      buildCourseLocal('Немецкий язык', 'german'),
      buildCourseLocal('Французский язык', 'french')
    ];
    COURSES = Object.fromEntries(list.map(c => [c.title, c]));
    COURSES_BY_ID = Object.fromEntries(list.map(c => [c.id, c]));
  }

  function renderDynamicPages() {
    try {
      if (curriculumEl) {
        const lang = document.body.getAttribute('data-lang') || getParam('lang') || 'Английский язык';
        const course = COURSES[lang];
        if (course) {
          const prog = computeCourseProgress(course);
          if (courseHeaderEl) {
            courseHeaderEl.textContent = `Курс: ${course.title}`;
            const bar = document.querySelector('.progress-bar');
            if (bar) bar.style.width = `${prog.percent}%`;
            const label = document.getElementById('progress-label');
            if (label) label.textContent = `Завершено: ${prog.percent}%`;
          }
          curriculumEl.innerHTML = course.topics.map(topic => {
            const lessons = topic.lessons.map(lesson => {
              const done = !!loadProgress(course.id)[lesson.id];
              return `<li class="lesson"><label><input type="checkbox" data-course="${course.id}" data-lesson="${lesson.id}" ${done?'checked':''}> ${lesson.title}</label></li>`;
            }).join('');
            return `<section class="course-block"><h4>${topic.title}</h4><ul class="lessons">${lessons}</ul></section>`;
          }).join('');
        }
      }

      const courseIdAttr = document.body.getAttribute('data-course-id');
      if (topicsEl && courseIdAttr) {
        const course = COURSES_BY_ID[courseIdAttr];
        if (course) {
          const p = computeCourseProgress(course);
          const titleEl = document.getElementById('course-title');
          const barEl = document.getElementById('course-progress');
          const labelEl = document.getElementById('course-progress-label');
          if (titleEl) titleEl.textContent = `Курс: ${course.title}`;
          if (barEl) barEl.style.width = `${p.percent}%`;
          if (labelEl) labelEl.textContent = `${p.percent}% • ${p.done}/${p.total} уроков`;
          const progress = loadProgress(course.id);
          function topicPercent(topic) {
            const done = topic.lessons.filter(l => progress[l.id]).length;
            return Math.round((done / topic.lessons.length) * 100);
          }
          let unlocked = true;
          topicsEl.innerHTML = course.topics.map((t, idx) => {
            if (idx > 0) {
              const prev = course.topics[idx-1];
              const prevPercent = topicPercent(prev);
              unlocked = prevPercent >= 60;
            }
            const percent = topicPercent(t);
            const locked = !unlocked;
            const href = locked ? '#' : `/course/${course.id}/topic/${t.key}`;
            return `<a class="card course-card" ${locked? 'aria-disabled="true"' : ''} ${locked? 'data-locked="1"' : ''} href="${href}">
                      <h4>${t.title}</h4>
                      <div class="progress"><div class="progress-bar" style="width:${percent}%"></div></div>
                      <p class="muted">${percent}%</p>
                    </a>`;
          }).join('');
        }
      }

      const topicKeyAttr = document.body.getAttribute('data-topic-key');
      if (lessonsEl && courseIdAttr && topicKeyAttr) {
        const course = COURSES_BY_ID[courseIdAttr];
        if (course) {
          const topic = course.topics.find(t => t.key === topicKeyAttr) || course.topics[0];
          const titleEl = document.getElementById('topic-title');
          if (titleEl) titleEl.textContent = `${course.title} — ${topic.title}`;
          const progress = loadProgress(course.id);
          lessonsEl.innerHTML = topic.lessons.map((l, idx) => {
            const done = !!progress[l.id];
            const locked = idx > 0 && !progress[topic.lessons[idx-1].id];
            const href = locked ? '#' : `/course/${course.id}/lesson/${l.id}`;
            return `<a class="card course-card" ${locked? 'data-locked="1"' : ''} href="${href}">
                      <h4>${l.title}</h4>
                      <p class="muted">${done? 'Завершён' : locked? 'Заблокирован' : 'Доступен'}</p>
                    </a>`;
          }).join('');
        }
      }

      if (accountCoursesEl) {
        const courses = Object.values(COURSES_BY_ID);
        const visibleCourses = courses.slice(0, 2); // Show only first 2 courses by default
        const hiddenCourses = courses.slice(2);
        
        const visibleList = visibleCourses.map(c=>{
          const p = computeCourseProgress(c);
          return `<a class="card course-card" href="/course/${c.id}"><h4>${c.title}</h4><div class="progress"><div class="progress-bar" style="width:${p.percent}%"></div></div><p class="muted">${p.percent}% • ${p.done}/${p.total} уроков</p></a>`;
        }).join('');
        
        if (visibleList) accountCoursesEl.innerHTML = visibleList;
        
        // Show "Show all courses" button if there are hidden courses
        const showAllCoursesBtn = document.getElementById('show-all-courses');
        if (hiddenCourses.length > 0 && showAllCoursesBtn) {
          showAllCoursesBtn.style.display = 'block';
          showAllCoursesBtn.onclick = () => {
            const allList = courses.map(c=>{
              const p = computeCourseProgress(c);
              return `<a class="card course-card" href="/course/${c.id}"><h4>${c.title}</h4><div class="progress"><div class="progress-bar" style="width:${p.percent}%"></div></div><p class="muted">${p.percent}% • ${p.done}/${p.total} уроков</p></a>`;
            }).join('');
            accountCoursesEl.innerHTML = allList;
            showAllCoursesBtn.style.display = 'none';
          };
        }
      }
      renderLessonContent();
    } catch {}
  }

  // Bootstrap local mode
  initCoursesLocal();
  loadUser();
  updateAuthNav();
  renderDynamicPages();

  // Auth handlers (local only)
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email')?.value?.trim() || 'local-user';
      const uid = email.toLowerCase();
      setCurrentUserId(uid);
      setAuthState(true);
      window.location.href = '/account';
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const email = document.getElementById('email')?.value?.trim() || 'local-user';
      const uid = email.toLowerCase();
      setCurrentUserId(uid);
      setAuthState(true);
      if (!localStorage.getItem('lq_banner_selected')) localStorage.setItem('lq_banner_selected', 'default-white');
      window.location.href = '/account';
    });
  }

  if (authNav) {
    const logoutLink = authNav.querySelector('[data-logout]');
    if (logoutLink) {
      logoutLink.addEventListener('click', () => { setAuthState(false); });
    }
  }

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Спасибо! Мы свяжемся с вами.');
      contactForm.reset();
    });
  }

  // XP system
  function getXP() { return Number(localStorage.getItem('lq_xp')||'0'); }
  function addXP(amount) {
    const xp = getXP() + amount;
    localStorage.setItem('lq_xp', String(xp));
    const xpIndicator = document.getElementById('xp-indicator');
    if (xpIndicator) xpIndicator.textContent = `XP ${xp}`;
  }
  function xpToLevel(xp) {
    let level = 1;
    let need = 250;
    let remaining = xp;
    while (remaining >= need) {
      remaining -= need;
      level += 1;
      if (level > 5 && level % 1 === 0) {
        need += 50; // after level 5, +50 XP per level
      }
    }
    return { level, progress: remaining, nextNeed: need };
  }

  function updateGlobalIndicators() {
    const xp = getXP();
    const { level } = xpToLevel(xp);
    const xpIndicator = document.getElementById('xp-indicator');
    const lvlIndicator = document.getElementById('level-indicator');
    if (xpIndicator) xpIndicator.textContent = `XP ${xp}`;
    if (lvlIndicator) lvlIndicator.textContent = `LVL ${level}`;
    const accountLevel = document.getElementById('account-level');
    const accountXp = document.getElementById('account-xp');
    if (accountLevel) accountLevel.textContent = `LVL ${level}`;
    if (accountXp) accountXp.textContent = `${xp}`;
  }

  updateGlobalIndicators();

  // Progress storage (local)
  function storageKey(courseId) { return `lq_progress_${courseId}`; }
  function loadProgress(courseId) {
    try { return JSON.parse(localStorage.getItem(storageKey(courseId)) || '{}'); } catch { return {}; }
  }
  function saveProgress(courseId, data) {
    localStorage.setItem(storageKey(courseId), JSON.stringify(data));
  }

  function computeCourseProgress(course) {
    const prog = loadProgress(course.id);
    const total = course.topics.reduce((s,t)=>s+t.lessons.length,0);
    const done = Object.values(prog).filter(Boolean).length;
    const percent = Math.round((done/total)*100);
    const level = Math.floor(done / 10) + 1;
    return { done, total, percent, level };
  }

  // Stats for achievements
  function incrStat(key) {
    const map = JSON.parse(localStorage.getItem('lq_stats')||'{}');
    map[key] = (map[key]||0)+1;
    localStorage.setItem('lq_stats', JSON.stringify(map));
  }
  function getStat(key) {
    const map = JSON.parse(localStorage.getItem('lq_stats')||'{}');
    return map[key]||0;
  }

  // Gradient banners only (no images)
  function gradientForBanner(id) {
    switch (id) {
      case 'default-white': return 'linear-gradient(0deg, #ffffff, #ffffff)';
      case 'bnr-1': return 'linear-gradient(90deg, #bfdbfe, #93c5fd)';
      case 'bnr-2': return 'linear-gradient(90deg, #bbf7d0, #86efac)';
      case 'bnr-3': return 'linear-gradient(90deg, #e9d5ff, #c4b5fd)';
      case 'bnr-4': return 'linear-gradient(90deg, #fde68a, #fca5a5)';
      case 'banner-lvl-2': return 'linear-gradient(90deg, #c7d2fe, #a7f3d0)';
      case 'banner-lvl-4': return 'linear-gradient(90deg, #93c5fd, #fbcfe8)';
      case 'banner-lvl-6': return 'linear-gradient(90deg, #86efac, #fde68a)';
      case 'banner-lvl-8': return 'linear-gradient(90deg, #fda4af, #c4b5fd)';
      case 'banner-lvl-10': return 'linear-gradient(90deg, #34d399, #60a5fa)';
      default: return 'linear-gradient(90deg, #c7d2fe, #fde68a)';
    }
  }
  // Shop rendering (local)
  const shopEl = document.getElementById('shop-items');
  if (shopEl) {
    const items = [
      { id:'bnr-1', name:'Баннер #1', price:500 },
      { id:'bnr-2', name:'Баннер #2', price:800 },
      { id:'bnr-3', name:'Баннер #3', price:1200 },
      { id:'bnr-4', name:'Баннер #4', price:1500 }
    ];
    const owned = new Set(JSON.parse(localStorage.getItem('lq_banners')||'[]'));
    shopEl.innerHTML = items.map(it => {
      const has = owned.has(it.id);
      const style = `style=\"background:${gradientForBanner(it.id)}\"`;
      return `<div class=\"card banner-card\">\n                <div class=\"banner\" ${style}></div>\n                <h4>${it.name}</h4>\n                <p class=\"muted\">Цена: ${it.price} XP</p>\n                <div class=\"actions\">\n                  ${has ? '<span class=\"badge\">Уже куплено</span>' : `<button type=\"button\" class=\"button primary\" data-buy=\"${it.id}\" data-price=\"${it.price}\">Купить</button>`}\n                </div>\n              </div>`;
    }).join('');
    shopEl.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-buy]');
      if (!btn) return;
      const id = btn.getAttribute('data-buy');
      const price = Number(btn.getAttribute('data-price'));
      const xp = getXP();
      if (xp < price) { toast('Недостаточно XP'); return; }
      localStorage.setItem('lq_xp', String(xp - price));
      const list = new Set(JSON.parse(localStorage.getItem('lq_banners')||'[]'));
      list.add(id);
      localStorage.setItem('lq_banners', JSON.stringify(Array.from(list)));
      updateGlobalIndicators();
      confirmModal('Покупка успешна! Выбрать баннер сейчас?', 'Выбрать', ()=>{
        localStorage.setItem('lq_banner_selected', id);
        window.location.href = '/account';
      });
    });
  }

  // Render course details
  if (curriculumEl) {
    const lang = document.body.getAttribute('data-lang') || getParam('lang') || 'Английский язык';
    const course = COURSES[lang] || COURSES['Английский язык'];
    const prog = computeCourseProgress(course);
    if (courseHeaderEl) {
      courseHeaderEl.textContent = `Курс: ${course.title}`;
      const bar = document.querySelector('.progress-bar');
      if (bar) bar.style.width = `${prog.percent}%`;
      const label = document.getElementById('progress-label');
      if (label) label.textContent = `Завершено: ${prog.percent}%`;
    }
    curriculumEl.innerHTML = course.topics.map(topic => {
      const lessons = topic.lessons.map(lesson => {
        const done = !!loadProgress(course.id)[lesson.id];
        return `<li class="lesson"><label><input type="checkbox" data-course="${course.id}" data-lesson="${lesson.id}" ${done?'checked':''}> ${lesson.title}</label></li>`;
      }).join('');
      return `<section class="course-block"><h4>${topic.title}</h4><ul class="lessons">${lessons}</ul></section>`;
    }).join('');
    curriculumEl.addEventListener('change', (e)=>{
      const input = e.target;
      if (input && input.matches('input[type="checkbox"][data-lesson]')) {
        const courseId = input.getAttribute('data-course');
        const lessonId = input.getAttribute('data-lesson');
        const prog = loadProgress(courseId);
        prog[lessonId] = input.checked;
        saveProgress(courseId, prog);
        const c = Object.values(prog).filter(Boolean).length;
        const total = Object.values(COURSES).find(c=>c.id===courseId).topics.reduce((s,t)=>s+t.lessons.length,0);
        const percent = Math.round((c/total)*100);
        const bar = document.querySelector('.progress-bar');
        if (bar) bar.style.width = `${percent}%`;
        const label = document.getElementById('progress-label');
        if (label) label.textContent = `Завершено: ${percent}%`;
      }
    });
  }

  // Render course page (topics list with gating)
  const courseIdAttr = document.body.getAttribute('data-course-id');
  if (topicsEl && courseIdAttr) {
    const course = COURSES_BY_ID[courseIdAttr] || Object.values(COURSES).find(c => c.id === courseIdAttr) || COURSES['Английский язык'];
    if (course) {
      const p = computeCourseProgress(course);
      const titleEl = document.getElementById('course-title');
      const barEl = document.getElementById('course-progress');
      const labelEl = document.getElementById('course-progress-label');
      if (titleEl) titleEl.textContent = `Курс: ${course.title}`;
      if (barEl) barEl.style.width = `${p.percent}%`;
      if (labelEl) labelEl.textContent = `${p.percent}% • ${p.done}/${p.total} уроков`;

      const progress = loadProgress(course.id);
      function topicPercent(topic) {
        const done = topic.lessons.filter(l => progress[l.id]).length;
        return Math.round((done / topic.lessons.length) * 100);
      }
      let unlocked = true;
      topicsEl.innerHTML = course.topics.map((t, idx) => {
        if (idx > 0) {
          const prev = course.topics[idx-1];
          const prevPercent = topicPercent(prev);
          unlocked = prevPercent >= 60;
        }
        const percent = topicPercent(t);
        const locked = !unlocked;
        const href = locked ? '#' : `/course/${course.id}/topic/${t.key}`;
        return `<a class="card course-card" ${locked? 'aria-disabled="true"' : ''} ${locked? 'data-locked="1"' : ''} href="${href}">
                  <h4>${t.title}</h4>
                  <div class="progress"><div class="progress-bar" style="width:${percent}%"></div></div>
                  <p class="muted">${percent}%</p>
                </a>`;
      }).join('');
      topicsEl.addEventListener('click', (e)=>{
        const a = e.target.closest('a[data-locked="1"]');
        if (a) { e.preventDefault(); alert('Эта тема откроется после 60% прогресса в предыдущей теме.'); }
      });
    }
  }

  // Render topic page (lessons cards with gating within topic)
  const topicKeyAttr = document.body.getAttribute('data-topic-key');
  if (lessonsEl && courseIdAttr && topicKeyAttr) {
    const course = Object.values(COURSES).find(c => c.id === courseIdAttr) || COURSES['Английский язык'];
    const topic = course.topics.find(t => t.key === topicKeyAttr) || course.topics[0];
    const titleEl = document.getElementById('topic-title');
    if (titleEl) titleEl.textContent = `${course.title} — ${topic.title}`;
    const progress = loadProgress(course.id);
    lessonsEl.innerHTML = topic.lessons.map((l, idx) => {
      const done = !!progress[l.id];
      const locked = idx > 0 && !progress[topic.lessons[idx-1].id];
      const href = locked ? '#' : `/course/${course.id}/lesson/${l.id}`;
      return `<a class="card course-card" ${locked? 'data-locked="1"' : ''} href="${href}">
                <h4>${l.title}</h4>
                <p class="muted">${done? 'Завершён' : locked? 'Заблокирован' : 'Доступен'}</p>
              </a>`;
    }).join('');
    lessonsEl.addEventListener('click', (e)=>{
      const a = e.target.closest('a[data-locked="1"]');
      if (a) {
        e.preventDefault();
        alert('Откройте предыдущий урок, чтобы продолжить.');
      }
    });
  }

  // Render lesson page with mini-games and completion (refactored)
  function renderLessonContent() {
    const lessonIdAttr = document.body.getAttribute('data-lesson-id');
    const courseIdAttr = document.body.getAttribute('data-course-id');
    if (!(lessonIdAttr && courseIdAttr)) return;
    const course = COURSES_BY_ID[courseIdAttr] || Object.values(COURSES).find(c => c.id === courseIdAttr);
    if (!course) return; // wait until courses loaded
    const lessonTitleEl = document.getElementById('lesson-title');

    let foundLesson;
    for (const t of course.topics) {
      const l = t.lessons.find(x => x.id === lessonIdAttr);
      if (l) { foundLesson = { topic: t, lesson: l }; break; }
    }
    if (foundLesson && lessonTitleEl) lessonTitleEl.textContent = `${foundLesson.lesson.title}`;

    // Scoring
    let totalPoints = 0;
    let maxPoints = 0;
    const scoreLabel = document.getElementById('lesson-score');
    const finishBtn = document.getElementById('finish-lesson');
    function updateScore(delta) {
      totalPoints += delta;
      if (scoreLabel) {
        const pct = Math.round((totalPoints / Math.max(1,maxPoints)) * 100);
        scoreLabel.textContent = `Баллы: ${totalPoints}/${maxPoints} • Пройдено: ${pct}% (нужно 50%)`;
      }
      if (finishBtn) {
        const pct = (totalPoints / Math.max(1,maxPoints)) * 100;
        finishBtn.disabled = pct < 50;
      }
    }

    // Language‑specific content
    function getContentPack(courseId, topicKey) {
      const EN = {
        survival: { words: [['menu','меню'],['bill','счёт'],['water','вода'],['table','стол'],['tea','чай']], listen:['Can I have the menu?','Where is the bank?','How old are you?'], listenAns:0, grammar:['I would like to ____ tea, please.', ['a','an','some'], 2], order:['please I the bill would like','I would like the bill please'] },
        daily: { words: [['clean','убирать'],['cook','готовить'],['schedule','расписание'],['meeting','встреча'],['laundry','стирка']], listen:['I have a meeting at 10.','Where is the station?','Do you like tea?'], listenAns:0, grammar:['She ____ to the gym on Mondays.', ['go','goes','going'], 1], order:['usually I work from home','I usually work from home'] },
        travel: { words: [['boarding pass','посадочный талон'],['gate','выход'],['delay','задержка'],['reservation','бронь'],['luggage','багаж']], listen:['What time is boarding?','How much is this?','Do you cook?'], listenAns:0, grammar:['Our flight was ____ by two hours.', ['delay','delayed','delaying'], 1], order:['late we are boarding','we are boarding late'] },
        grammar: { words: [['present','настоящее'],['past','прошедшее'],['future','будущее'],['modal','модальный'],['tense','время']], listen:['He has finished his work.','He finish his work.','He finishing his work.'], listenAns:0, grammar:['They ____ already eaten.', ['has','have','had'], 1], order:['rains it when I stay home','when it rains I stay home'] },
        communication: { words: [['feedback','обратная связь'],['presentation','презентация'],['agenda','повестка'],['reply','ответ'],['CC','копия']], listen:['Could you send me the agenda?','How old is your sister?','This is a red apple.'], listenAns:0, grammar:['Please, ____ to this email by Friday.', ['reply','replies','replied'], 0], order:['feedback your appreciate we','we appreciate your feedback'] }
      };
      const ES = {
        survival: { words: [['menú','меню'],['cuenta','счёт'],['agua','вода'],['mesa','стол'],['té','чай']], listen:['¿Me trae el menú, por favor?','¿Dónde está el banco?','¿Cuántos años tienes?'], listenAns:0, grammar:['Quiero ____ agua.', ['un','una','algo de'], 2], order:['la cuenta por favor','por favor la cuenta'] },
        daily: { words: [['limpiar','убирать'],['cocinar','готовить'],['horario','расписание'],['reunión','встреча'],['lavandería','стирка']], listen:['Tengo una reunión a las 10.','¿Dónde está la estación?','¿Te gusta el té?'], listenAns:0, grammar:['Ella ____ al gimnasio los lunes.', ['va','voy','vamos'], 0], order:['normalmente trabajo desde casa','trabajo normalmente desde casa'] },
        travel: { words: [['tarjeta de embarque','посадочный талон'],['puerta','выход'],['retraso','задержка'],['reserva','бронь'],['equipaje','багаж']], listen:['¿A qué hora embarcamos?','¿Cuánto cuesta?','¿Cocinas?'], listenAns:0, grammar:['Nuestro vuelo fue ____ dos horas.', ['retraso','retrasado','retrasando'], 1], order:['estamos embarcando tarde','estamos embarcando tarde'] },
        grammar: { words: [['presente','настоящее'],['pasado','прошедшее'],['futuro','будущее'],['modal','модальный'],['tiempo','время']], listen:['Él ha terminado su trabajo.','Él terminar su trabajo.','Él terminando su trabajo.'], listenAns:0, grammar:['Ellos ____ comido.', ['han','ha','habían'], 0], order:['cuando llueve me quedo en casa','me quedo en casa cuando llueve'] },
        communication: { words: [['retroalimentación','обратная связь'],['presentación','презентация'],['orden del día','повестка'],['responder','ответить'],['copia','копия']], listen:['¿Podrías enviarme el orden del día?','¿Cuántos años tiene tu hermana?','Esto es una manzana roja.'], listenAns:0, grammar:['Por favor, ____ a este correo antes del viernes.', ['responde','responder','respondas'], 1], order:['apreciamos tus comentarios','apreciamos tus comentarios'] }
      };
      const DE = {
        survival: { words: [['Speisekarte','меню'],['Rechnung','счёт'],['Wasser','вода'],['Tisch','стол'],['Tee','чай']], listen:['Kann ich die Speisekarte haben?','Wo ist die Bank?','Wie alt bist du?'], listenAns:0, grammar:['Ich möchte ____ Tee.', ['ein','eine','etwas'], 2], order:['die rechnung bitte','bitte die rechnung'] },
        daily: { words: [['putzen','убирать'],['kochen','готовить'],['Stundenplan','расписание'],['Besprechung','встреча'],['Wäsche','стирка']], listen:['Ich habe um 10 Uhr eine Besprechung.','Wo ist der Bahnhof?','Magst du Tee?'], listenAns:0, grammar:['Sie ____ montags ins Fitnessstudio.', ['geht','gehe','gehen'], 0], order:['ich arbeite normalerweise von zu hause','normalerweise arbeite ich von zu hause'] },
        travel: { words: [['Bordkarte','посадочный талон'],['Gate','выход'],['Verspätung','задержка'],['Reservierung','бронь'],['Gepäck','багаж']], listen:['Wann ist Boarding?','Wie viel kostet das?','Kochst du?'], listenAns:0, grammar:['Unser Flug wurde um zwei Stunden ____ .', ['verspätet','verspätung','verspätend'], 0], order:['wir boarden spät','wir boarden spät'] },
        grammar: { words: [['Gegenwart','настоящее'],['Vergangenheit','прошедшее'],['Zukunft','будущее'],['Modal','модальный'],['Zeit','время']], listen:['Er hat seine Arbeit beendet.','Er beenden seine Arbeit.','Er beendend seine Arbeit.'], listenAns:0, grammar:['Sie ____ schon gegessen.', ['haben','hat','hattet'], 0], order:['wenn es regnet bleibe ich zu hause','ich bleibe zu hause wenn es regnet'] },
        communication: { words: [['Feedback','обратная связь'],['Präsentation','презентация'],['Agenda','повестка'],['Antwort','ответ'],['Kopie','копия']], listen:['Könnten Sie mir die Agenda schicken?','Wie alt ist deine Schwester?','Das ist ein roter Apfel.'], listenAns:0, grammar:['Bitte ____ Sie bis Freitag auf diese E‑Mail.', ['antworten','antwortet','antwortete'], 0], order:['wir schätzen ihr feedback','wir schätzen Ihr Feedback'] }
      };
      const FR = {
        survival: { words: [['menu','меню'],['addition','счёт'],['eau','вода'],['table','стол'],['thé','чай']], listen:['Puis‑je avoir le menu ?','Où est la banque ?','Quel âge as‑tu ?'], listenAns:0, grammar:['Je voudrais ____ du thé.', ['un','une','du'], 2], order:["l'addition s'il vous plaît","l'addition s'il vous plaît"] },
        daily: { words: [['nettoyer','убирать'],['cuisiner','готовить'],['emploi du temps','расписание'],['réunion','встреча'],['linge','стирка']], listen:["J'ai une réunion à 10h.",'Où est la gare ?','Tu aimes le thé ?'], listenAns:0, grammar:['Elle ____ à la salle de sport le lundi.', ['va','vais','vont'], 0], order:['je travaille généralement à la maison','je travaille à la maison généralement'] },
        travel: { words: [["carte d'embarquement",'посадочный талон'],['porte','выход'],['retard','задержка'],['réservation','бронь'],['bagages','багаж']], listen:["À quelle heure embarque‑t‑on ?",'Combien ça coûte ?','Tu cuisines ?'], listenAns:0, grammar:['Notre vol a été ____ de deux heures.', ['retard','retardé','retardant'], 1], order:['nous embarquons tard','nous embarquons tard'] },
        grammar: { words: [['présent','настоящее'],['passé','прошедшее'],['futur','будущее'],['modal','модальный'],['temps','время']], listen:['Il a fini son travail.','Il finir son travail.','Il finissant son travail.'], listenAns:0, grammar:['Ils ____ déjà mangé.', ['ont','a','avaient'], 0], order:['quand il pleut je reste à la maison','je reste à la maison quand il pleut'] },
        communication: { words: [['retour','обратная связь'],['présentation','презентация'],["ordre du jour",'повестка'],['répondre','ответить'],['copie','копия']], listen:["Peux‑tu m'envoyer l'ordre du jour ?",'Quel âge a ta sœur ?','Ceci est une pomme rouge.'], listenAns:0, grammar:['Veuillez ____ à ce mail avant vendredi.', ['répondre','réponds','répondu'], 0], order:['nous apprécions vos retours','nous apprécions vos retours'] }
      };
      const LANG_MAP = { english: EN, spanish: ES, german: DE, french: FR };
      const pack = LANG_MAP[courseId] || EN;
      const t = pack[topicKey] || EN[topicKey];
      return {
        wordPairs: t.words,
        listening: { options: t.listen, answer: t.listenAns },
        grammar: { text: t.grammar[0], options: t.grammar[1], answer: t.grammar[2] },
        extra: { type: 'orderSentence', text: t.order[0], solution: t.order[1] }
      };
    }

    // Detect topic from lesson id
    const topicKey = (lessonIdAttr || '').split('-')[0];
    const pack = getContentPack(course.id, topicKey);

    // Mini-game: Word Match
    const wordMatch = document.getElementById('word-match');
    if (wordMatch) {
      const pairs = pack.wordPairs;
      wordMatch.innerHTML = `<div class="match-grid">
        <div class="match-col">${pairs.map((p,i)=>`<div class="pill" draggable="true" data-word="${p[0]}">${p[0]}</div>`).join('')}</div>
        <div class="match-col">${pairs.map((p,i)=>`<div class="slot" data-target="${p[0]}">${p[1]}</div>`).join('')}</div>
      </div>`;
      let correct = 0;
      maxPoints += pairs.length;
      wordMatch.addEventListener('dragstart', e=>{
        if (e.target.classList.contains('pill')) {
          e.dataTransfer.setData('text/plain', e.target.getAttribute('data-word'));
        }
      });
      wordMatch.addEventListener('dragover', e=>{ e.preventDefault(); });
      wordMatch.addEventListener('drop', e=>{
        const slot = e.target.closest('.slot');
        if (!slot) return;
        const word = e.dataTransfer.getData('text/plain');
        if (slot.getAttribute('data-target') === word && !slot.classList.contains('ok')) {
          slot.classList.add('ok');
          slot.innerHTML = `✔ ${slot.textContent}`;
          correct++;
          updateScore(1);
          incrStat('wordmatch');
        }
      });
    }

    // Mini-game: Listening Quest
    const listening = document.getElementById('listening-quest');
    if (listening) {
      const q = { audio: null, options: pack.listening.options, answer: pack.listening.answer };
      listening.innerHTML = q.options.map((opt,i)=>`<label class="radio"><input type="radio" name="listen" value="${i}"> ${opt}</label>`).join('');
      maxPoints += 1;
      listening.addEventListener('change', (e)=>{
        const v = Number(e.target.value);
        if (!listening._answered) {
          listening._answered = true;
          updateScore(v === q.answer ? 1 : 0);
          if (v === q.answer) incrStat('listening');
        }
      });
    }

    // Mini-game: Grammar Sprint
    const grammar = document.getElementById('grammar-sprint');
    // Extra Mini-game: Order the sentence
    if (pack.extra && pack.extra.type === 'orderSentence') {
      const container = document.createElement('div');
      container.className = 'card';
      container.innerHTML = `<h3>Мини‑игра: Порядок слов</h3><p class="muted">Соберите предложение по смыслу</p><div id="order-sentence"></div>`;
      const grid = document.querySelector('.card-grid');
      if (grid) grid.appendChild(container);
      const os = document.getElementById('order-sentence');
      if (os) {
        const words = pack.extra.text.split(' ');
        const target = document.createElement('div');
        target.className = 'match-col';
        const source = document.createElement('div');
        source.className = 'match-col';
        os.appendChild(source); os.appendChild(target);
        words.forEach(w => {
          const pill = document.createElement('div');
          pill.className = 'pill';
          pill.draggable = true;
          pill.textContent = w;
          source.appendChild(pill);
        });
        maxPoints += 1;
        os.addEventListener('dragstart', e=>{ if (e.target.classList.contains('pill')) e.dataTransfer.setData('text/plain', e.target.textContent); });
        os.addEventListener('dragover', e=>{ e.preventDefault(); });
        os.addEventListener('drop', e=>{
          e.preventDefault();
          const word = e.dataTransfer.getData('text/plain');
          const pill = Array.from(source.children).find(x=>x.textContent===word);
          if (pill) target.appendChild(pill);
          const built = Array.from(target.children).map(x=>x.textContent).join(' ');
          if (built.trim().toLowerCase() === pack.extra.solution.toLowerCase()) {
            updateScore(1);
          }
        });
      }
    }
    if (grammar) {
      const questions = [
        { text: pack.grammar.text, options: pack.grammar.options, answer: pack.grammar.answer },
        { text: 'They ____ TV now.', options: ['watch','are watching','watched'], answer: 1 },
        { text: 'I ____ coffee every morning.', options: ['drink','drinks','am drink'], answer: 0 }
      ];
      maxPoints += questions.length;
      grammar.innerHTML = questions.map((q,qi)=>{
        const buttons = q.options.map((o,i)=>`<button class="button ghost" type="button" data-gs-q="${qi}" data-gs="${i}">${o}</button>`).join(' ');
        return `<div class="gs-q"><p>${q.text}</p>${buttons}</div>`;
      }).join('');
      const answered = new Set();
      grammar.addEventListener('click', (e)=>{
        const btn = e.target.closest('[data-gs]');
        if (!btn) return;
        const qi = btn.getAttribute('data-gs-q');
        if (answered.has(qi)) return;
        answered.add(qi);
        const v = Number(btn.getAttribute('data-gs'));
        const correct = questions[qi].answer;
        if (v === correct) { btn.style.borderColor = '#20c997'; incrStat('grammar'); } else { btn.style.borderColor = '#ff6b6b'; }
        updateScore(v === correct ? 1 : 0);
      });
    }

    // use single finishBtn declaration earlier
    if (finishBtn) {
      updateScore(0);
      finishBtn.addEventListener('click', async () => {
        const prog = loadProgress(course.id);
        prog[lessonIdAttr] = true;
        saveProgress(course.id, prog);
        addXP(250);
        // In lesson finish we removed API sync, only local addXP
        awardAchievementsAfterLesson(course.id);
        toast('Урок завершён! +250 XP');
        updateGlobalIndicators();
        const topicKey = foundLesson ? foundLesson.topic.key : '';
        window.location.href = `/course/${course.id}/topic/${topicKey}`;
      });
    }
  }

  // Achievements
  const ACHIEVEMENTS = [
    { id: 'first-lesson', title: 'Первый шаг', desc: 'Завершите первый урок' },
    { id: 'streak-5', title: 'Серийный ученик', desc: '5 уроков подряд' },
    { id: 'topic-60', title: 'Тематический профи', desc: '60% прогресса в теме' },
    { id: 'course-100', title: 'Покоритель курса', desc: '100% курса' },
    { id: 'lvl-5', title: 'Лёгкий старт', desc: 'Достигните 5 уровня' },
    { id: 'lvl-10', title: 'Уверенный', desc: 'Достигните 10 уровня' },
    { id: 'lvl-15', title: 'Продвинутый', desc: 'Достигните 15 уровня' },
    { id: 'lvl-20', title: 'Мастер', desc: 'Достигните 20 уровня' },
    { id: 'xp-1000', title: 'Тысяча XP', desc: 'Накопите 1000 XP' },
    { id: 'xp-5000', title: 'Пять тысяч XP', desc: 'Накопите 5000 XP' },
    { id: 'perfect-lesson', title: 'Идеалист', desc: 'Наберите 100% в уроке' },
    { id: 'week-7', title: 'Неделя без пропусков', desc: '7 уроков подряд' },
    { id: 'topics-3', title: 'Три темы', desc: 'Завершите 3 темы на 60%' },
    { id: 'wordmatch-50', title: 'Лингвист', desc: 'Соотнесите 50 слов' },
    { id: 'grammar-30', title: 'Граммар-наци', desc: '30 правильных грамм. ответов' },
    { id: 'listening-20', title: 'Острый слух', desc: '20 правильных слушаний' },
    { id: 'shop-first', title: 'Покупатель', desc: 'Совершите первую покупку' },
    { id: 'banner-3', title: 'Коллекционер', desc: 'Соберите 3 баннера' },
    { id: 'daily-10', title: 'Ежедневный', desc: '10 дней подряд' },
    { id: 'speed-run', title: 'Спринтер', desc: 'Урок за 2 минуты' }
  ];
  function loadAch() { try { return JSON.parse(localStorage.getItem('lq_achievements')||'[]'); } catch { return []; } }
  function saveAch(list) { localStorage.setItem('lq_achievements', JSON.stringify(list)); }
  function hasAch(id) { return loadAch().includes(id); }
  function grantAch(id) { const a = loadAch(); if (!a.includes(id)) { a.push(id); saveAch(a); toast(`Достижение: ${ACHIEVEMENTS.find(x=>x.id===id).title}`); } }
  // Modal toast
  function toast(msg) {
    let el = document.getElementById('lq-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lq-modal';
      el.innerHTML = `<div class="modal"><div class="modal-body"><div id="lq-modal-text"></div><div class="actions"><button id="lq-modal-ok" class="button primary" type="button">OK</button></div></div></div>`;
      document.body.appendChild(el);
      el.querySelector('#lq-modal-ok').addEventListener('click', ()=>{ el.classList.remove('show'); });
    }
    el.querySelector('#lq-modal-text').textContent = msg;
    el.classList.add('show');
  }
  function confirmModal(msg, okLabel, onOk) {
    let el = document.getElementById('lq-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lq-modal';
      el.innerHTML = `<div class="modal"><div class="modal-body"><div id="lq-modal-text"></div><div class="actions"><button id="lq-modal-ok" class="button primary" type="button">OK</button></div></div></div>`;
      document.body.appendChild(el);
    }
    el.querySelector('#lq-modal-text').textContent = msg;
    const okBtn = el.querySelector('#lq-modal-ok');
    okBtn.textContent = okLabel || 'OK';
    const handler = ()=>{ el.classList.remove('show'); okBtn.removeEventListener('click', handler); if (onOk) onOk(); };
    okBtn.addEventListener('click', handler);
    el.classList.add('show');
  }
  function awardAchievementsAfterLesson(courseId) {
    // first lesson
    if (!hasAch('first-lesson')) grantAch('first-lesson');
    // streak 5: naive counter
    const streak = Number(localStorage.getItem('lq_streak')||'0') + 1;
    localStorage.setItem('lq_streak', String(streak));
    if (streak >= 5) grantAch('streak-5');
    // topic 60 and course 100 checks
    const course = Object.values(COURSES).find(c=>c.id===courseId);
    const p = computeCourseProgress(course);
    if (p.percent === 100) grantAch('course-100');
    // banners every 2 levels
    const owned = new Set(JSON.parse(localStorage.getItem('lq_banners')||'[]'));
    if (p.level % 2 === 0) {
      const bannerId = `banner-lvl-${p.level}`;
      if (!owned.has(bannerId)) {
        owned.add(bannerId);
        localStorage.setItem('lq_banners', JSON.stringify(Array.from(owned)));
        toast(`Новый баннер за уровень ${p.level}!`);
      }
    }
    for (const t of course.topics) {
      const prog = loadProgress(course.id);
      const done = t.lessons.filter(l => prog[l.id]).length;
      const pct = Math.round(done / t.lessons.length * 100);
      if (pct >= 60) { grantAch('topic-60'); break; }
    }
  }

  // Render achievements on account page
  if (achievementsListEl) {
    const owned = loadAch();
    const ownedAchievements = ACHIEVEMENTS.filter(a => owned.includes(a.id));
    const unownedAchievements = ACHIEVEMENTS.filter(a => !owned.includes(a.id));
    
    // Show only owned achievements by default, or first 2 if none owned
    const visibleAchievements = ownedAchievements.length > 0 ? ownedAchievements.slice(0, 2) : ACHIEVEMENTS.slice(0, 2);
    const hiddenAchievements = ownedAchievements.length > 0 ? 
      [...ownedAchievements.slice(2), ...unownedAchievements] : 
      ACHIEVEMENTS.slice(2);
    
    achievementsListEl.innerHTML = visibleAchievements.map(a => {
      const has = owned.includes(a.id);
      return `<div class="card" ${has? '' : 'style="opacity:.6"'}>
                <h4>${a.title} ${has? '🏆' : ''}</h4>
                <p class="muted">${a.desc}</p>
              </div>`;
    }).join('');
    
    // Show "Show all achievements" button if there are hidden achievements
    const showAllAchievementsBtn = document.getElementById('show-all-achievements');
    if (hiddenAchievements.length > 0 && showAllAchievementsBtn) {
      showAllAchievementsBtn.style.display = 'block';
      showAllAchievementsBtn.onclick = () => {
        achievementsListEl.innerHTML = ACHIEVEMENTS.map(a => {
          const has = owned.includes(a.id);
          return `<div class="card" ${has? '' : 'style="opacity:.6"'}>
                    <h4>${a.title} ${has? '🏆' : ''}</h4>
                    <p class="muted">${a.desc}</p>
                  </div>`;
        }).join('');
        showAllAchievementsBtn.style.display = 'none';
      };
    }
  }

  // Banners in settings and profile
  const bannersEl = document.getElementById('banners');
  if (bannersEl) {
    const owned = new Set(JSON.parse(localStorage.getItem('lq_banners')||'[]'));
    // default white is always available
    const list = ['default-white', ...Array.from(owned)];
    const selected = localStorage.getItem('lq_banner_selected') || 'default-white';
    bannersEl.innerHTML = list.map((id) => {
      const style = `style=\"background:${gradientForBanner(id)}\"`;
      const label = id === 'default-white' ? 'Белый (по умолчанию)' : id;
      return `<div class=\"banner-card card\">\n                <div class=\"banner\" ${style}></div>\n                <div class=\"actions\">\n                  <button type=\"button\" class=\"button ghost\" data-banner=\"${id}\">${selected===id? 'Выбрано' : 'Выбрать'}</button>\n                </div>\n              </div>`;
    }).join('');
    bannersEl.addEventListener('click', async (e)=>{
      const btn = e.target.closest('[data-banner]');
      if (!btn) return;
      const id = btn.getAttribute('data-banner');
      localStorage.setItem('lq_banner_selected', id);
      toast('Баннер выбран');
      location.reload();
    });
  }
  const profileCard = document.getElementById('profile-card');
  if (profileCard) {
    const id = localStorage.getItem('lq_banner_selected') || 'default-white';
    if (id) {
      profileCard.style.background = gradientForBanner(id);
      profileCard.style.backgroundSize = 'cover';
      profileCard.style.backgroundPosition = 'center';
    }
  }

  // Owned banners section in account
  const ownedBannersEl = document.getElementById('owned-banners');
  if (ownedBannersEl) {
    const owned = new Set(JSON.parse(localStorage.getItem('lq_banners')||'[]'));
    // default white always available
    const list = ['default-white', ...Array.from(owned)];
    const selected = localStorage.getItem('lq_banner_selected') || 'default-white';
    ownedBannersEl.innerHTML = list.map((id) => {
      const style = `style=\"background:${gradientForBanner(id)}\"`;
      const label = id === 'default-white' ? 'Белый (по умолчанию)' : id;
      return `<div class=\"banner-card card\">\n                <div class=\"banner\" ${style}></div>\n                <div class=\"actions\">\n                  <button type=\"button\" class=\"button ghost\" data-banner=\"${id}\">${selected===id? 'Выбрано' : 'Выбрать'}</button>\n                </div>\n              </div>`;
    }).join('');
    ownedBannersEl.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-banner]');
      if (!btn) return;
      const id = btn.getAttribute('data-banner');
      localStorage.setItem('lq_banner_selected', id);
      toast('Баннер выбран');
      location.reload();
    });
  }

  // Render account page course summaries
  if (accountCoursesEl) {
    const list = Object.values(COURSES_BY_ID).map(c=>{
      const p = computeCourseProgress(c);
      return `<a class="card course-card" href="/course/${c.id}"><h4>${c.title}</h4><div class="progress"><div class="progress-bar" style="width:${p.percent}%"></div></div><p class="muted">${p.percent}% • ${p.done}/${p.total} уроков</p></a>`;
    }).join('');
    if (list) accountCoursesEl.innerHTML = list;
  }

  // Update home phone mockup
  (function updateMockup(){
    const xp = getXP();
    const { level } = xpToLevel(xp);
    const mockXp = document.getElementById('mock-xp');
    const mockLevel = document.getElementById('mock-level');
    const mockStreak = document.getElementById('mock-streak');
    if (mockXp) mockXp.textContent = `XP ${xp}`;
    if (mockLevel) mockLevel.textContent = `LVL ${level}`;
    if (mockStreak) {
      const streak = Number(localStorage.getItem('lq_streak')||'0');
      mockStreak.textContent = `🔥 ${streak}-day streak`;
    }
  })();

  // OpenAI API key (hardcoded). WARNING: do not commit publicly.
  const OPENAI_API_KEY = 'sk-abcdef1234567890abcdef1234567890abcdef12';
  // Chatbot floating widget
  (function initChatBot(){
    // persistent language mode
    const SUPPORTED_LANGS = ['English','Spanish','German','French','Russian'];
    let chatLang = localStorage.getItem('lq_chat_lang');
    if (!SUPPORTED_LANGS.includes(chatLang)) chatLang = 'English';

    // add fab and panel to body
    const fab = document.createElement('button');
    fab.className = 'chat-fab';
    fab.setAttribute('aria-label','Открыть чат-бота');
    fab.textContent = '💬';
    const panel = document.createElement('div');
    panel.className = 'chat-panel';
    panel.innerHTML = `<div class=\"chat-header\"><strong>Language Bot</strong>
        <select id=\"chat-lang-select\" class=\"chat-lang\">${SUPPORTED_LANGS.map(l=>`<option ${l===chatLang?'selected':''} value="${l}">${l}</option>`).join('')}</select>
        <button id=\"chat-close\" class=\"button ghost\" type=\"button\">×</button></div>
      <div class=\"chat-body\" id=\"chat-body\"></div>
      <div class=\"chat-input\"><input id=\"chat-input\" placeholder=\"Спросите про язык...\"/><button id=\"chat-send\" type=\"button\">Отправить</button></div>`;
    document.body.appendChild(fab);
    document.body.appendChild(panel);
    const bodyEl = panel.querySelector('#chat-body');
    const inputEl = panel.querySelector('#chat-input');
    const sendBtn = panel.querySelector('#chat-send');
    const closeBtn = panel.querySelector('#chat-close');
    const langSelect = panel.querySelector('#chat-lang-select');
    fab.addEventListener('click', ()=>{ panel.classList.toggle('show'); inputEl?.focus(); });
    closeBtn.addEventListener('click', ()=> panel.classList.remove('show'));

    langSelect.addEventListener('change', ()=>{
      const val = langSelect.value;
      if (SUPPORTED_LANGS.includes(val)) {
        chatLang = val;
        localStorage.setItem('lq_chat_lang', chatLang);
        pushMsg('bot', `Language set to ${chatLang}.`);
      }
    });

    function pushMsg(role, text){
      const div = document.createElement('div');
      div.className = `chat-msg ${role==='user' ? 'user' : 'bot'}`;
      div.textContent = text;
      bodyEl.appendChild(div);
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    async function ask(text){
      const apiKey = OPENAI_API_KEY;
      if (!apiKey) { pushMsg('bot','API ключ не задан в коде.'); return; }
      try {
        pushMsg('user', text);
        pushMsg('bot','Печатает...');
        const last = bodyEl.lastChild;
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            input: `You are a helpful language tutor. Always reply only in ${chatLang}. Keep answers concise and practical. Question: ${text}`
          })
        });
        const data = await res.json();
        const content = data?.output?.[0]?.content?.[0]?.text || data?.choices?.[0]?.message?.content || 'Извините, не удалось получить ответ.';
        if (last) last.remove();
        pushMsg('bot', content);
      } catch(e){
        pushMsg('bot','Ошибка сети.');
      }
    }

    function handleSend(){
      const text = (inputEl.value||'').trim();
      if (!text) return;
      inputEl.value='';
      ask(text);
    }
    sendBtn.addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', (e)=>{ if (e.key==='Enter') handleSend(); });
  })();

  // Header dropdown menu
  (function initHeaderMenu(){
    const navs = document.querySelectorAll('.nav');
    navs.forEach(nav => {
      if (nav.querySelector('.menu-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'menu-btn';
      btn.textContent = '☰';
      const dd = document.createElement('div');
      dd.className = 'menu-dropdown';
      const links = Array.from(nav.querySelectorAll('a')).map(a => {
        const href = a.getAttribute('href') || '#';
        const text = a.textContent;
        const authAttr = a.hasAttribute('data-auth') ? ' data-auth' : '';
        const logoutAttr = a.hasAttribute('data-logout') ? ' data-logout' : '';
        return `<a href="${href}"${authAttr}${logoutAttr}>${text}</a>`;
      }).join('');
      dd.innerHTML = links;
      nav.appendChild(btn);
      nav.appendChild(dd);
      btn.addEventListener('click', ()=>{
        dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
      });
      document.addEventListener('click', (e)=>{
        if (!nav.contains(e.target)) dd.style.display = 'none';
      });
    });
  })();
});

