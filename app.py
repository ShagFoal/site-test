from flask import Flask, render_template, request, redirect, url_for, jsonify
import sqlite3
import os


app = Flask(__name__, static_folder='assets', static_url_path='/assets', template_folder='templates')


# -------------------- DB SETUP --------------------
DB_PATH = os.path.join(os.path.dirname(__file__), 'app.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    # users and banners
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        xp INTEGER DEFAULT 0,
        selected_banner TEXT DEFAULT 'default-white'
    )
    """)
    c.execute("""
    CREATE TABLE IF NOT EXISTS owned_banners (
        user_id TEXT,
        banner_id TEXT,
        PRIMARY KEY(user_id, banner_id)
    )
    """)
    # courses
    c.execute("""
    CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL
    )
    """)
    c.execute("""
    CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id TEXT,
        key TEXT,
        title TEXT
    )
    """)
    c.execute("""
    CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER,
        lesson_id TEXT,
        title TEXT
    )
    """)

    # Seed minimal courses if empty
    cur = c.execute('SELECT COUNT(*) as n FROM courses')
    if cur.fetchone()['n'] == 0:
        def add_course(course_id: str, title: str):
            c.execute('INSERT INTO courses(id, title) VALUES(?,?)', (course_id, title))
        def add_topic(course_id: str, key: str, title: str):
            c.execute('INSERT INTO topics(course_id, key, title) VALUES(?,?,?)', (course_id, key, title))
            return c.lastrowid
        def add_lessons(topic_id: int, key: str, base_titles):
            for i, t in enumerate(base_titles, start=1):
                c.execute('INSERT INTO lessons(topic_id, lesson_id, title) VALUES(?,?,?)', (topic_id, f"{key}-{i}", t))

        courses = [
            ('english', 'Английский язык'),
            ('spanish', 'Испанский язык'),
            ('german', 'Немецкий язык'),
            ('french', 'Французский язык'),
        ]
        for cid, title in courses:
            add_course(cid, title)
            topics = [
                ('survival', 'Выживание: приветствия, покупки, кафе',
                 ['Приветствия и представления', 'Числа и цены', 'Заказ в кафе', 'Покупка билетов', 'Вежливые фразы'] + [f'Тема {i}' for i in range(6, 21)]),
                ('daily', 'Повседневность: дом, работа, расписание',
                 ['Дом и семья', 'Работа и профессии', 'Распорядок дня', 'Хобби', 'Еда и готовка'] + [f'Тема {i}' for i in range(6, 21)]),
                ('travel', 'Путешествия: транспорт, отели, ситуации',
                 ['Аэропорт и перелёт', 'Паспортный контроль', 'Отель и заселение', 'Аренда авто', 'Туристическая информация'] + [f'Тема {i}' for i in range(6, 21)]),
                ('grammar', 'Грамматика: времена, модальные, конструкции',
                 ['Present Simple/Continuous', 'Past Simple/Continuous', 'Future forms', 'Present Perfect', 'Модальные глаголы'] + [f'Тема {i}' for i in range(6, 21)]),
                ('communication', 'Коммуникация: диалоги, small talk, email',
                 ['Small talk', 'Знакомства', 'Выражение мнения', 'Согласие/несогласие', 'Проблемы и решения'] + [f'Тема {i}' for i in range(6, 21)]),
            ]
            for key, t_title, lessons in topics:
                tid = add_topic(cid, key, t_title)
                add_lessons(tid, key, lessons)
    conn.commit()
    conn.close()


# Initialize DB at startup
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/auth')
def auth():
    return render_template('auth.html')

@app.route('/account')
def account():
    return render_template('account.html')

@app.route('/courses')
def courses():
    return render_template('courses.html')

@app.route('/course-details')
def course_details():
    # Read course info from query params for demo purposes
    language = request.args.get('lang', 'Английский язык')
    progress = request.args.get('progress', '40%')
    return render_template('course-details.html', language=language, progress=progress)


@app.route('/logout')
def logout():
    return render_template('logout.html')

# New structured course routes
@app.route('/course/<course_id>')
def course(course_id):
    return render_template('course.html', course_id=course_id)

@app.route('/course/<course_id>/topic/<topic_key>')
def topic(course_id, topic_key):
    return render_template('topic.html', course_id=course_id, topic_key=topic_key)

@app.route('/course/<course_id>/lesson/<lesson_id>')
def lesson(course_id, lesson_id):
    return render_template('lesson.html', course_id=course_id, lesson_id=lesson_id)

@app.route('/settings')
def settings():
    return render_template('settings.html')

@app.route('/shop')
def shop():
    return render_template('shop.html')


# -------------------- API --------------------
@app.route('/api/courses')
def api_courses():
    conn = get_db()
    c = conn.cursor()
    courses = []
    for row in c.execute('SELECT id, title FROM courses'):
        course_id = row['id']
        course = {'id': course_id, 'title': row['title'], 'topics': []}
        topics = c.execute('SELECT id, key, title FROM topics WHERE course_id=?', (course_id,)).fetchall()
        for t in topics:
            topic = {'key': t['key'], 'title': t['title'], 'lessons': []}
            for l in c.execute('SELECT lesson_id, title FROM lessons WHERE topic_id=?', (t['id'],)):
                topic['lessons'].append({'id': l['lesson_id'], 'title': l['title']})
            course['topics'].append(topic)
        courses.append(course)
    conn.close()
    return jsonify({'courses': courses})


@app.route('/api/user/<user_id>', methods=['GET', 'POST'])
def api_user(user_id):
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        xp = data.get('xp')
        xp_delta = data.get('xp_delta')
        selected_banner = data.get('selected_banner')
        add_banner = data.get('add_banner')
        c.execute('INSERT OR IGNORE INTO users(id, xp, selected_banner) VALUES(?,?,COALESCE(?, selected_banner))', (user_id, xp or 0, selected_banner))
        if xp is not None:
            c.execute('UPDATE users SET xp=? WHERE id=?', (xp, user_id))
        if xp_delta is not None:
            c.execute('UPDATE users SET xp = COALESCE(xp,0) + ? WHERE id=?', (int(xp_delta), user_id))
        if selected_banner:
            c.execute('UPDATE users SET selected_banner=? WHERE id=?', (selected_banner, user_id))
        if add_banner:
            try:
                c.execute('INSERT OR IGNORE INTO owned_banners(user_id, banner_id) VALUES(?,?)', (user_id, add_banner))
            except Exception:
                pass
        conn.commit()
    row = c.execute('SELECT id, xp, selected_banner FROM users WHERE id=?', (user_id,)).fetchone()
    if not row:
        c.execute('INSERT INTO users(id, xp, selected_banner) VALUES(?,?,?)', (user_id, 0, 'default-white'))
        conn.commit()
        row = c.execute('SELECT id, xp, selected_banner FROM users WHERE id=?', (user_id,)).fetchone()
    banners = [r['banner_id'] for r in c.execute('SELECT banner_id FROM owned_banners WHERE user_id=?', (user_id,)).fetchall()]
    conn.close()
    return jsonify({'id': row['id'], 'xp': row['xp'], 'selected_banner': row['selected_banner'], 'owned_banners': banners})

if __name__ == '__main__':
    app.run(debug=True)