import { QUESTIONS_BANK } from './data/questions.js';
import { STORAGE_KEYS, APP_CONFIG } from './config.js';
import { getParsed, setParsed } from './storageService.js';

        // =====================================================
        // ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ
        // =====================================================

        // ========== ГЛОБАЛЬНЫЕ КОНСТАНТЫ ==========
        const {
            STORAGE_KEY,
            PROGRESS_KEY,
            BOOKMARKS_KEY,
            NOTES_KEY,
            SETTINGS_KEY,
            STATS_KEY,
            QUIZ_RESULTS_KEY,
            HISTORY_KEY,
            GAMIFICATION_KEY,
            TAGS_KEY
        } = STORAGE_KEYS;

        const { TOTAL_QUESTIONS, TOTAL_TICKETS } = APP_CONFIG;

        // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        function escapeHtml(unsafe) {
            if (typeof unsafe !== 'string') return unsafe;
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        let audioCtx = null;
        function getAudioContext() {
            if (!audioCtx && window.AudioContext) {
                audioCtx = new AudioContext();
                document.addEventListener('click', () => {
                    if (audioCtx && audioCtx.state === 'suspended') {
                        audioCtx.resume();
                    }
                }, { once: true });
            }
            return audioCtx;
        }

        // ========== ГЛОБАЛЬНЫЕ ДАННЫЕ ==========
        let allQuestions = [];
        let tickets = [];
        let theoryQuestions = [];
        let practiceQuestions = [];

        let userProgress = {
            questions: {},
            lastViewed: {},
            streak: 0,
            lastActive: null,
            studyTime: 0,
            achievements: {},
            recentlyViewed: [],
            timeSpent: {}
        };

        let bookmarks = [];
        let notes = {};
        let history = [];
        let tags = {};

        let settings = {
            theme: 'dark',
            fontSize: 15,
            reminders: false,
            reminderTime: '20:00',
            autoSave: true,
            showAnswers: true,
            sound: true,
            vibration: true,
            accentColor: '#00d4ff'
        };

        let stats = {
            dailyActivity: {},
            totalStudyTime: 0,
            quizResults: [],
            questionsPerDay: {},
            lastWeekActivity: [],
            hourlyActivity: Array(24).fill(0),
            longestSession: 0,
            bestStreak: 0,
            dailyBookmarks: {},
            dailyNotes: {}
        };

        let gamification = {
            xp: 0,
            level: 1,
            xpToNextLevel: 100,
            achievements: {},
            dailyChallenges: {},
            weeklyChallenges: {},
            combo: 0,
            lastComboDate: null,
            chests: [],
        };

        let particlesCreated = false;
        let reminderTimeout = null;
        let searchIndex = new Map();
        let currentPageState = { name: 'main', params: {} };
        let openedAnswers = new Set();
        let activeNavItem = 'Главная';
        let activeQuizInterval = null;
        let activeExamInterval = null;
        let dataLoaded = false;

        const achievements = [
            { id: 'novice', title: 'Новичок', desc: 'Изучил 5 вопросов', icon: '🌱', target: 5, xp: 50 },
            { id: 'expert', title: 'Знаток', desc: 'Изучил 15 вопросов', icon: '📚', target: 15, xp: 150 },
            { id: 'master', title: 'Профи', desc: 'Изучил 30 вопросов', icon: '🏆', target: 30, xp: 300 },
            { id: 'practice', title: 'Первая практика', desc: 'Решил первую задачу', icon: '⚗️', target: 1, xp: 30 },
            { id: 'streak7', title: 'Неделя без перерыва', desc: '7 дней подряд', icon: '🔥', target: 7, xp: 200 },
            { id: 'streak30', title: 'Месяц без перерыва', desc: '30 дней подряд', icon: '⚡', target: 30, xp: 500 },
            { id: 'quizMaster', title: 'Мастер тестов', desc: '50 правильных ответов', icon: '🧪', target: 50, xp: 400 },
            { id: 'nightOwl', title: 'Ночная сова', desc: 'Занимался после полуночи', icon: '🦉', target: 1, xp: 50 },
            { id: 'earlyBird', title: 'Ранняя пташка', desc: 'Занимался до 6 утра', icon: '🐦', target: 1, xp: 50 },
            { id: 'marathon', title: 'Марафонец', desc: '10 вопросов за один день', icon: '🏃', target: 10, xp: 100 },
            { id: 'collector', title: 'Коллекционер', desc: '20 вопросов в избранном', icon: '⭐', target: 20, xp: 150 },
            { id: 'writer', title: 'Писатель', desc: '10 заметок', icon: '📝', target: 10, xp: 100 },
            { id: 'perfectionist', title: 'Перфекционист', desc: '100% правильных в тесте', icon: '💯', target: 1, xp: 200 },
            { id: 'speedster', title: 'Спидстер', desc: 'Ответил за 10 секунд', icon: '⚡', target: 1, xp: 100 }
        ];

        const dailyChallenges = [
            { id: 'daily1', title: 'Изучи 3 вопроса за сегодня', icon: '📚', target: 3, xp: 30 },
            { id: 'daily2', title: 'Сделай 1 тест', icon: '🧪', target: 1, xp: 50 },
            { id: 'daily3', title: 'Добавь 2 в избранное (сегодня)', icon: '⭐', target: 2, xp: 20 },
            { id: 'daily4', title: 'Напиши заметку (сегодня)', icon: '📝', target: 1, xp: 25 },
            { id: 'daily5', title: 'Повтори 5 вопросов', icon: '🔄', target: 5, xp: 40 }
        ];

        const weeklyChallenges = [
            { id: 'weekly1', title: 'Изучи 20 вопросов за неделю', icon: '📚', target: 20, xp: 200 },
            { id: 'weekly2', title: 'Сделай 5 тестов за неделю', icon: '🧪', target: 5, xp: 250 },
            { id: 'weekly3', title: 'Занимайся 7 дней на этой неделе', icon: '🔥', target: 7, xp: 300 },
            { id: 'weekly4', title: 'Набери 500 XP за неделю', icon: '⭐', target: 500, xp: 400 }
        ];

        const chests = [
            { id: 'chest1', days: 5, xp: 100, items: ['streak_bonus'] },
            { id: 'chest2', days: 15, xp: 300, items: ['rare_badge'] },
            { id: 'chest3', days: 30, xp: 500, items: ['legendary_badge'] }
        ];

        const termDefinitions = {
            'алкан': 'Предельный углеводород, общая формула CₙH₂ₙ₊₂',
            'алкен': 'Непредельный углеводород с двойной связью, формула CₙH₂ₙ',
            'алкин': 'Непредельный углеводород с тройной связью, формула CₙH₂ₙ₋₂',
            'изомер': 'Вещества с одинаковым составом, но разным строением',
            'полимер': 'Вещество с большой молекулярной массой, состоящее из повторяющихся звеньев',
            'гидролиз': 'Разложение вещества водой',
            'электролиз': 'Разложение вещества электрическим током',
            'катализатор': 'Вещество, ускоряющее реакцию, но не расходующееся в ней',
            'метан': 'Простейший алкан, CH₄',
            'этилен': 'Простейший алкен, C₂H₄',
            'ацетилен': 'Простейший алкин, C₂H₂',
            'бензол': 'Ароматический углеводород, C₆H₆'
        };

        // ========== ТЕСТОВЫЕ ВОПРОСЫ (несколько для демонстрации) ==========
        let quizQuestions = [
            { id: 2001, ticket: 1, topic: "Периодический закон", 
              question: "Как Д.И. Менделеев сформулировал периодический закон?",
              options: [
                "Свойства элементов зависят от их атомной массы",
                "Свойства элементов зависят от заряда ядра",
                "Свойства элементов периодически повторяются",
                "Все элементы можно расположить в таблицу"
              ], correct: 2 },
            { id: 2002, ticket: 1, topic: "Периодический закон",
              question: "Современная формулировка периодического закона:",
              options: [
                "Свойства элементов находятся в периодической зависимости от атомной массы",
                "Свойства элементов находятся в периодической зависимости от заряда ядра",
                "Свойства элементов находятся в периодической зависимости от числа нейтронов",
                "Свойства элементов зависят от положения в таблице"
              ], correct: 1 },
            { id: 2003, ticket: 1, topic: "Периодический закон",
              question: "Какие элементы предсказал Менделеев?",
              options: [
                "Германий, галлий, скандий",
                "Уран, плутоний, нептуний",
                "Водород, гелий, литий",
                "Хлор, бром, иод"
              ], correct: 0 }
        ];

        // ========== ИНИЦИАЛИЗАЦИЯ ДАННЫХ ==========
        /**
         * Инициализирует вопросы и связанные коллекции из внешнего банка данных.
         */
        function initData() {
            allQuestions = QUESTIONS_BANK.map(q => ({ ...q }));

            tickets = [];
            for (let i = 0; i < TOTAL_TICKETS; i++) {
                const theoryIdx = i * 2;
                const practiceIdx = i * 2 + 1;
                tickets.push({
                    number: i + 1,
                    theory: allQuestions[theoryIdx],
                    practice: allQuestions[practiceIdx]
                });
            }

            theoryQuestions = allQuestions.filter(q => q.type === 'theory');
            practiceQuestions = allQuestions.filter(q => q.type === 'practice');
            buildSearchIndex();
        }

        // ========== ПОИСКОВЫЙ ИНДЕКС ==========
        function buildSearchIndex() {
            searchIndex.clear();
            allQuestions.forEach(q => {
                const text = (q.text + ' ' + q.answer).toLowerCase();
                const words = text.split(/\W+/);
                words.forEach(word => {
                    if (word.length < 3) return;
                    const base = word.substring(0, 5);
                    if (!searchIndex.has(base)) {
                        searchIndex.set(base, new Set());
                    }
                    searchIndex.get(base).add(q.id);
                    if (!searchIndex.has(word)) {
                        searchIndex.set(word, new Set());
                    }
                    searchIndex.get(word).add(q.id);
                });
            });
        }

        function smartSearch(query) {
            if (!query) return allQuestions;
            
            query = query.toLowerCase();
            const words = query.split(/\W+/).filter(w => w.length >= 2);
            if (words.length === 0) return allQuestions;
            
            const resultsPerWord = words.map(word => {
                if (searchIndex.has(word)) {
                    return searchIndex.get(word);
                }
                const base = word.substring(0, 5);
                if (searchIndex.has(base)) {
                    return searchIndex.get(base);
                }
                return new Set();
            });
            
            let result = new Set(resultsPerWord[0]);
            for (let i = 1; i < resultsPerWord.length; i++) {
                result = new Set([...result].filter(id => resultsPerWord[i].has(id)));
            }
            
            return allQuestions.filter(q => result.has(q.id));
        }

        // ========== СОХРАНЕНИЕ/ЗАГРУЗКА ==========
        const saveAllData = debounce(function saveAllData() {
            try {
                setParsed(STORAGE_KEY, { allQuestions, tickets, theoryQuestions, practiceQuestions });
                setParsed(PROGRESS_KEY, userProgress);
                setParsed(BOOKMARKS_KEY, bookmarks);
                setParsed(NOTES_KEY, notes);
                setParsed(SETTINGS_KEY, settings);
                setParsed(STATS_KEY, stats);
                setParsed(QUIZ_RESULTS_KEY, stats.quizResults);
                setParsed(HISTORY_KEY, history);
                setParsed(GAMIFICATION_KEY, gamification);
                setParsed(TAGS_KEY, tags);
            } catch (e) { console.error('Ошибка сохранения', e); }
        }, 120);

        function loadAllData(force = false) {
            if (dataLoaded && !force) return;
            try {
                const saved = getParsed(STORAGE_KEY);
                if (saved) {
                    try {
                        const parsed = saved;
                        if (parsed.allQuestions && parsed.allQuestions.length === TOTAL_QUESTIONS) {
                            allQuestions = parsed.allQuestions;
                            tickets = parsed.tickets || [];
                            theoryQuestions = parsed.theoryQuestions || [];
                            practiceQuestions = parsed.practiceQuestions || [];
                        } else {
                            initData();
                        }
                    } catch (e) {
                        initData();
                    }
                } else {
                    initData();
                }

                try {
                    const prog = getParsed(PROGRESS_KEY);
                    if (prog) {
                        userProgress = prog;
                        if (!userProgress.lastViewed) userProgress.lastViewed = {};
                        if (!userProgress.recentlyViewed) userProgress.recentlyViewed = [];
                        if (!userProgress.timeSpent) userProgress.timeSpent = {};
                    }
                } catch (e) { console.warn('Ошибка загрузки PROGRESS_KEY'); }

                try {
                    const bm = getParsed(BOOKMARKS_KEY);
                    if (bm) bookmarks = bm;
                } catch (e) { console.warn('Ошибка загрузки BOOKMARKS_KEY'); }

                try {
                    const nt = getParsed(NOTES_KEY);
                    if (nt) notes = nt;
                } catch (e) { console.warn('Ошибка загрузки NOTES_KEY'); }

                try {
                    const stg = getParsed(SETTINGS_KEY);
                    if (stg) {
                        settings = stg;
                    }
                } catch (e) { console.warn('Ошибка загрузки SETTINGS_KEY'); }

                try {
                    const st = getParsed(STATS_KEY);
                    if (st) stats = st;
                } catch (e) { console.warn('Ошибка загрузки STATS_KEY'); }

                try {
                    const qr = getParsed(QUIZ_RESULTS_KEY);
                    if (qr) stats.quizResults = qr;
                } catch (e) { console.warn('Ошибка загрузки QUIZ_RESULTS_KEY'); }

                try {
                    const hist = getParsed(HISTORY_KEY);
                    if (hist) history = hist;
                } catch (e) { console.warn('Ошибка загрузки HISTORY_KEY'); }

                try {
                    const game = getParsed(GAMIFICATION_KEY);
                    if (game) gamification = game;
                } catch (e) { console.warn('Ошибка загрузки GAMIFICATION_KEY'); }

                try {
                    const tgs = getParsed(TAGS_KEY);
                    if (tgs) tags = tgs;
                } catch (e) { console.warn('Ошибка загрузки TAGS_KEY'); }

                buildSearchIndex();
                applySettings();
                dataLoaded = true;
                
            } catch (e) {
                console.error('Общая ошибка загрузки', e);
                initData();
                buildSearchIndex();
                applySettings();
                dataLoaded = true;
            }
        }

        function applySettings() {
            document.body.classList.remove('light-theme', 'neon-theme', 'pastel-theme');
            
            if (settings.theme === 'light') {
                document.body.classList.add('light-theme');
            } else if (settings.theme === 'neon') {
                document.body.classList.add('neon-theme');
            } else if (settings.theme === 'pastel') {
                document.body.classList.add('pastel-theme');
            }
            
            document.documentElement.style.setProperty('--accent', settings.accentColor);
            document.documentElement.style.setProperty('--base-font-size', settings.fontSize + 'px');
            document.body.style.fontSize = settings.fontSize + 'px';
            
            if (settings.reminders) {
                setupReminder();
            }
        }

        // ========== ЧАСТИЦЫ (ОДИН РАЗ) ==========
        function createParticles() {
            if (particlesCreated) return;
            for (let i = 0; i < 20; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 20 + 's';
                particle.style.animationDuration = 15 + Math.random() * 10 + 's';
                document.body.appendChild(particle);
            }
            particlesCreated = true;
        }

        // ========== ЗВУКИ ==========
        function playSound(type) {
            if (!settings.sound) return;
            const ctx = getAudioContext();
            if (!ctx) return;
            
            try {
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);
                oscillator.type = 'sine';
                
                if (type === 'correct') {
                    oscillator.frequency.value = 800;
                    gainNode.gain.value = 0.1;
                    oscillator.start();
                    oscillator.stop(ctx.currentTime + 0.15);
                } else if (type === 'wrong') {
                    oscillator.frequency.value = 300;
                    gainNode.gain.value = 0.1;
                    oscillator.start();
                    oscillator.stop(ctx.currentTime + 0.2);
                } else if (type === 'achievement') {
                    oscillator.frequency.value = 600;
                    gainNode.gain.value = 0.1;
                    oscillator.start();
                    oscillator.stop(ctx.currentTime + 0.3);
                }
            } catch (e) {}
        }

        function vibrate(pattern) {
            if (!settings.vibration) return;
            if (navigator.vibrate) {
                navigator.vibrate(pattern);
            }
        }

        function addXP(amount, reason) {
            gamification.xp += amount;
            
            while (gamification.xp >= gamification.xpToNextLevel) {
                gamification.xp -= gamification.xpToNextLevel;
                gamification.level++;
                gamification.xpToNextLevel = Math.floor(gamification.xpToNextLevel * 1.5);
                
                showLevelUp(gamification.level);
                playSound('achievement');
                vibrate([150, 80, 150]);
                
                for (let i = 0; i < 30; i++) {
                    createConfetti();
                }
            }
            
            showToast(`+${amount} XP (${reason})`, 'success');
            saveAllData();
        }

        function showLevelUp(level) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">⬆️</div>
                    <h2 style="color: var(--accent);">Уровень повышен!</h2>
                    <div style="font-size: 2.5rem; margin: 16px 0; color: var(--level-color);">${level}</div>
                    <p>Открыты новые возможности!</p>
                    <button class="btn btn-primary" style="margin-top: 16px;" onclick="this.parentElement.parentElement.remove()">✕</button>
                </div>
            `;
            document.body.appendChild(modal);
        }

        function createConfetti() {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = `hsl(${Math.random() * 360}, 100%, 50%)`;
            confetti.style.width = (4 + Math.random() * 6) + 'px';
            confetti.style.height = confetti.style.width;
            confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 4000);
        }

        function showToast(text, type = 'info') {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = text;
            toast.style.borderColor = type === 'success' ? 'var(--success)' : 'var(--accent)';
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 200);
            }, 2500);
        }

        function setupReminder() {
            if (reminderTimeout) clearTimeout(reminderTimeout);
            if (!('Notification' in window)) return;
            
            const now = new Date();
            const [hoursRaw, minutesRaw] = String(settings.reminderTime || '').split(':');
            const hours = Number(hoursRaw);
            const minutes = Number(minutesRaw);
            if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                return;
            }
            
            const reminderTime = new Date();
            reminderTime.setHours(hours, minutes, 0, 0);
            
            if (reminderTime <= now) {
                reminderTime.setDate(reminderTime.getDate() + 1);
            }
            
            const delay = reminderTime - now;
            
            reminderTimeout = setTimeout(() => {
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('🧪 ChemExam Assistant', {
                        body: 'Пора повторить химию!',
                        icon: '/icon.png',
                        badge: '/badge.png',
                        vibrate: [150, 80, 150]
                    });
                }
                setupReminder();
            }, delay);
        }

        function requestNotificationPermission() {
            if ('Notification' in window && Notification.permission !== 'granted') {
                Notification.requestPermission().catch(() => {});
            }
        }

        function toggleBookmark(questionId) {
            const idx = bookmarks.indexOf(questionId);
            if (idx === -1) {
                bookmarks.push(questionId);
                showToast('⭐ Добавлено в избранное', 'success');
                playSound('correct');
                vibrate(30);
                
                if (bookmarks.length >= 20) {
                    checkAchievement('collector');
                }
                const today = new Date().toISOString().split('T')[0];
                if (!stats.dailyBookmarks) stats.dailyBookmarks = {};
                stats.dailyBookmarks[today] = (stats.dailyBookmarks[today] || 0) + 1;
            } else {
                bookmarks.splice(idx, 1);
                showToast('⭐ Удалено из избранного', 'info');
                const today = new Date().toISOString().split('T')[0];
                if (stats.dailyBookmarks && stats.dailyBookmarks[today] > 0) {
                    stats.dailyBookmarks[today]--;
                }
            }
            saveAllData();
            updateBookmarkIcon(questionId);
        }

        function updateBookmarkIcon(questionId) {
            const btn = document.querySelector(`.bookmark-btn[data-id="${questionId}"]`);
            if (btn) {
                const isBookmark = bookmarks.includes(questionId);
                btn.innerHTML = isBookmark ? '⭐' : '☆';
                btn.classList.toggle('active', isBookmark);
            }
        }

        const debouncedAutoSave = debounce((questionId, text) => {
            if (!settings.autoSave) return;
            text = text.trim();
            if (text.length > 2000) {
                showToast('Заметка слишком длинная (макс. 2000 символов)', 'info');
                return;
            }
            if (!text) {
                delete notes[questionId];
                const today = new Date().toISOString().split('T')[0];
                if (stats.dailyNotes && stats.dailyNotes[today] > 0) {
                    stats.dailyNotes[today]--;
                }
            } else {
                if (!notes[questionId]) {
                    const today = new Date().toISOString().split('T')[0];
                    if (!stats.dailyNotes) stats.dailyNotes = {};
                    stats.dailyNotes[today] = (stats.dailyNotes[today] || 0) + 1;
                }
                notes[questionId] = { text, date: new Date().toISOString() };
                
                if (Object.keys(notes).length >= 10) {
                    checkAchievement('writer');
                }
            }
            saveAllData();
            showToast('📝 Автосохранение', 'info');
        }, 1500);

        function handleNoteInput(questionId, text) {
            debouncedAutoSave(questionId, text);
        }

        function saveNote(questionId, text) {
            text = text.trim();
            if (text.length > 2000) {
                showToast('Заметка слишком длинная (макс. 2000 символов)', 'info');
                return;
            }
            if (!text) {
                deleteNote(questionId);
                return;
            }
            if (!notes[questionId]) {
                const today = new Date().toISOString().split('T')[0];
                if (!stats.dailyNotes) stats.dailyNotes = {};
                stats.dailyNotes[today] = (stats.dailyNotes[today] || 0) + 1;
            }
            notes[questionId] = { text, date: new Date().toISOString() };
            saveAllData();
            showToast('📝 Заметка сохранена', 'success');
            rerenderCurrentPage();
        }

        function deleteNote(questionId) {
            if (notes[questionId]) {
                const today = new Date().toISOString().split('T')[0];
                if (stats.dailyNotes && stats.dailyNotes[today] > 0) {
                    stats.dailyNotes[today]--;
                }
                delete notes[questionId];
                saveAllData();
                showToast('📝 Заметка удалена', 'info');
                rerenderCurrentPage();
            }
        }

        function showNoteInput(questionId) {
            const el = document.getElementById(`note-${questionId}`);
            if (el) el.classList.toggle('hidden');
        }

        function toggleQuestionAnswer(questionId) {
            if (openedAnswers.has(questionId)) {
                openedAnswers.delete(questionId);
            } else {
                openedAnswers.add(questionId);
            }
            const answerDiv = document.getElementById(`answer-${questionId}`);
            if (answerDiv) {
                answerDiv.classList.toggle('hidden');
                const btn = answerDiv.parentElement?.querySelector('.btn-secondary');
                if (btn) btn.textContent = openedAnswers.has(questionId) ? '🔍 Скрыть' : '🔍 Показать';
            }
        }

        function addToHistory(questionId) {
            const q = allQuestions.find(q => q.id === questionId);
            if (!q) return;
            
            history = history.filter(item => item.id !== questionId);
            history.unshift({
                id: questionId,
                number: q.number,
                type: q.type,
                date: new Date().toISOString()
            });
            
            if (history.length > 20) history.pop();
            
            saveAllData();
        }

        function updateProgress(questionId, type) {
            if (userProgress.questions?.[questionId]) {
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const now = Date.now();
            const hour = new Date().getHours();
            
            if (!userProgress.questions) userProgress.questions = {};
            if (!userProgress.lastViewed) userProgress.lastViewed = {};
            const viewedAt = new Date().toISOString();
            const lastView = userProgress.lastViewed[questionId];
            userProgress.questions[questionId] = true;
            userProgress.lastViewed[questionId] = viewedAt;
            
            if (lastView && lastView !== viewedAt) {
                const timeSpent = Math.round((now - new Date(lastView).getTime()) / 1000);
                if (timeSpent > 0 && timeSpent < 3600) {
                    if (!userProgress.timeSpent) userProgress.timeSpent = {};
                    userProgress.timeSpent[questionId] = (userProgress.timeSpent[questionId] || 0) + timeSpent;
                    
                    if (timeSpent < 10) {
                        checkAchievement('speedster');
                    }
                }
            }

            const recent = userProgress.recentlyViewed || [];
            const existingIndex = recent.findIndex(item => item.id === questionId);
            if (existingIndex !== -1) recent.splice(existingIndex, 1);
            recent.unshift({ id: questionId, date: new Date().toISOString() });
            if (recent.length > 20) recent.pop();
            userProgress.recentlyViewed = recent;
            
            addToHistory(questionId);

            const last = userProgress.lastActive;
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            if (last === yesterday) {
                userProgress.streak = (userProgress.streak || 0) + 1;
                
                if (userProgress.streak > stats.bestStreak) {
                    stats.bestStreak = userProgress.streak;
                }
                
                if (userProgress.lastActive === yesterday) {
                    gamification.combo++;
                    gamification.lastComboDate = today;
                    
                    if (gamification.combo > 1) {
                        showToast(`Комбо x${gamification.combo}! +${gamification.combo * 5} XP`, 'success');
                        addXP(gamification.combo * 5, 'combo');
                    }
                }
            } else if (last !== today) {
                userProgress.streak = 1;
                gamification.combo = 1;
                gamification.lastComboDate = today;
            }
            userProgress.lastActive = today;

            userProgress.studyTime = (userProgress.studyTime || 0) + 5;
            stats.totalStudyTime = (stats.totalStudyTime || 0) + 5;
            
            const currentSession = 5;
            if (currentSession > stats.longestSession) {
                stats.longestSession = currentSession;
            }

            if (!stats.dailyActivity) stats.dailyActivity = {};
            if (!stats.dailyActivity[today]) stats.dailyActivity[today] = 0;
            stats.dailyActivity[today]++;
            
            if (stats.dailyActivity[today] >= 10) {
                checkAchievement('marathon');
            }
            
            stats.hourlyActivity[hour] = (stats.hourlyActivity[hour] || 0) + 1;
            
            if (hour >= 0 && hour < 4) {
                checkAchievement('nightOwl');
            }
            
            if (hour >= 4 && hour < 6) {
                checkAchievement('earlyBird');
            }

            addXP(10, 'изучение вопроса');

            const studiedToday = Object.values(userProgress.lastViewed || {}).filter(
                d => d && d.startsWith(today)
            ).length;
            if (studiedToday >= 3) {
                checkDailyChallenge('daily1');
            }

            const reviewedToday = userProgress.recentlyViewed?.filter(
                item => item.date && item.date.startsWith(today)
            ).length || 0;
            if (reviewedToday >= 5) {
                checkDailyChallenge('daily5');
            }

            checkWeeklyChallenges();
            checkAchievements();
            checkChests();
            saveAllData();
            updateGlobalProgress();
        }

        function checkDailyChallenge(challengeId) {
            const today = new Date().toISOString().split('T')[0];
            if (!gamification.dailyChallenges[today]) {
                gamification.dailyChallenges[today] = {};
            }
            if (gamification.dailyChallenges[today][challengeId]) return;

            const challenge = dailyChallenges.find(c => c.id === challengeId);
            if (!challenge) return;

            let completed = false;
            if (challengeId === 'daily1') {
                const studiedToday = Object.values(userProgress.lastViewed || {}).filter(
                    d => d && d.startsWith(today)
                ).length;
                completed = studiedToday >= 3;
            } else if (challengeId === 'daily2') {
                const testsToday = stats.quizResults?.filter(r => r.date.startsWith(today)).length || 0;
                completed = testsToday >= 1;
            } else if (challengeId === 'daily3') {
                const bookmarksToday = stats.dailyBookmarks?.[today] || 0;
                completed = bookmarksToday >= 2;
            } else if (challengeId === 'daily4') {
                const notesToday = stats.dailyNotes?.[today] || 0;
                completed = notesToday >= 1;
            } else if (challengeId === 'daily5') {
                const reviewedToday = userProgress.recentlyViewed?.filter(
                    item => item.date && item.date.startsWith(today)
                ).length || 0;
                completed = reviewedToday >= 5;
            }

            if (completed) {
                gamification.dailyChallenges[today][challengeId] = true;
                addXP(challenge.xp, 'ежедневное задание');
                showToast(`✅ Задание выполнено: ${challenge.title}`, 'success');
                saveAllData();
            }
        }

        function checkWeeklyChallenges() {
            const week = getWeekNumber(new Date());
            if (!gamification.weeklyChallenges) gamification.weeklyChallenges = {};
            if (!gamification.weeklyChallenges[week]) gamification.weeklyChallenges[week] = {};

            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay() + 1);
            startOfWeek.setHours(0,0,0,0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);

            weeklyChallenges.forEach(challenge => {
                if (gamification.weeklyChallenges[week][challenge.id]) return;

                let progress = 0;
                if (challenge.id === 'weekly1') {
                    progress = Object.entries(userProgress.lastViewed || {}).filter(([id, date]) => {
                        if (!date) return false;
                        const d = new Date(date);
                        return d >= startOfWeek && d < endOfWeek;
                    }).length;
                } else if (challenge.id === 'weekly2') {
                    progress = stats.quizResults?.filter(r => {
                        const d = new Date(r.date);
                        return d >= startOfWeek && d < endOfWeek;
                    }).length || 0;
                } else if (challenge.id === 'weekly3') {
                    const days = new Set();
                    Object.entries(userProgress.lastViewed || {}).forEach(([id, date]) => {
                        if (!date) return;
                        const d = new Date(date);
                        if (d >= startOfWeek && d < endOfWeek) {
                            days.add(d.toISOString().split('T')[0]);
                        }
                    });
                    progress = days.size;
                } else if (challenge.id === 'weekly4') {
                    // сложно, пока пропустим
                    return;
                }

                if (progress >= challenge.target) {
                    gamification.weeklyChallenges[week][challenge.id] = true;
                    addXP(challenge.xp, 'еженедельный челлендж');
                    showToast(`🏆 Челлендж выполнен: ${challenge.title}`, 'success');
                }
            });
        }

        function getWeekNumber(date) {
            const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
            const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
            return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        }

        function updateGlobalProgress() {
            const total = allQuestions.length;
            const studied = Object.values(userProgress.questions || {}).filter(v => v).length;
            const percent = total ? (studied / total) * 100 : 0;
            const bar = document.getElementById('global-progress-fill');
            if (bar) bar.style.width = percent + '%';
        }

        function checkAchievement(achievementId) {
            const achievement = achievements.find(a => a.id === achievementId);
            if (!achievement) return false;
            
            if (!gamification.achievements[achievementId]) {
                gamification.achievements[achievementId] = {
                    date: new Date().toISOString()
                };
                
                addXP(achievement.xp, 'достижение');
                playSound('achievement');
                vibrate([80, 40, 80]);
                
                showToast(`🏆 Достижение: ${achievement.title}`, 'success');
                
                for (let i = 0; i < 20; i++) {
                    createConfetti();
                }
                
                return true;
            }
            return false;
        }

        function checkAchievements() {
            const totalStudied = Object.values(userProgress.questions || {}).filter(v => v).length;
            const practiceStudied = allQuestions.filter(q => q.type === 'practice' && userProgress.questions?.[q.id]).length;
            const totalQuizCorrect = (stats.quizResults || []).reduce((s, r) => s + r.score, 0);
            const totalBookmarks = bookmarks.length;
            const totalNotes = Object.keys(notes).length;

            achievements.forEach(a => {
                if (!gamification.achievements[a.id]) {
                    let achieved = false;
                    if (a.id === 'novice') achieved = totalStudied >= 5;
                    else if (a.id === 'expert') achieved = totalStudied >= 15;
                    else if (a.id === 'master') achieved = totalStudied >= 30;
                    else if (a.id === 'practice') achieved = practiceStudied >= 1;
                    else if (a.id === 'streak7') achieved = (userProgress.streak || 0) >= 7;
                    else if (a.id === 'streak30') achieved = (userProgress.streak || 0) >= 30;
                    else if (a.id === 'quizMaster') achieved = totalQuizCorrect >= 50;
                    else if (a.id === 'collector') achieved = totalBookmarks >= 20;
                    else if (a.id === 'writer') achieved = totalNotes >= 10;
                    else if (a.id === 'perfectionist') achieved = checkPerfectionist();

                    if (achieved) {
                        gamification.achievements[a.id] = { date: new Date().toISOString() };
                        addXP(a.xp, 'достижение');
                        playSound('achievement');
                        showToast(`🏆 Достижение: ${a.title}`, 'success');
                    }
                }
            });
        }

        function checkPerfectionist() {
            const lastQuiz = stats.quizResults?.[stats.quizResults.length - 1];
            return lastQuiz && lastQuiz.percentage === 100;
        }

        function checkChests() {
            const streak = userProgress.streak || 0;
            
            chests.forEach(chest => {
                if (streak >= chest.days && !gamification.chests?.includes(chest.id)) {
                    if (!gamification.chests) gamification.chests = [];
                    gamification.chests.push(chest.id);
                    
                    addXP(chest.xp, 'сундук');
                    
                    const modal = document.createElement('div');
                    modal.className = 'modal';
                    modal.innerHTML = `
                        <div style="text-align: center;">
                            <div style="font-size: 3rem; margin-bottom: 16px;">🎁</div>
                            <h2 style="color: var(--accent);">Сундук открыт!</h2>
                            <p style="margin: 16px 0;">Вы получили ${chest.xp} XP</p>
                            <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">✕</button>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    
                    for (let i = 0; i < 15; i++) {
                        createConfetti();
                    }
                }
            });
        }

        function addTag(questionId, tag) {
            tag = tag.trim();
            if (!tag) return;
            if (!tags[questionId]) tags[questionId] = [];
            if (!tags[questionId].includes(tag)) {
                tags[questionId].push(tag);
                saveAllData();
                showToast(`🏷️ Тег "${escapeHtml(tag)}" добавлен`, 'success');
                rerenderCurrentPage();
            }
        }

        function removeTag(questionId, tag) {
            if (tags[questionId]) {
                tags[questionId] = tags[questionId].filter(t => t !== tag);
                saveAllData();
                showToast(`🏷️ Тег удален`, 'info');
                rerenderCurrentPage();
            }
        }

        function getQuestionsByTag(tag) {
            const ids = [];
            Object.entries(tags).forEach(([id, tgs]) => {
                if (tgs.includes(tag)) ids.push(parseInt(id));
            });
            return allQuestions.filter(q => ids.includes(q.id));
        }

        function exportToTxt() {
            let content = 'ЭКЗАМЕНАЦИОННЫЕ ВОПРОСЫ ПО ХИМИИ (ПОЛНЫЙ СПИСОК)\n\n';
            allQuestions.sort((a,b)=>a.number-b.number).forEach(q => {
                content += `ВОПРОС №${q.number} (${q.type==='theory'?'теория':'практика'})\n`;
                content += `${q.text}\n\nОТВЕТ:\n${q.answer}\n\n${'='.repeat(50)}\n\n`;
            });
            const blob = new Blob([content], {type:'text/plain'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chem_questions.txt';
            a.click();
            URL.revokeObjectURL(url);
            showToast('📄 Экспорт завершён', 'success');
        }

        function exportProgress() {
            const data = {
                userProgress,
                bookmarks,
                notes,
                stats,
                history,
                gamification,
                tags,
                exportDate: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chem_progress.json';
            a.click();
            URL.revokeObjectURL(url);
            showToast('📤 Прогресс экспортирован', 'success');
        }

        function importProgress(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.userProgress && typeof data.userProgress === 'object' &&
                        data.bookmarks && Array.isArray(data.bookmarks) &&
                        data.notes && typeof data.notes === 'object' &&
                        data.stats && typeof data.stats === 'object') {
                        userProgress = data.userProgress;
                        bookmarks = data.bookmarks;
                        notes = data.notes;
                        stats = data.stats;
                        history = data.history || [];
                        gamification = data.gamification || gamification;
                        tags = data.tags || {};
                        saveAllData();
                        buildSearchIndex();
                        showToast('📥 Прогресс импортирован', 'success');
                        rerenderCurrentPage();
                    } else {
                        showToast('Неверный формат файла', 'danger');
                    }
                } catch (ex) {
                    showToast('Ошибка чтения файла', 'danger');
                }
            };
            reader.readAsText(file);
        }

        function resetProgress() {
            if (confirm('Сбросить весь прогресс?')) {
                userProgress = {
                    questions: {},
                    lastViewed: {},
                    streak: 0,
                    lastActive: null,
                    studyTime: 0,
                    achievements: {},
                    recentlyViewed: [],
                    timeSpent: {}
                };
                bookmarks = [];
                notes = {};
                stats = {
                    dailyActivity: {},
                    totalStudyTime: 0,
                    quizResults: [],
                    questionsPerDay: {},
                    hourlyActivity: Array(24).fill(0),
                    longestSession: 0,
                    bestStreak: 0,
                    dailyBookmarks: {},
                    dailyNotes: {}
                };
                history = [];
                gamification = {
                    xp: 0,
                    level: 1,
                    xpToNextLevel: 100,
                    achievements: {},
                    dailyChallenges: {},
                    weeklyChallenges: {},
                    combo: 0,
                    lastComboDate: null,
                    chests: [],
                };
                tags = {};
                saveAllData();
                showToast('Прогресс сброшен', 'success');
                rerenderCurrentPage();
            }
        }

        function rerenderCurrentPage() {
            const page = currentPageState.name;
            const params = currentPageState.params;
            switch (page) {
                case 'main': showMainInterface(); break;
                case 'tickets': showTicketsPage(params.filter || 'all', params.sort || 'number'); break;
                case 'ticket': showTicket(params.ticketNumber); break;
                case 'theory': showTheoryPage(params.filter || 'all', params.search || '', params.sort || 'number'); break;
                case 'practice': showPracticePage(params.filter || 'all', params.search || '', params.sort || 'number'); break;
                case 'detail': showQuestionDetail(params.questionId); break;
                case 'stats': showStatsPage(); break;
                case 'settings': showSettingsPage(); break;
                case 'quiz': showQuizPage(); break;
                case 'flashcards': showFlashcardsPage(params.category || 'all', params.mode || 'unlearned'); break;
                case 'reference': showReferencePage(); break;
                case 'examselect': showExamSelectionPage(); break;
                case 'exam': runExam(params.questions, params.title || 'Экзамен'); break;
                case 'random': showRandomQuestion(); break;
                case 'achievements': showAchievementsPage(); break;
                case 'challenges': showChallengesPage(); break;
                case 'heatmap': showHeatmapPage(); break;
                default: showMainInterface();
            }
        }

        function getTicketInfoByQuestionId(questionId) {
            for (let t of tickets) {
                if (t.theory.id === questionId || t.practice.id === questionId) return t;
            }
            return null;
        }

        function renderNavigation(activePage) {
            activeNavItem = activePage;
            const pages = [
                { name: 'Главная', icon: '🏠', func: 'showMainInterface' },
                { name: 'Билеты', icon: '📋', func: 'showTicketsPage' },
                { name: 'Теория', icon: '📚', func: 'showTheoryPage' },
                { name: 'Практика', icon: '⚗️', func: 'showPracticePage' },
                { name: 'Карточки', icon: '🃏', func: 'showFlashcardsPage' },
                { name: 'Справочник', icon: '📖', func: 'showReferencePage' },
                { name: 'Статистика', icon: '📊', func: 'showStatsPage' },
                { name: 'Настройки', icon: '⚙️', func: 'showSettingsPage' }
            ];
            return `
                <nav class="navigation">
                    <div class="nav-content">
                        ${pages.map(p => `
                            <button class="nav-item ${activeNavItem === p.name ? 'active' : ''}" onclick="${p.func}()">
                                <span class="nav-icon">${p.icon}</span>
                                <span>${p.name}</span>
                            </button>
                        `).join('')}
                    </div>
                </nav>
            `;
        }

        function highlightTerms(text) {
            if (!text) return text;
            let result = escapeHtml(text);
            Object.keys(termDefinitions).forEach(term => {
                const escapedTerm = escapeHtml(term);
                const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
                result = result.replace(regex, match => 
                    `<span class="key-term" title="${escapeHtml(termDefinitions[term])}">${match}</span>`
                );
            });
            return result;
        }

        // ========== ГЛАВНАЯ ==========

        function getLastViewedQuestion() {
            const recent = userProgress.recentlyViewed || [];
            for (const item of recent) {
                const q = allQuestions.find(q => q.id === item.id);
                if (q) return q;
            }
            return null;
        }

        function getWeakQuestions(limit = 10) {
            const scored = allQuestions.map(q => {
                const timeSpent = userProgress.timeSpent?.[q.id] || 0;
                const isLearned = !!userProgress.questions?.[q.id];
                const misses = (stats.questionMistakes?.[q.id] || 0);
                const score = (misses * 5) + Math.min(5, Math.floor(timeSpent / 30)) + (isLearned ? 0 : 2);
                return { q, score, misses, timeSpent, isLearned };
            }).filter(item => item.score > 0);

            scored.sort((a, b) => b.score - a.score);
            return scored.slice(0, limit);
        }

        function showWeakQuestionsPage() {
            currentPageState = { name: 'weak', params: {} };
            loadAllData();

            const weak = getWeakQuestions(12);
            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <button class="back-btn" onclick="showMainInterface()">← Назад</button>
                        <div class="logo-text">🎯 Слабые темы</div>
                        <div style="width:60px"></div>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <h1>🎯 Повторение сложного</h1>
                        <p>Список составлен по времени изучения, невыученным вопросам и ошибкам в экзамене.</p>
                    </div>
                    ${weak.length ? weak.map(item => `
                        <div class="ticket-item ${item.isLearned ? 'completed' : 'in-progress'}" onclick="showQuestionDetail(${item.q.id})">
                            <div class="ticket-header">
                                <span class="ticket-number">${item.q.type==='theory'?'📚':'⚗️'} Вопрос ${item.q.number}</span>
                                <span class="ticket-status ${item.isLearned ? 'completed' : 'in-progress'}">${item.isLearned ? 'Выучен' : 'Невыучен'}</span>
                            </div>
                            <p style="margin:0">${escapeHtml(item.q.text)}</p>
                            <div class="ticket-progress">
                                <span class="progress-text">Ошибки: ${item.misses}</span>
                                <span class="progress-text">Время: ${item.timeSpent}с</span>
                                <span class="progress-text">Сложность: ${item.score}</span>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="card"><p>Пока нет данных для анализа слабых тем. Решите тест/экзамен и вернитесь сюда.</p></div>
                    `}
                </main>
                ${renderNavigation('Главная')}
            `;
        }

        function showMainInterface() {
            currentPageState = { name: 'main', params: {} };
            loadAllData();

            const totalQuestions = allQuestions.length;
            const studied = Object.values(userProgress.questions || {}).filter(v=>v).length;
            const percent = totalQuestions ? Math.round((studied/totalQuestions)*100) : 0;

            const theoryCount = theoryQuestions.length;
            const practiceCount = practiceQuestions.length;
            const theoryStudied = theoryQuestions.filter(q => userProgress.questions?.[q.id]).length;
            const practiceStudied = practiceQuestions.filter(q => userProgress.questions?.[q.id]).length;

            const recent = (userProgress.recentlyViewed || []).slice(0, 5).map(item => allQuestions.find(q => q.id === item.id)).filter(q => q);

            const now = Date.now();
            const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
            const toReview = allQuestions
                .filter(q => {
                    if (userProgress.questions?.[q.id]) return false;
                    const lastView = userProgress.lastViewed?.[q.id];
                    if (!lastView) return true;
                    const lastDate = new Date(lastView).getTime();
                    return (now - lastDate) > threeDaysMs;
                })
                .sort((a, b) => {
                    const lastA = userProgress.lastViewed?.[a.id] ? new Date(userProgress.lastViewed[a.id]).getTime() : 0;
                    const lastB = userProgress.lastViewed?.[b.id] ? new Date(userProgress.lastViewed[b.id]).getTime() : 0;
                    return lastA - lastB;
                })
                .slice(0, 3);

            const today = new Date().toISOString().split('T')[0];
            const todayActivity = stats.dailyActivity?.[today] || 0;
            const totalTime = userProgress.studyTime || 0;
            
            const xpProgress = (gamification.xp / gamification.xpToNextLevel) * 100;

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">🧪 ChemExam</div>
                        <div style="display: flex; gap: 6px;">
                            <span class="streak-badge">🔥 ${userProgress.streak || 0}</span>
                            <span class="level-badge">⭐ ${gamification.level}</span>
                            ${history.length > 0 ? '<span class="notification-badge">' + history.length + '</span>' : ''}
                        </div>
                    </div>
                    <div class="global-progress">
                        <div id="global-progress-fill" class="global-progress-fill" style="width:${percent}%"></div>
                    </div>
                </header>
                <div class="xp-container">
                    <div style="display: flex; justify-content: space-between; width: 100%;">
                        <span style="font-size: 0.7rem; color: var(--xp-color);">XP: ${gamification.xp}</span>
                        <span style="font-size: 0.7rem; color: var(--level-color);">Ур. ${gamification.level}</span>
                    </div>
                    <div class="xp-bar">
                        <div class="xp-fill" style="width: ${xpProgress}%"></div>
                    </div>
                </div>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <h1>👋 Добро пожаловать!</h1>
                        <div style="display: flex; justify-content: space-between; margin-top: 6px;">
                            <p>Сегодня: ${todayActivity}</p>
                            <p>Время: ${Math.floor(totalTime/60)}ч ${totalTime%60}м</p>
                        </div>
                        <div style="display: flex; gap: 6px; margin-top: 6px;">
                            <span class="badge badge-gold">Комбо x${gamification.combo || 0}</span>
                            <span class="badge badge-silver">Рекорд: ${stats.bestStreak || 0}</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h2>📊 Прогресс</h2>
                        <div style="margin:12px 0">
                            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                                <span>${studied}/${totalQuestions}</span>
                                <span>${percent}%</span>
                            </div>
                            <div class="progress-bar" style="height:6px">
                                <div class="progress-fill" style="width:${percent}%"></div>
                            </div>
                        </div>
                        <div class="grid-2">
                            <div class="stat" onclick="showTheoryPage()">
                                <div class="stat-value">${theoryStudied}/${theoryCount}</div>
                                <div class="stat-label">Теория</div>
                            </div>
                            <div class="stat" onclick="showPracticePage()">
                                <div class="stat-value">${practiceStudied}/${practiceCount}</div>
                                <div class="stat-label">Практика</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="grid-4" style="margin-bottom: 12px;">
                        <div class="stat" onclick="showAchievementsPage()">
                            <div class="stat-value">${Object.keys(gamification.achievements).length}</div>
                            <div class="stat-label">Ачивки</div>
                        </div>
                        <div class="stat" onclick="showChallengesPage()">
                            <div class="stat-value">${Object.keys(gamification.dailyChallenges?.[today] || {}).length}</div>
                            <div class="stat-label">Задания</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${bookmarks.length}</div>
                            <div class="stat-label">⭐</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${Object.keys(notes).length}</div>
                            <div class="stat-label">📝</div>
                        </div>
                    </div>
                    
                    ${history.length > 0 ? `
                    <div class="card">
                        <h3>📜 История</h3>
                        <div style="max-height: 150px; overflow-y: auto;">
                            ${history.slice(0, 5).map(item => {
                                const q = allQuestions.find(q => q.id === item.id);
                                if (!q) return '';
                                return `
                                    <div class="history-item" onclick="showQuestionDetail(${q.id})">
                                        <span>${q.type === 'theory' ? '📚' : '⚗️'} Вопрос ${q.number}</span>
                                        <span class="history-time">${new Date(item.date).toLocaleTimeString()}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>` : ''}
                    
                    ${recent.length ? `
                    <div class="card">
                        <h3>📌 Недавние</h3>
                        <div class="grid-2">
                            ${recent.map(q => `
                                <div class="recent-item" onclick="showQuestionDetail(${q.id})">
                                    <span>${q.type==='theory'?'📚':'⚗️'}</span>
                                    <span>Вопрос ${q.number}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>` : ''}
                    
                    ${toReview.length ? `
                    <div class="card">
                        <h3>🔄 Повторить</h3>
                        <div class="grid-2">
                            ${toReview.map(q => `
                                <div class="recent-item" onclick="showQuestionDetail(${q.id})">
                                    <span>${q.type==='theory'?'📚':'⚗️'}</span>
                                    <span>Вопрос ${q.number}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>` : ''}
                    
                    <div class="card">
                        <h3>🚀 Действия</h3>
                        <div class="grid-2">
                            ${getLastViewedQuestion() ? `<button class="btn btn-primary" onclick="showQuestionDetail(${getLastViewedQuestion().id})">▶️ Продолжить: вопрос ${getLastViewedQuestion().number}</button>` : ''}
                            <button class="btn btn-secondary" onclick="showWeakQuestionsPage()">🎯 Слабые темы</button>
                            <button class="btn btn-primary" onclick="showTicketsPage()">📋 Билеты</button>
                            <button class="btn btn-secondary" onclick="showTheoryPage()">📚 Теория</button>
                            <button class="btn btn-secondary" onclick="showPracticePage()">⚗️ Практика</button>
                            <button class="btn btn-secondary" onclick="showQuizPage()">🧪 Тест</button>
                            <button class="btn btn-secondary" onclick="showRandomTicket()">🎲 Случайный билет</button>
                            <button class="btn btn-secondary" onclick="showRandomQuestion()">🎲 Случайный вопрос</button>
                            <button class="btn btn-secondary" onclick="showExamSelectionPage()">📝 Экзамен</button>
                            <button class="btn btn-secondary" onclick="showAchievementsPage()">🏆 Достижения</button>
                        </div>
                    </div>
                    
                    ${history.length > 0 ? `
                    <div class="card">
                        <h3>📅 Активность</h3>
                        <div class="activity-calendar">
                            ${generateActivityCalendar()}
                        </div>
                    </div>` : ''}
                    
                    <button class="floating-button" onclick="scrollToTop()">⬆️</button>
                </main>
                ${renderNavigation('Главная')}
            `;
            
            createParticles();
        }

        function scrollToTop() {
            document.querySelector('.main-content').scrollTo({ top: 0, behavior: 'smooth' });
        }

        function generateActivityCalendar() {
            const days = [];
            const today = new Date();
            
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const count = stats.dailyActivity?.[dateStr] || 0;
                
                const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
                const dayName = dayNames[date.getDay()];
                
                days.push(`
                    <div class="calendar-day" data-count="${Math.min(count, 9)}" 
                         title="${dateStr}: ${count}">
                        <div style="font-size: 0.5rem;">${dayName}</div>
                        <div style="font-size: 0.6rem; font-weight: bold;">${date.getDate()}</div>
                    </div>
                `);
            }
            
            return days.join('');
        }

        function showRandomTicket() {
            const randomNum = Math.floor(Math.random() * TOTAL_TICKETS) + 1;
            showTicket(randomNum);
        }

        function showRandomQuestion() {
            const randomIndex = Math.floor(Math.random() * allQuestions.length);
            showQuestionDetail(allQuestions[randomIndex].id);
        }

        // ========== ДОСТИЖЕНИЯ ==========
        function showAchievementsPage() {
            currentPageState = { name: 'achievements', params: {} };
            loadAllData();

            const totalStudied = Object.values(userProgress.questions || {}).filter(v => v).length;
            const practiceStudied = allQuestions.filter(q => q.type === 'practice' && userProgress.questions?.[q.id]).length;
            const totalQuizCorrect = (stats.quizResults || []).reduce((s, r) => s + r.score, 0);

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">🏆 Достижения</div>
                        <button onclick="showMainInterface()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <h2>Ваш прогресс</h2>
                        <div class="stats-grid">
                            <div class="stat">
                                <div class="stat-value">${gamification.level}</div>
                                <div class="stat-label">Уровень</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${gamification.xp}</div>
                                <div class="stat-label">XP</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${Object.keys(gamification.achievements).length}</div>
                                <div class="stat-label">Ачивки</div>
                            </div>
                        </div>
                        <div class="xp-bar" style="margin: 16px 0;">
                            <div class="xp-fill" style="width: ${(gamification.xp / gamification.xpToNextLevel) * 100}%"></div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>Все достижения</h3>
                        <div style="margin-top:12px">
                            ${achievements.map(a => {
                                let prog = 0;
                                if (a.id==='novice'||a.id==='expert'||a.id==='master') prog = totalStudied;
                                else if (a.id==='practice') prog = practiceStudied;
                                else if (a.id==='streak7'||a.id==='streak30') prog = userProgress.streak||0;
                                else if (a.id==='quizMaster') prog = totalQuizCorrect;
                                else if (a.id==='collector') prog = bookmarks.length;
                                else if (a.id==='writer') prog = Object.keys(notes).length;
                                else if (a.id==='perfectionist') prog = checkPerfectionist() ? 1 : 0;
                                else prog = 0;
                                
                                const perc = Math.min(100, (prog/a.target)*100);
                                const achieved = gamification.achievements?.[a.id];
                                return `
                                    <div class="achievement ${!achieved?'locked':'unlocked'}">
                                        <div class="achievement-icon">${a.icon}</div>
                                        <div class="achievement-info">
                                            <div class="achievement-title">${a.title}</div>
                                            <div class="achievement-progress">${prog}/${a.target}</div>
                                            <div class="progress-bar" style="margin-top:4px"><div class="progress-fill" style="width:${perc}%"></div></div>
                                        </div>
                                        ${achieved?'<div style="color:var(--success);">✓</div>':''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </main>
                ${renderNavigation('Статистика')}
            `;
        }

        function showChallengesPage() {
            currentPageState = { name: 'challenges', params: {} };
            loadAllData();

            const today = new Date().toISOString().split('T')[0];
            const week = getWeekNumber(new Date());

            const studiedToday = Object.values(userProgress.lastViewed || {}).filter(
                d => d && d.startsWith(today)
            ).length;
            const testsToday = stats.quizResults?.filter(r => r.date.startsWith(today)).length || 0;
            const bookmarksToday = stats.dailyBookmarks?.[today] || 0;
            const notesToday = stats.dailyNotes?.[today] || 0;
            const reviewedToday = userProgress.recentlyViewed?.filter(
                item => item.date && item.date.startsWith(today)
            ).length || 0;

            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay() + 1);
            startOfWeek.setHours(0,0,0,0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);

            const studiedWeek = Object.entries(userProgress.lastViewed || {}).filter(([id, date]) => {
                if (!date) return false;
                const d = new Date(date);
                return d >= startOfWeek && d < endOfWeek;
            }).length;
            const testsWeek = stats.quizResults?.filter(r => {
                const d = new Date(r.date);
                return d >= startOfWeek && d < endOfWeek;
            }).length || 0;
            const daysWeek = new Set();
            Object.entries(userProgress.lastViewed || {}).forEach(([id, date]) => {
                if (!date) return;
                const d = new Date(date);
                if (d >= startOfWeek && d < endOfWeek) {
                    daysWeek.add(d.toISOString().split('T')[0]);
                }
            });
            const daysCount = daysWeek.size;

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">🎯 Задания</div>
                        <button onclick="showMainInterface()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <h3>Ежедневные задания</h3>
                        <div style="margin-top:12px">
                            ${dailyChallenges.map(c => {
                                let prog = 0;
                                if (c.id === 'daily1') prog = studiedToday;
                                else if (c.id === 'daily2') prog = testsToday;
                                else if (c.id === 'daily3') prog = bookmarksToday;
                                else if (c.id === 'daily4') prog = notesToday;
                                else if (c.id === 'daily5') prog = reviewedToday;
                                
                                const completed = gamification.dailyChallenges?.[today]?.[c.id];
                                const perc = Math.min(100, (prog/c.target)*100);
                                
                                return `
                                    <div class="achievement ${completed ? 'unlocked' : ''}" style="margin-bottom: 12px;">
                                        <div class="achievement-icon">${c.icon}</div>
                                        <div class="achievement-info">
                                            <div class="achievement-title">${c.title}</div>
                                            <div class="achievement-progress">${prog}/${c.target} (${c.xp} XP)</div>
                                            <div class="progress-bar" style="margin-top:4px"><div class="progress-fill" style="width:${perc}%"></div></div>
                                        </div>
                                        ${completed ? '<div style="color:var(--success);">✓</div>' : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>Еженедельные челленджи</h3>
                        <div style="margin-top:12px">
                            ${weeklyChallenges.map(c => {
                                let prog = 0;
                                if (c.id === 'weekly1') prog = studiedWeek;
                                else if (c.id === 'weekly2') prog = testsWeek;
                                else if (c.id === 'weekly3') prog = daysCount;
                                else if (c.id === 'weekly4') prog = 0;
                                
                                const completed = gamification.weeklyChallenges?.[week]?.[c.id];
                                const perc = Math.min(100, (prog/c.target)*100);
                                
                                return `
                                    <div class="achievement ${completed ? 'unlocked' : ''}" style="margin-bottom: 12px;">
                                        <div class="achievement-icon">${c.icon}</div>
                                        <div class="achievement-info">
                                            <div class="achievement-title">${c.title}</div>
                                            <div class="achievement-progress">${prog}/${c.target} (${c.xp} XP)</div>
                                            <div class="progress-bar" style="margin-top:4px"><div class="progress-fill" style="width:${perc}%"></div></div>
                                        </div>
                                        ${completed ? '<div style="color:var(--success);">✓</div>' : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>Сундуки за streak</h3>
                        <div class="grid-3">
                            ${chests.map(c => {
                                const opened = gamification.chests?.includes(c.id);
                                const available = (userProgress.streak || 0) >= c.days;
                                return `
                                    <div class="stat" style="${opened ? 'background: rgba(0,255,0,0.1);' : ''}">
                                        <div class="stat-value">🎁</div>
                                        <div class="stat-label">${c.days} дней</div>
                                        <div style="font-size:0.6rem; margin-top:4px;">${c.xp} XP</div>
                                        ${opened ? '✓' : available ? '🔓' : '🔒'}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </main>
                ${renderNavigation('Статистика')}
            `;
        }

        function showHeatmapPage() {
            currentPageState = { name: 'heatmap', params: {} };
            loadAllData();

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">🔥 Тепловая карта</div>
                        <button onclick="showMainInterface()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <h3>Активность за 3 месяца</h3>
                        <div class="heatmap">
                            ${generateHeatmap()}
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>Активность по часам</h3>
                        <div style="display: flex; align-items: flex-end; height: 120px; gap: 1px; margin-top: 16px;">
                            ${stats.hourlyActivity.map((count, hour) => {
                                const height = Math.min(80, (count / Math.max(...stats.hourlyActivity, 1)) * 80);
                                return `
                                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                                        <div style="height: ${height}px; width: 100%; background: var(--accent); border-radius: 2px 2px 0 0;"></div>
                                        <div style="font-size: 0.55rem; margin-top: 4px;">${hour}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </main>
                ${renderNavigation('Статистика')}
            `;
        }

        function generateHeatmap() {
            const cells = [];
            const today = new Date();
            
            for (let i = 89; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const count = stats.dailyActivity?.[dateStr] || 0;
                const level = Math.min(9, count);
                
                cells.push(`
                    <div class="heatmap-cell" data-level="${level}" title="${dateStr}: ${count}"></div>
                `);
            }
            
            return cells.join('');
        }

        // ========== БИЛЕТЫ ==========
        function showTicketsPage(filter = 'all', sort = 'number') {
            currentPageState = { name: 'tickets', params: { filter, sort } };
            loadAllData();

            let filteredTickets = [...tickets];
            if (filter === 'completed') {
                filteredTickets = filteredTickets.filter(t => 
                    userProgress.questions?.[t.theory.id] && userProgress.questions?.[t.practice.id]
                );
            } else if (filter === 'incomplete') {
                filteredTickets = filteredTickets.filter(t => 
                    !(userProgress.questions?.[t.theory.id] && userProgress.questions?.[t.practice.id])
                );
            } else if (filter === 'bookmarked') {
                filteredTickets = filteredTickets.filter(t => 
                    bookmarks.includes(t.theory.id) || bookmarks.includes(t.practice.id)
                );
            } else if (filter === 'in-progress') {
                filteredTickets = filteredTickets.filter(t => 
                    (userProgress.questions?.[t.theory.id] || userProgress.questions?.[t.practice.id]) &&
                    !(userProgress.questions?.[t.theory.id] && userProgress.questions?.[t.practice.id])
                );
            }
            
            if (sort === 'number') {
                filteredTickets.sort((a, b) => a.number - b.number);
            } else if (sort === 'progress') {
                filteredTickets.sort((a, b) => {
                    const progA = (userProgress.questions?.[a.theory.id] ? 1 : 0) + (userProgress.questions?.[a.practice.id] ? 1 : 0);
                    const progB = (userProgress.questions?.[b.theory.id] ? 1 : 0) + (userProgress.questions?.[b.practice.id] ? 1 : 0);
                    return progB - progA;
                });
            }

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">📋 Билеты</div>
                        <button onclick="showMainInterface()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <div class="filter-chips">
                            <span class="filter-chip ${filter==='all'?'active':''}" onclick="showTicketsPage('all', '${sort}')">Все</span>
                            <span class="filter-chip ${filter==='completed'?'active':''}" onclick="showTicketsPage('completed', '${sort}')">✅ Выученные</span>
                            <span class="filter-chip ${filter==='incomplete'?'active':''}" onclick="showTicketsPage('incomplete', '${sort}')">○ Невыученные</span>
                            <span class="filter-chip ${filter==='in-progress'?'active':''}" onclick="showTicketsPage('in-progress', '${sort}')">⏳ В процессе</span>
                            <span class="filter-chip ${filter==='bookmarked'?'active':''}" onclick="showTicketsPage('bookmarked', '${sort}')">⭐ Избранное</span>
                        </div>
                        
                        <div class="form-group">
                            <select class="sort-select" onchange="showTicketsPage('${filter}', this.value)">
                                <option value="number" ${sort==='number'?'selected':''}>По номеру</option>
                                <option value="progress" ${sort==='progress'?'selected':''}>По прогрессу</option>
                            </select>
                        </div>
                        
                        <h2>Билеты (${filteredTickets.length})</h2>
                        <div style="margin-top:12px">
                            ${filteredTickets.map(t => {
                                const theoryDone = userProgress.questions?.[t.theory.id] || false;
                                const practiceDone = userProgress.questions?.[t.practice.id] || false;
                                const statusClass = (theoryDone && practiceDone) ? 'completed' : (theoryDone || practiceDone) ? 'in-progress' : 'pending';
                                const statusText = (theoryDone && practiceDone) ? '✅ Изучен' : (theoryDone || practiceDone) ? '⏳ В процессе' : '○ Новый';
                                const progressWidth = (theoryDone?50:0) + (practiceDone?50:0);
                                const bookmarked = bookmarks.includes(t.theory.id) || bookmarks.includes(t.practice.id);
                                return `
                                    <div class="ticket-item ${statusClass}" onclick="showTicket(${t.number})">
                                        <div class="ticket-header">
                                            <span class="ticket-number">Билет №${t.number} ${bookmarked ? '⭐' : ''}</span>
                                            <span class="ticket-status ${statusClass}">${statusText}</span>
                                        </div>
                                        <div style="color:var(--text-secondary); font-size:0.8rem">
                                            📚 ${escapeHtml(t.theory.text.substring(0,40))}...<br>
                                            ⚗️ ${escapeHtml(t.practice.text.substring(0,40))}...
                                        </div>
                                        <div class="ticket-progress">
                                            <div class="progress-bar"><div class="progress-fill" style="width:${progressWidth}%"></div></div>
                                            <span class="progress-text">${(theoryDone?1:0)+(practiceDone?1:0)}/2</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </main>
                ${renderNavigation('Билеты')}
            `;
        }

        function showTicket(ticketNumber) {
            currentPageState = { name: 'ticket', params: { ticketNumber } };
            loadAllData();
            const ticket = tickets.find(t => t.number === ticketNumber);
            if (!ticket) {
                showTicketsPage();
                return;
            }

            addToHistory(ticket.theory.id);
            addToHistory(ticket.practice.id);

            const theoryDone = userProgress.questions?.[ticket.theory.id] || false;
            const practiceDone = userProgress.questions?.[ticket.practice.id] || false;
            const theoryOpen = openedAnswers.has(ticket.theory.id);
            const practiceOpen = openedAnswers.has(ticket.practice.id);
            const theoryNote = notes[ticket.theory.id];
            const practiceNote = notes[ticket.practice.id];

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">Билет №${ticket.number}</div>
                        <button onclick="showTicketsPage()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <div class="ticket-progress" style="margin-bottom:12px">
                            <div class="progress-bar"><div class="progress-fill" style="width:${(theoryDone?50:0)+(practiceDone?50:0)}%"></div></div>
                            <span class="progress-text">${(theoryDone?1:0)+(practiceDone?1:0)}/2</span>
                        </div>
                        
                        <div class="question-card" id="q-${ticket.theory.id}">
                            <div class="question-header" onclick="toggleQuestionAnswer(${ticket.theory.id})">
                                <span class="question-number">Вопрос 1 (теория) 📚</span>
                                <button class="bookmark-btn ${bookmarks.includes(ticket.theory.id)?'active':''}" data-id="${ticket.theory.id}" onclick="event.stopPropagation(); toggleBookmark(${ticket.theory.id})">${bookmarks.includes(ticket.theory.id)?'⭐':'☆'}</button>
                            </div>
                            <div class="question-text">${escapeHtml(ticket.theory.text)}</div>
                            <div class="answer-container">
                                <div class="answer-content ${theoryOpen ? '' : 'hidden'}" id="answer-${ticket.theory.id}">${highlightTerms(ticket.theory.answer)}</div>
                                <div style="display:flex; gap:6px; margin-top:8px">
                                    <button class="btn btn-secondary" style="flex:1" onclick="toggleQuestionAnswer(${ticket.theory.id})">${theoryOpen ? '🔍 Скрыть' : '🔍 Показать'}</button>
                                    <button class="btn btn-secondary" style="flex:1" onclick="showNoteInput(${ticket.theory.id})">📝 Заметка</button>
                                </div>
                                <div id="note-${ticket.theory.id}" class="hidden" style="margin-top:8px">
                                    <textarea class="note-input" id="noteText-${ticket.theory.id}" rows="2" placeholder="Ваша заметка..." maxlength="2000" oninput="handleNoteInput(${ticket.theory.id}, this.value)">${theoryNote?.text?escapeHtml(theoryNote.text):''}</textarea>
                                    <div class="note-actions">
                                        <button class="btn btn-success" style="flex:1" onclick="saveNote(${ticket.theory.id}, document.getElementById('noteText-${ticket.theory.id}').value)">💾 Сохранить</button>
                                        ${theoryNote ? `<button class="btn btn-danger" style="flex:1" onclick="deleteNote(${ticket.theory.id})">🗑️ Удалить</button>` : ''}
                                    </div>
                                </div>
                                ${theoryNote ? `
                                <div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:0.8rem;">
                                    <small>📝 ${new Date(theoryNote.date).toLocaleDateString()}</small>
                                    <p>${escapeHtml(theoryNote.text)}</p>
                                </div>` : ''}
                                ${!theoryDone ? `<button class="btn btn-success" style="margin-top:8px" onclick="markQuestionLearned(${ticket.theory.id}, ${ticket.number})">✓ Отметить теорию</button>` : ''}
                            </div>
                        </div>
                        
                        <div class="question-card" id="q-${ticket.practice.id}">
                            <div class="question-header" onclick="toggleQuestionAnswer(${ticket.practice.id})">
                                <span class="question-number">Вопрос 2 (практика) ⚗️</span>
                                <button class="bookmark-btn ${bookmarks.includes(ticket.practice.id)?'active':''}" data-id="${ticket.practice.id}" onclick="event.stopPropagation(); toggleBookmark(${ticket.practice.id})">${bookmarks.includes(ticket.practice.id)?'⭐':'☆'}</button>
                            </div>
                            <div class="question-text">${escapeHtml(ticket.practice.text)}</div>
                            <div class="answer-container">
                                <div class="answer-content ${practiceOpen ? '' : 'hidden'}" id="answer-${ticket.practice.id}">${highlightTerms(ticket.practice.answer)}</div>
                                <div style="display:flex; gap:6px; margin-top:8px">
                                    <button class="btn btn-secondary" style="flex:1" onclick="toggleQuestionAnswer(${ticket.practice.id})">${practiceOpen ? '🔍 Скрыть' : '🔍 Показать'}</button>
                                    <button class="btn btn-secondary" style="flex:1" onclick="showNoteInput(${ticket.practice.id})">📝 Заметка</button>
                                </div>
                                <div id="note-${ticket.practice.id}" class="hidden" style="margin-top:8px">
                                    <textarea class="note-input" id="noteText-${ticket.practice.id}" rows="2" placeholder="Ваша заметка..." maxlength="2000" oninput="handleNoteInput(${ticket.practice.id}, this.value)">${practiceNote?.text?escapeHtml(practiceNote.text):''}</textarea>
                                    <div class="note-actions">
                                        <button class="btn btn-success" style="flex:1" onclick="saveNote(${ticket.practice.id}, document.getElementById('noteText-${ticket.practice.id}').value)">💾 Сохранить</button>
                                        ${practiceNote ? `<button class="btn btn-danger" style="flex:1" onclick="deleteNote(${ticket.practice.id})">🗑️ Удалить</button>` : ''}
                                    </div>
                                </div>
                                ${practiceNote ? `
                                <div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:0.8rem;">
                                    <small>📝 ${new Date(practiceNote.date).toLocaleDateString()}</small>
                                    <p>${escapeHtml(practiceNote.text)}</p>
                                </div>` : ''}
                                ${!practiceDone ? `<button class="btn btn-success" style="margin-top:8px" onclick="markQuestionLearned(${ticket.practice.id}, ${ticket.number})">✓ Отметить практику</button>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="grid grid-2">
                        ${ticket.number > 1 ? `<button class="btn btn-secondary" onclick="showTicket(${ticket.number-1})">← Пред.</button>` : '<div></div>'}
                        ${ticket.number < TOTAL_TICKETS ? `<button class="btn btn-primary" onclick="showTicket(${ticket.number+1})">След. →</button>` : '<div></div>'}
                    </div>
                    
                    <button class="btn btn-secondary" onclick="showRandomTicket()" style="margin-top: 6px;">🎲 Случайный билет</button>
                </main>
                ${renderNavigation('Билеты')}
            `;
        }

        function markQuestionLearned(questionId, ticketNumber) {
            const q = allQuestions.find(q => q.id === questionId);
            if (q) {
                if (!userProgress.questions?.[questionId]) {
                    updateProgress(questionId, q.type);
                }
                showTicket(ticketNumber);
            }
        }

        // ========== ТЕОРИЯ ==========
        function showTheoryPage(filter = 'all', search = '', sort = 'number') {
            currentPageState = { name: 'theory', params: { filter, search, sort } };
            loadAllData();

            let filtered = [...theoryQuestions];
            
            if (filter === 'completed') filtered = filtered.filter(q => userProgress.questions?.[q.id]);
            else if (filter === 'incomplete') filtered = filtered.filter(q => !userProgress.questions?.[q.id]);
            else if (filter === 'bookmarked') filtered = filtered.filter(q => bookmarks.includes(q.id));
            else if (filter === 'has-notes') filtered = filtered.filter(q => notes[q.id]);
            
            if (search) {
                filtered = smartSearch(search).filter(q => q.type === 'theory');
            }
            
            if (sort === 'number') {
                filtered.sort((a, b) => a.number - b.number);
            } else if (sort === 'date') {
                filtered.sort((a, b) => {
                    const dateA = userProgress.lastViewed?.[a.id] ? new Date(userProgress.lastViewed[a.id]) : new Date(0);
                    const dateB = userProgress.lastViewed?.[b.id] ? new Date(userProgress.lastViewed[b.id]) : new Date(0);
                    return dateB - dateA;
                });
            } else if (sort === 'time') {
                filtered.sort((a, b) => {
                    const timeA = userProgress.timeSpent?.[a.id] || 0;
                    const timeB = userProgress.timeSpent?.[b.id] || 0;
                    return timeB - timeA;
                });
            }

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">📚 Теория</div>
                        <button onclick="showMainInterface()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <div class="search-container">
                            <span class="search-icon">🔍</span>
                            <input type="text" class="search-input" id="theorySearch" placeholder="Поиск" value="${escapeHtml(search)}" oninput="debounceSearchTheory(this.value)">
                            <button class="search-clear" onclick="clearTheorySearch()">✕</button>
                        </div>
                        
                        <div class="filter-chips">
                            <span class="filter-chip ${filter==='all'?'active':''}" onclick="showTheoryPage('all', document.getElementById('theorySearch').value, '${sort}')">Все</span>
                            <span class="filter-chip ${filter==='completed'?'active':''}" onclick="showTheoryPage('completed', document.getElementById('theorySearch').value, '${sort}')">✅ Выученные</span>
                            <span class="filter-chip ${filter==='incomplete'?'active':''}" onclick="showTheoryPage('incomplete', document.getElementById('theorySearch').value, '${sort}')">○ Невыученные</span>
                            <span class="filter-chip ${filter==='bookmarked'?'active':''}" onclick="showTheoryPage('bookmarked', document.getElementById('theorySearch').value, '${sort}')">⭐ Избранное</span>
                            <span class="filter-chip ${filter==='has-notes'?'active':''}" onclick="showTheoryPage('has-notes', document.getElementById('theorySearch').value, '${sort}')">📝 С заметками</span>
                        </div>
                        
                        <div class="form-group">
                            <select class="sort-select" onchange="showTheoryPage('${filter}', document.getElementById('theorySearch').value, this.value)">
                                <option value="number" ${sort==='number'?'selected':''}>По номеру</option>
                                <option value="date" ${sort==='date'?'selected':''}>По дате</option>
                                <option value="time" ${sort==='time'?'selected':''}>По времени</option>
                            </select>
                        </div>
                        
                        <h2>Теория (${filtered.length})</h2>
                        <div style="margin-top:12px">
                            ${filtered.map(q => {
                                const done = userProgress.questions?.[q.id] || false;
                                const book = bookmarks.includes(q.id);
                                const hasNote = notes[q.id];
                                const timeSpent = userProgress.timeSpent?.[q.id] || 0;
                                return `
                                    <div class="question-card" onclick="showQuestionDetail(${q.id})">
                                        <div class="question-header">
                                            <span class="question-number">Вопрос №${q.number}</span>
                                            <span style="font-size:0.8rem">${book?'⭐':''} ${done?'✅':''} ${hasNote?'📝':''} ${timeSpent > 0 ? '⏱️' + Math.floor(timeSpent/60) + 'м' : ''}</span>
                                        </div>
                                        <div class="question-text">${highlightSearch(q.text, search)}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </main>
                ${renderNavigation('Теория')}
            `;
            document.getElementById('theorySearch')?.focus();
        }

        function highlightSearch(text, search) {
            if (!search) return escapeHtml(text);
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedSearch})`, 'gi');
            return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
        }

        const debounceSearchTheory = debounce((query) => {
            showTheoryPage(currentPageState.params.filter, query, currentPageState.params.sort);
        }, 300);

        function searchTheory(query) {
            debounceSearchTheory(query);
        }

        function clearTheorySearch() {
            showTheoryPage(currentPageState.params.filter, '', currentPageState.params.sort);
        }

        // ========== ПРАКТИКА ==========
        function showPracticePage(filter = 'all', search = '', sort = 'number') {
            currentPageState = { name: 'practice', params: { filter, search, sort } };
            loadAllData();

            let filtered = [...practiceQuestions];
            
            if (filter === 'completed') filtered = filtered.filter(q => userProgress.questions?.[q.id]);
            else if (filter === 'incomplete') filtered = filtered.filter(q => !userProgress.questions?.[q.id]);
            else if (filter === 'bookmarked') filtered = filtered.filter(q => bookmarks.includes(q.id));
            else if (filter === 'has-notes') filtered = filtered.filter(q => notes[q.id]);

            if (search) {
                filtered = smartSearch(search).filter(q => q.type === 'practice');
            }
            
            if (sort === 'number') {
                filtered.sort((a, b) => a.number - b.number);
            } else if (sort === 'date') {
                filtered.sort((a, b) => {
                    const dateA = userProgress.lastViewed?.[a.id] ? new Date(userProgress.lastViewed[a.id]) : new Date(0);
                    const dateB = userProgress.lastViewed?.[b.id] ? new Date(userProgress.lastViewed[b.id]) : new Date(0);
                    return dateB - dateA;
                });
            }

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">⚗️ Практика</div>
                        <button onclick="showMainInterface()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <div class="search-container">
                            <span class="search-icon">🔍</span>
                            <input type="text" class="search-input" id="practiceSearch" placeholder="Поиск" value="${escapeHtml(search)}" oninput="debounceSearchPractice(this.value)">
                            <button class="search-clear" onclick="clearPracticeSearch()">✕</button>
                        </div>
                        
                        <div class="filter-chips">
                            <span class="filter-chip ${filter==='all'?'active':''}" onclick="showPracticePage('all', document.getElementById('practiceSearch').value, '${sort}')">Все</span>
                            <span class="filter-chip ${filter==='completed'?'active':''}" onclick="showPracticePage('completed', document.getElementById('practiceSearch').value, '${sort}')">✅ Выученные</span>
                            <span class="filter-chip ${filter==='incomplete'?'active':''}" onclick="showPracticePage('incomplete', document.getElementById('practiceSearch').value, '${sort}')">○ Невыученные</span>
                            <span class="filter-chip ${filter==='bookmarked'?'active':''}" onclick="showPracticePage('bookmarked', document.getElementById('practiceSearch').value, '${sort}')">⭐ Избранное</span>
                            <span class="filter-chip ${filter==='has-notes'?'active':''}" onclick="showPracticePage('has-notes', document.getElementById('practiceSearch').value, '${sort}')">📝 С заметками</span>
                        </div>
                        
                        <div class="form-group">
                            <select class="sort-select" onchange="showPracticePage('${filter}', document.getElementById('practiceSearch').value, this.value)">
                                <option value="number" ${sort==='number'?'selected':''}>По номеру</option>
                                <option value="date" ${sort==='date'?'selected':''}>По дате</option>
                            </select>
                        </div>
                        
                        <h2>Практика (${filtered.length})</h2>
                        <div style="margin-top:12px">
                            ${filtered.map(q => {
                                const done = userProgress.questions?.[q.id] || false;
                                const book = bookmarks.includes(q.id);
                                const hasNote = notes[q.id];
                                return `
                                    <div class="question-card" onclick="showQuestionDetail(${q.id})">
                                        <div class="question-header">
                                            <span class="question-number">Задание №${q.number}</span>
                                            <span style="font-size:0.8rem">${book?'⭐':''} ${done?'✅':''} ${hasNote?'📝':''}</span>
                                        </div>
                                        <div class="question-text">${highlightSearch(q.text, search)}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </main>
                ${renderNavigation('Практика')}
            `;
            document.getElementById('practiceSearch')?.focus();
        }

        const debounceSearchPractice = debounce((query) => {
            showPracticePage(currentPageState.params.filter, query, currentPageState.params.sort);
        }, 300);

        function searchPractice(query) {
            debounceSearchPractice(query);
        }

        function clearPracticeSearch() {
            showPracticePage(currentPageState.params.filter, '', currentPageState.params.sort);
        }

        // ========== ДЕТАЛИ ВОПРОСА ==========
        function showQuestionDetail(questionId) {
            currentPageState = { name: 'detail', params: { questionId } };
            loadAllData();
            const q = allQuestions.find(q => q.id === questionId);
            if (!q) {
                showTheoryPage();
                return;
            }

            addToHistory(questionId);
            
            if (!userProgress.lastViewed) userProgress.lastViewed = {};
            userProgress.lastViewed[questionId] = new Date().toISOString();

            const done = userProgress.questions?.[q.id] || false;
            const book = bookmarks.includes(q.id);
            const note = notes[q.id];
            const answerOpen = openedAnswers.has(q.id);
            const ticketInfo = getTicketInfoByQuestionId(q.id);
            const backPage = q.type === 'theory' ? 'showTheoryPage' : 'showPracticePage';
            const timeSpent = userProgress.timeSpent?.[q.id] || 0;
            const questionTags = tags[q.id] || [];

            const sameTypeQuestions = q.type === 'theory' ? theoryQuestions : practiceQuestions;
            const currentIndex = sameTypeQuestions.findIndex(item => item.id === q.id);
            const prevQuestion = currentIndex > 0 ? sameTypeQuestions[currentIndex - 1] : null;
            const nextQuestion = currentIndex < sameTypeQuestions.length - 1 ? sameTypeQuestions[currentIndex + 1] : null;

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">Вопрос №${q.number}</div>
                        <button onclick="${backPage}()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="question-card">
                        <div class="question-header" onclick="toggleQuestionAnswer(${q.id})">
                            <span class="question-number">${q.type==='theory'?'📚 Теория':'⚗️ Практика'}</span>
                            <div>
                                <span style="margin-right: 6px; color: #888; font-size:0.8rem;">⏱️ ${Math.floor(timeSpent/60)}м</span>
                                <button class="bookmark-btn ${book?'active':''}" data-id="${q.id}" onclick="event.stopPropagation(); toggleBookmark(${q.id})">${book?'⭐':'☆'}</button>
                            </div>
                        </div>
                        <div class="question-text">${escapeHtml(q.text)}</div>
                        <div class="answer-container">
                            <div class="answer-content ${answerOpen ? '' : 'hidden'}" id="answer-${q.id}">${highlightTerms(q.answer)}</div>
                            <div style="display:flex; gap:6px; margin-top:8px">
                                <button class="btn btn-secondary" style="flex:1" onclick="toggleQuestionAnswer(${q.id})">${answerOpen ? '🔍 Скрыть' : '🔍 Показать'}</button>
                                <button class="btn btn-secondary" style="flex:1" onclick="showNoteInput(${q.id})">📝 Заметка</button>
                            </div>
                            <div id="note-${q.id}" class="hidden" style="margin-top:8px">
                                <textarea class="note-input" id="noteText-${q.id}" rows="2" placeholder="Ваша заметка..." maxlength="2000" oninput="handleNoteInput(${q.id}, this.value)">${note?.text?escapeHtml(note.text):''}</textarea>
                                <div class="note-actions">
                                    <button class="btn btn-success" style="flex:1" onclick="saveNote(${q.id}, document.getElementById('noteText-${q.id}').value)">💾 Сохранить</button>
                                    ${note ? `<button class="btn btn-danger" style="flex:1" onclick="deleteNote(${q.id})">🗑️ Удалить</button>` : ''}
                                </div>
                            </div>
                            ${note ? `
                            <div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:0.8rem;">
                                <small>📝 ${new Date(note.date).toLocaleDateString()}</small>
                                <p>${escapeHtml(note.text)}</p>
                            </div>` : ''}
                            
                            ${questionTags.length > 0 ? `
                            <div style="margin-top:8px">
                                ${questionTags.map(tag => `<span class="tag" onclick="removeTag(${q.id}, '${escapeHtml(tag)}')">#${escapeHtml(tag)} ✕</span>`).join('')}
                            </div>
                            ` : ''}
                            
                            <div style="margin-top:8px">
                                <input type="text" class="form-input" placeholder="Добавить тег..." id="tag-${q.id}" style="padding: 6px; font-size:0.8rem;">
                                <button class="btn btn-secondary" style="margin-top:4px;" onclick="addTag(${q.id}, document.getElementById('tag-${q.id}').value); document.getElementById('tag-${q.id}').value=''">➕ Добавить тег</button>
                            </div>
                            
                            ${!done ? `<button class="btn btn-success" style="margin-top:8px" onclick="markQuestionLearnedSingle(${q.id})">✓ Отметить изученным</button>` : ''}
                            ${ticketInfo ? `<button class="btn btn-secondary" style="margin-top:8px" onclick="showTicket(${ticketInfo.number})">🎫 Перейти к билету №${ticketInfo.number}</button>` : ''}
                        </div>
                    </div>
                    
                    <div class="grid grid-2" style="margin-top: 12px;">
                        ${prevQuestion ? `<button class="btn btn-secondary" onclick="showQuestionDetail(${prevQuestion.id})">← Вопрос ${prevQuestion.number}</button>` : '<div></div>'}
                        ${nextQuestion ? `<button class="btn btn-primary" onclick="showQuestionDetail(${nextQuestion.id})">Вопрос ${nextQuestion.number} →</button>` : '<div></div>'}
                    </div>
                    
                    <button class="btn btn-secondary" onclick="showRandomQuestion()" style="margin-top: 6px;">🎲 Случайный вопрос</button>
                </main>
                ${renderNavigation(q.type==='теория'?'Теория':'Практика')}
            `;
        }

        function markQuestionLearnedSingle(questionId) {
            const q = allQuestions.find(q => q.id === questionId);
            if (q) {
                if (!userProgress.questions?.[questionId]) {
                    updateProgress(questionId, q.type);
                }
                showQuestionDetail(questionId);
            }
        }

        // ========== СТАТИСТИКА ==========
        function showStatsPage() {
            currentPageState = { name: 'stats', params: {} };
            loadAllData();

            const totalQuestions = allQuestions.length;
            const studied = Object.values(userProgress.questions || {}).filter(v=>v).length;
            const percent = totalQuestions ? Math.round((studied/totalQuestions)*100) : 0;

            const theoryCount = theoryQuestions.length;
            const practiceCount = practiceQuestions.length;
            const theoryStudied = theoryQuestions.filter(q => userProgress.questions?.[q.id]).length;
            const practiceStudied = practiceQuestions.filter(q => userProgress.questions?.[q.id]).length;

            const last7Days = [];
            for (let i=6; i>=0; i--) {
                const d = new Date(); d.setDate(d.getDate()-i);
                const ds = d.toISOString().split('T')[0];
                last7Days.push({ date: ds, day: d.toLocaleDateString('ru-RU',{weekday:'short'}), count: stats.dailyActivity?.[ds] || 0 });
            }
            const maxAct = Math.max(...last7Days.map(d=>d.count),1);

            const quizResults = stats.quizResults || [];
            const totalQuizTaken = quizResults.length;
            const totalQuizQuestions = quizResults.reduce((s,r) => s + r.total, 0);
            const totalQuizCorrect = quizResults.reduce((s,r) => s + r.score, 0);
            const avgPercent = totalQuizQuestions ? Math.round((totalQuizCorrect / totalQuizQuestions) * 100) : 0;

            const totalTime = userProgress.studyTime || 0;
            const avgTimePerQuestion = studied ? Math.floor(totalTime / studied) : 0;

            const mostViewed = Object.entries(userProgress.lastViewed || {})
                .map(([id, date]) => ({ id: parseInt(id), date }))
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5)
                .map(item => allQuestions.find(q => q.id === item.id))
                .filter(q => q);

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">📊 Статистика</div>
                        <button onclick="showMainInterface()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <h2>Общий прогресс</h2>
                        <div class="stats-grid">
                            <div class="stat"><div class="stat-value">${studied}</div><div class="stat-label">Изучено</div></div>
                            <div class="stat"><div class="stat-value">${totalQuestions-studied}</div><div class="stat-label">Осталось</div></div>
                            <div class="stat"><div class="stat-value">${percent}%</div><div class="stat-label">Прогресс</div></div>
                        </div>
                        <div class="progress-bar" style="margin:12px 0"><div class="progress-fill" style="width:${percent}%"></div></div>
                        <div class="grid-2">
                            <div class="stat"><div class="stat-value">${theoryStudied}/${theoryCount}</div><div class="stat-label">Теория</div></div>
                            <div class="stat"><div class="stat-value">${practiceStudied}/${practiceCount}</div><div class="stat-label">Практика</div></div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>Активность за неделю</h3>
                        <div style="display:flex;justify-content:space-around;align-items:flex-end;height:80px;margin-top:16px">
                            ${last7Days.map(d => `
                                <div style="display:flex;flex-direction:column;align-items:center;width:30px">
                                    <div style="height:${(d.count/maxAct)*50}px;width:15px;background:linear-gradient(135deg,var(--accent),#9b59b6);border-radius:4px 4px 0 0"></div>
                                    <div style="margin-top:4px;font-size:0.6rem;color:#888">${d.day}</div>
                                    <div style="font-size:0.55rem;color:var(--accent)">${d.count}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>Время занятий</h3>
                        <div class="stats-grid">
                            <div class="stat"><div class="stat-value">${Math.floor(totalTime/60)}ч ${totalTime%60}м</div><div class="stat-label">Всего</div></div>
                            <div class="stat"><div class="stat-value">${avgTimePerQuestion}м</div><div class="stat-label">На вопрос</div></div>
                            <div class="stat"><div class="stat-value">${userProgress.streak || 0}</div><div class="stat-label">Дней</div></div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>Статистика тестов</h3>
                        <div class="stats-grid">
                            <div class="stat"><div class="stat-value">${totalQuizTaken}</div><div class="stat-label">Тестов</div></div>
                            <div class="stat"><div class="stat-value">${avgPercent}%</div><div class="stat-label">Средний</div></div>
                            <div class="stat"><div class="stat-value">${totalQuizCorrect}</div><div class="stat-label">Правильных</div></div>
                        </div>
                        ${quizResults.length > 0 ? `
                        <div style="margin-top:12px">
                            <h4>Последние</h4>
                            ${quizResults.slice(-5).reverse().map(r => `
                                <div style="display:flex;justify-content:space-between;padding:6px;border-bottom:1px solid var(--border-color);font-size:0.8rem">
                                    <span>${new Date(r.date).toLocaleDateString()}</span>
                                    <span>${r.score}/${r.total} (${r.percentage}%)</span>
                                </div>
                            `).join('')}
                        </div>` : ''}
                    </div>
                    
                    ${mostViewed.length > 0 ? `
                    <div class="card">
                        <h3>Часто просматриваемые</h3>
                        ${mostViewed.map(q => `
                            <div class="recent-item" onclick="showQuestionDetail(${q.id})" style="font-size:0.8rem">
                                <span>${q.type==='theory'?'📚':'⚗️'} Вопрос ${q.number}</span>
                                <span class="history-time">${new Date(userProgress.lastViewed[q.id]).toLocaleDateString()}</span>
                            </div>
                        `).join('')}
                    </div>` : ''}
                    
                    <div class="grid-2" style="margin-top: 12px;">
                        <button class="btn btn-secondary" onclick="showAchievementsPage()">🏆 Достижения</button>
                        <button class="btn btn-secondary" onclick="showHeatmapPage()">🔥 Тепловая карта</button>
                    </div>
                </main>
                ${renderNavigation('Статистика')}
            `;
        }

        // ========== НАСТРОЙКИ ==========
        function showSettingsPage() {
            currentPageState = { name: 'settings', params: {} };
            loadAllData();

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">⚙️ Настройки</div>
                        <button onclick="showMainInterface()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <h3>🎨 Тема</h3>
                        <div class="theme-toggle">
                            <div class="theme-option ${settings.theme==='dark'?'active':''}" onclick="setTheme('dark')">🌙 Темная</div>
                            <div class="theme-option ${settings.theme==='light'?'active':''}" onclick="setTheme('light')">☀️ Светлая</div>
                            <div class="theme-option ${settings.theme==='neon'?'active':''}" onclick="setTheme('neon')">✨ Неоновая</div>
                            <div class="theme-option ${settings.theme==='pastel'?'active':''}" onclick="setTheme('pastel')">🎨 Пастельная</div>
                        </div>
                        
                        <div style="margin-top: 12px;">
                            <label class="form-label">Акцентный цвет</label>
                            <div class="color-picker">
                                <div class="color-option ${settings.accentColor==='#00d4ff'?'selected':''}" style="background: #00d4ff;" onclick="setAccentColor('#00d4ff')"></div>
                                <div class="color-option ${settings.accentColor==='#ff6b6b'?'selected':''}" style="background: #ff6b6b;" onclick="setAccentColor('#ff6b6b')"></div>
                                <div class="color-option ${settings.accentColor==='#4ecdc4'?'selected':''}" style="background: #4ecdc4;" onclick="setAccentColor('#4ecdc4')"></div>
                                <div class="color-option ${settings.accentColor==='#ffd93d'?'selected':''}" style="background: #ffd93d;" onclick="setAccentColor('#ffd93d')"></div>
                                <div class="color-option ${settings.accentColor==='#a8e6cf'?'selected':''}" style="background: #a8e6cf;" onclick="setAccentColor('#a8e6cf')"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>🔤 Размер шрифта</h3>
                        <input type="range" class="settings-slider" min="13" max="20" value="${settings.fontSize}" onchange="setFontSize(this.value)">
                        <div style="text-align:center;margin-top:6px;font-size:0.8rem">${settings.fontSize}px</div>
                    </div>
                    
                    <div class="card">
                        <h3>🔔 Звук и вибрация</h3>
                        <div class="checkbox-label" style="font-size:0.8rem">
                            <input type="checkbox" ${settings.sound ? 'checked' : ''} onchange="toggleSound(this.checked)">
                            <span>Звуковые эффекты</span>
                        </div>
                        <div class="checkbox-label" style="font-size:0.8rem">
                            <input type="checkbox" ${settings.vibration ? 'checked' : ''} onchange="toggleVibration(this.checked)">
                            <span>Вибрация</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>⏰ Напоминания</h3>
                        <div class="checkbox-label" style="font-size:0.8rem">
                            <input type="checkbox" ${settings.reminders ? 'checked' : ''} onchange="toggleReminders(this.checked)">
                            <span>Включить</span>
                        </div>
                        <div class="form-group" style="margin-top: 8px;">
                            <label class="form-label">Время</label>
                            <input type="time" class="form-input" value="${settings.reminderTime}" onchange="setReminderTime(this.value)" style="padding:6px">
                        </div>
                        <button class="btn btn-secondary" onclick="requestNotificationPermission()">🔔 Разрешить уведомления</button>
                    </div>
                    
                    <div class="card">
                        <h3>⚡ Дополнительно</h3>
                        <div class="checkbox-label" style="font-size:0.8rem">
                            <input type="checkbox" ${settings.autoSave ? 'checked' : ''} onchange="toggleAutoSave(this.checked)">
                            <span>Автосохранение заметок</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>📤 Экспорт / Импорт</h3>
                        <button class="btn btn-secondary export-btn" onclick="exportToTxt()">📄 Скачать вопросы</button>
                        <button class="btn btn-secondary export-btn" onclick="exportProgress()" style="margin-top:6px">📤 Экспорт прогресса</button>
                        <div style="margin-top:12px">
                            <label class="btn btn-secondary" for="importFile">📥 Импорт прогресса</label>
                            <input type="file" id="importFile" accept=".json" style="display:none" onchange="importProgress(this.files[0])">
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>⚠️ Опасная зона</h3>
                        <button class="btn btn-danger" onclick="resetProgress()">🗑️ Сбросить прогресс</button>
                    </div>
                </main>
                ${renderNavigation('Настройки')}
            `;
        }

        function setTheme(theme) {
            settings.theme = theme;
            applySettings();
            saveAllData();
            showSettingsPage();
        }

        function setAccentColor(color) {
            settings.accentColor = color;
            applySettings();
            saveAllData();
            showSettingsPage();
        }

        function setFontSize(size) {
            settings.fontSize = parseInt(size);
            applySettings();
            saveAllData();
            showSettingsPage();
        }

        function toggleSound(enabled) {
            settings.sound = enabled;
            saveAllData();
        }

        function toggleVibration(enabled) {
            settings.vibration = enabled;
            saveAllData();
        }

        function toggleReminders(enabled) {
            settings.reminders = enabled;
            if (enabled) {
                setupReminder();
                requestNotificationPermission();
            } else if (reminderTimeout) {
                clearTimeout(reminderTimeout);
            }
            saveAllData();
        }

        function setReminderTime(time) {
            settings.reminderTime = time;
            if (settings.reminders) {
                setupReminder();
            }
            saveAllData();
        }

        function toggleAutoSave(enabled) {
            settings.autoSave = enabled;
            saveAllData();
        }

        // ========== ТЕСТ ==========
        function showQuizPage() {
            currentPageState = { name: 'quiz', params: {} };
            loadAllData();

            // Очищаем предыдущий интервал, если есть
            if (activeQuizInterval) clearInterval(activeQuizInterval);

            const shuffled = [...quizQuestions].sort(()=>Math.random()-0.5).slice(0,10);
            if (shuffled.length === 0) {
                showToast('Нет тестовых вопросов', 'info');
                showMainInterface();
                return;
            }
            
            let currentIndex = 0;
            let score = 0;
            let selectedOption = null;
            let answerSubmitted = false;
            let timeLeft = 600;
            let startTime = Date.now();

            const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

            function showQuestion() {
                if (currentIndex >= shuffled.length) {
                    clearInterval(activeQuizInterval);
                    showResults();
                    return;
                }
                const q = shuffled[currentIndex];
                const progress = (currentIndex/shuffled.length)*100;

                const app = document.getElementById('app');
                app.innerHTML = `
                    <header class="header">
                        <div class="header-content">
                            <div class="logo-text">🧪 Тест</div>
                            <button onclick="showMainInterface()" class="back-btn">✕</button>
                        </div>
                    </header>
                    <main id="main-content" class="main-content scroll-container">
                        <div class="quiz-progress">
                            <span class="quiz-score">⭐ ${score}/${currentIndex}</span>
                            <span class="timer ${timeLeft < 60 ? 'warning' : ''}">⏱️ ${formatTime(timeLeft)}</span>
                        </div>
                        <div class="progress-bar" style="margin-bottom:16px"><div class="progress-fill" style="width:${progress}%"></div></div>
                        <div class="card">
                            <h3>Вопрос ${currentIndex+1}/${shuffled.length}</h3>
                            <p style="font-size:0.9rem;margin:16px 0">${q.question || 'Вопрос не загружен'}</p>
                            <div style="margin-top:16px">
                                ${(q.options || []).map((opt,idx)=>`
                                    <div class="quiz-option ${selectedOption===idx?'selected':''}" onclick="window.selectQuizOption(${idx})">
                                        <span class="quiz-marker ${selectedOption===idx?'selected':''}">${String.fromCharCode(65+idx)}</span>
                                        <span>${escapeHtml(opt)}</span>
                                    </div>
                                `).join('')}
                            </div>
                            <div style="margin-top:16px; display:flex; gap:6px;">
                                ${!answerSubmitted ? 
                                    `<button class="btn btn-primary" style="flex:2" onclick="window.submitQuizAnswer(${q.correct})" ${selectedOption===null?'disabled':''}>✅ Ответить</button>
                                     <button class="btn btn-secondary" style="flex:1" onclick="window.skipQuizQuestion()">⏭️ Пропустить</button>` :
                                    `<button class="btn btn-success" style="flex:1" onclick="window.nextQuizQuestion()">Следующий →</button>`
                                }
                            </div>
                            ${answerSubmitted ? `
                                <div style="margin-top:16px;padding:12px;background:rgba(0,212,255,0.1);border-radius:10px;font-size:0.85rem">
                                    <p style="color:${selectedOption===q.correct?'var(--success)':'var(--danger)'}">
                                        ${selectedOption===q.correct ? '✅ Правильно!' : `❌ Неправильно. Правильный: ${escapeHtml(q.options[q.correct])}`}
                                    </p>
                                </div>
                            ` : ''}
                        </div>
                    </main>
                `;
                window.selectQuizOption = (idx) => { if(!answerSubmitted) { selectedOption=idx; showQuestion(); } };
                window.submitQuizAnswer = (correctIdx) => {
                    if(selectedOption!==null && !answerSubmitted) {
                        answerSubmitted = true;
                        if(selectedOption===correctIdx) {
                            score++;
                            playSound('correct');
                            vibrate(30);
                            
                            const answerTime = (Date.now() - startTime) / 1000;
                            if (answerTime < 10) {
                                checkAchievement('speedster');
                            }
                        } else {
                            playSound('wrong');
                            vibrate([30, 30, 30]);
                        }
                        showQuestion();
                    }
                };
                window.skipQuizQuestion = () => {
                    if(!answerSubmitted) {
                        answerSubmitted = true;
                        currentIndex++;
                        selectedOption = null;
                        answerSubmitted = false;
                        showQuestion();
                    }
                };
                window.nextQuizQuestion = () => {
                    currentIndex++;
                    selectedOption = null;
                    answerSubmitted = false;
                    showQuestion();
                };
            }

            function showResults() {
                const percent = Math.round((score/shuffled.length)*100);
                if(!stats.quizResults) stats.quizResults=[];
                stats.quizResults.push({ date: new Date().toISOString(), score, total: shuffled.length, percentage: percent });
                if (stats.quizResults.length > 30) stats.quizResults.shift();
                
                addXP(score * 10, 'тест');
                
                if (percent === 100) {
                    checkAchievement('perfectionist');
                }
                
                saveAllData();
                checkAchievements();
                checkDailyChallenge('daily2'); // проверяем задание на тест

                const app = document.getElementById('app');
                app.innerHTML = `
                    <header class="header">
                        <div class="header-content">
                            <div class="logo-text">📊 Результаты</div>
                            <button onclick="showMainInterface()" class="back-btn">✕</button>
                        </div>
                    </header>
                    <main id="main-content" class="main-content scroll-container">
                        <div class="card">
                            <div style="text-align:center">
                                <h1 style="font-size:2.5rem">${percent}%</h1>
                                <p>Правильных: ${score}/${shuffled.length}</p>
                                <p>+${score * 10} XP</p>
                            </div>
                            <div class="progress-bar" style="height:8px;margin:16px 0"><div class="progress-fill" style="width:${percent}%"></div></div>
                            <div class="grid-2">
                                <button class="btn btn-primary" onclick="showQuizPage()">🔄 Ещё раз</button>
                                <button class="btn btn-secondary" onclick="showMainInterface()">🏠 Главная</button>
                            </div>
                        </div>
                    </main>
                `;
            }

            activeQuizInterval = setInterval(() => {
                timeLeft--;
                if(timeLeft<=0) { 
                    clearInterval(activeQuizInterval); 
                    if (currentIndex < shuffled.length) showResults(); 
                }
                else {
                    const t = document.querySelector('.timer');
                    if(t) {
                        t.textContent = `⏱️ ${formatTime(timeLeft)}`;
                        t.classList.toggle('warning', timeLeft < 60);
                    }
                }
            },1000);

            showQuestion();
        }

        // ========== ФЛЕШ-КАРТОЧКИ ==========
        function showFlashcardsPage(category = 'all', mode = 'unlearned') {
            currentPageState = { name: 'flashcards', params: { category, mode } };
            loadAllData();

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">🃏 Карточки</div>
                        <button onclick="showMainInterface()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <h3>Настройки</h3>
                        <div class="form-group">
                            <label class="form-label">Категория</label>
                            <div class="filter-chips">
                                <span class="filter-chip ${category==='all'?'active':''}" onclick="showFlashcardsPage('all', '${mode}')">Все</span>
                                <span class="filter-chip ${category==='theory'?'active':''}" onclick="showFlashcardsPage('theory', '${mode}')">📚 Теория</span>
                                <span class="filter-chip ${category==='practice'?'active':''}" onclick="showFlashcardsPage('practice', '${mode}')">⚗️ Практика</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Режим</label>
                            <div class="filter-chips">
                                <span class="filter-chip ${mode==='unlearned'?'active':''}" onclick="showFlashcardsPage('${category}', 'unlearned')">○ Невыученные</span>
                                <span class="filter-chip ${mode==='all'?'active':''}" onclick="showFlashcardsPage('${category}', 'all')">📚 Все</span>
                                <span class="filter-chip ${mode==='bookmarked'?'active':''}" onclick="showFlashcardsPage('${category}', 'bookmarked')">⭐ Избранное</span>
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="startFlashcards('${category}', '${mode}')">▶️ Начать</button>
                    </div>
                </main>
                ${renderNavigation('Карточки')}
            `;
        }

        function startFlashcards(category, mode) {
            loadAllData();
            let questions = [];
            if (category === 'all') questions = [...allQuestions];
            else if (category === 'theory') questions = [...theoryQuestions];
            else if (category === 'practice') questions = [...practiceQuestions];

            if (mode === 'unlearned') questions = questions.filter(q => !userProgress.questions?.[q.id]);
            else if (mode === 'bookmarked') questions = questions.filter(q => bookmarks.includes(q.id));

            if (questions.length === 0) {
                showToast('Нет вопросов для данной категории', 'info');
                showFlashcardsPage(category, mode);
                return;
            }

            questions = questions.sort(() => Math.random() - 0.5);
            runFlashcardsSession(questions);
        }

        function runFlashcardsSession(questions) {
            let remaining = [...questions];
            let currentIndex = 0;
            let flipped = false;
            let startX, currentX, isDragging = false, dragDelta = 0;
            let container = document.getElementById('flashcard-container');

            function renderCard() {
                if (remaining.length === 0) {
                    showToast('🎉 Все карточки пройдены!', 'success');
                    playSound('achievement');
                    showFlashcardsPage();
                    return;
                }
                const q = remaining[currentIndex];
                const app = document.getElementById('app');
                app.innerHTML = `
                    <header class="header">
                        <div class="header-content">
                            <div class="logo-text">🃏 Карточки (осталось ${remaining.length})</div>
                            <button onclick="showFlashcardsPage()" class="back-btn">✕</button>
                        </div>
                    </header>
                    <main id="main-content" class="main-content scroll-container">
                        <div class="flashcard-container" id="flashcard-container">
                            <div class="flashcard ${flipped ? 'flipped' : ''}" id="flashcard" ontouchstart="handleTouchStart(event)" ontouchmove="handleTouchMove(event)" ontouchend="handleTouchEnd(event)" ontouchcancel="handleTouchCancel(event)">
                                <div class="flashcard-front">
                                    <p style="font-size:1.1rem; margin-bottom:8px;">${escapeHtml(q.text)}</p>
                                    <small style="color:#888;">Нажмите для ответа, потяните влево/вправо</small>
                                </div>
                                <div class="flashcard-back">
                                    <p>${escapeHtml(q.answer)}</p>
                                </div>
                            </div>
                        </div>
                        <div class="grid-2" style="margin-top:16px;">
                            <button class="btn btn-danger" onclick="flashcardSwipeLeft()">❌ Не знаю</button>
                            <button class="btn btn-success" onclick="flashcardSwipeRight()">✅ Знаю</button>
                        </div>
                    </main>
                `;
                
                container = document.getElementById('flashcard-container');
                window.flashcard = document.getElementById('flashcard');
                
                window.handleTouchStart = (e) => {
                    startX = e.touches[0].clientX;
                    isDragging = true;
                    window.flashcard.classList.add('dragging');
                    e.preventDefault(); // предотвращаем прокрутку
                };
                
                window.handleTouchMove = (e) => {
                    if (!isDragging) return;
                    currentX = e.touches[0].clientX;
                    dragDelta = currentX - startX;
                    
                    if (dragDelta > 0) {
                        window.flashcard.style.transform = `translateX(${dragDelta}px)`;
                        window.flashcard.classList.add('swipe-right');
                        window.flashcard.classList.remove('swipe-left');
                        container?.classList.add('swiping-right');
                        container?.classList.remove('swiping-left');
                    } else if (dragDelta < 0) {
                        window.flashcard.style.transform = `translateX(${dragDelta}px)`;
                        window.flashcard.classList.add('swipe-left');
                        window.flashcard.classList.remove('swipe-right');
                        container?.classList.add('swiping-left');
                        container?.classList.remove('swiping-right');
                    }
                    e.preventDefault();
                };
                
                window.handleTouchEnd = (e) => {
                    if (!isDragging) return;
                    isDragging = false;
                    window.flashcard.classList.remove('dragging');
                    window.flashcard.style.transform = '';
                    container?.classList.remove('swiping-left', 'swiping-right');
                    
                    if (dragDelta > 40) {
                        flashcardSwipeRight();
                    } else if (dragDelta < -40) {
                        flashcardSwipeLeft();
                    }
                    
                    window.flashcard.classList.remove('swipe-left', 'swipe-right');
                    dragDelta = 0;
                    e.preventDefault();
                };

                window.handleTouchCancel = (e) => {
                    handleTouchEnd(e);
                };
                
                window.flashcardSwipeLeft = () => {
                    playSound('wrong');
                    vibrate(30);
                    currentIndex++;
                    if (currentIndex >= remaining.length) currentIndex = 0;
                    flipped = false;
                    renderCard();
                };
                
                window.flashcardSwipeRight = () => {
                    const qq = remaining[currentIndex];
                    if (qq && !userProgress.questions?.[qq.id]) {
                        updateProgress(qq.id, qq.type);
                        playSound('correct');
                        vibrate(30);
                    }
                    remaining.splice(currentIndex, 1);
                    if (currentIndex >= remaining.length) currentIndex = 0;
                    flipped = false;
                    renderCard();
                };
                
                window.flashcard.onclick = () => {
                    flipped = !flipped;
                    window.flashcard.classList.toggle('flipped', flipped);
                };
            }

            renderCard();
        }

        // ========== СПРАВОЧНИК ==========
        function showReferencePage() {
            currentPageState = { name: 'reference', params: {} };
            loadAllData();

            const elements = generatePeriodicTable();
            const activitySeries = ['Li', 'K', 'Ba', 'Ca', 'Na', 'Mg', 'Al', 'Mn', 'Zn', 'Cr', 'Fe', 'Co', 'Ni', 'Sn', 'Pb', 'H', 'Cu', 'Ag', 'Hg', 'Au'];
            const cations = ['H⁺', 'Li⁺', 'Na⁺', 'K⁺', 'NH₄⁺', 'Ag⁺', 'Ba²⁺', 'Ca²⁺', 'Mg²⁺', 'Zn²⁺', 'Cu²⁺', 'Fe²⁺', 'Fe³⁺', 'Al³⁺', 'Pb²⁺'];
            const anions = ['Cl⁻', 'Br⁻', 'I⁻', 'S²⁻', 'OH⁻', 'SO₄²⁻', 'CO₃²⁻', 'PO₄³⁻'];

            function renderPeriodicTable() {
                let html = '<div class="periodic-table" style="font-size:0.7rem; display: grid; grid-template-columns: repeat(18, 1fr); gap: 2px;">';
                for (let period = 1; period <= 7; period++) {
                    for (let group = 1; group <= 18; group++) {
                        const el = elements.find(e => e.period === period && e.group === group);
                        if (el) {
                            html += `<div class="periodic-element" title="${el.name}" style="background: rgba(0,212,255,0.1); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px; text-align: center;">`;
                            html += `<div class="periodic-element-symbol" style="font-weight: bold; color: var(--accent);">${el.symbol}</div>`;
                            html += `<div class="periodic-element-number" style="font-size:0.6rem; color: var(--text-secondary);">${el.number}</div>`;
                            html += `</div>`;
                        } else {
                            html += `<div style="background: transparent; border: none;"></div>`;
                        }
                    }
                }
                html += '</div>';

                const lanthanides = elements.filter(e => e.number >= 57 && e.number <= 71);
                html += '<h4 style="margin-top:12px; font-size:0.9rem">Лантаноиды</h4><div class="lanthanide-row" style="display: grid; grid-template-columns: repeat(15, 1fr); gap: 2px;">';
                lanthanides.forEach(el => {
                    html += `<div class="periodic-element" title="${el.name}" style="background: rgba(0,212,255,0.1); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px; text-align: center;"><div class="periodic-element-symbol" style="font-weight: bold; color: var(--accent);">${el.symbol}</div><div class="periodic-element-number" style="font-size:0.6rem; color: var(--text-secondary);">${el.number}</div></div>`;
                });
                html += '</div>';

                const actinides = elements.filter(e => e.number >= 89 && e.number <= 103);
                html += '<h4 style="font-size:0.9rem">Актиноиды</h4><div class="actinide-row" style="display: grid; grid-template-columns: repeat(15, 1fr); gap: 2px;">';
                actinides.forEach(el => {
                    html += `<div class="periodic-element" title="${el.name}" style="background: rgba(0,212,255,0.1); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px; text-align: center;"><div class="periodic-element-symbol" style="font-weight: bold; color: var(--accent);">${el.symbol}</div><div class="periodic-element-number" style="font-size:0.6rem; color: var(--text-secondary);">${el.number}</div></div>`;
                });
                html += '</div>';

                return html;
            }

            function getSolubility(cation, anion) {
                const rules = {
                    'Na⁺': { 'Cl⁻':'Р', 'Br⁻':'Р', 'I⁻':'Р', 'S²⁻':'Р', 'OH⁻':'Р', 'SO₄²⁻':'Р', 'CO₃²⁻':'Р', 'PO₄³⁻':'Р' },
                    'K⁺': { 'Cl⁻':'Р', 'Br⁻':'Р', 'I⁻':'Р', 'S²⁻':'Р', 'OH⁻':'Р', 'SO₄²⁻':'Р', 'CO₃²⁻':'Р', 'PO₄³⁻':'Р' },
                    'NH₄⁺': { 'Cl⁻':'Р', 'Br⁻':'Р', 'I⁻':'Р', 'S²⁻':'Р', 'OH⁻':'Р', 'SO₄²⁻':'Р', 'CO₃²⁻':'Р', 'PO₄³⁻':'Р' },
                    'Ag⁺': { 'Cl⁻':'Н', 'Br⁻':'Н', 'I⁻':'Н', 'S²⁻':'Н', 'OH⁻':'?', 'SO₄²⁻':'М', 'CO₃²⁻':'Н', 'PO₄³⁻':'Н' },
                    'Ba²⁺': { 'Cl⁻':'Р', 'Br⁻':'Р', 'I⁻':'Р', 'S²⁻':'?', 'OH⁻':'Р', 'SO₄²⁻':'Н', 'CO₃²⁻':'Н', 'PO₄³⁻':'Н' },
                    'Ca²⁺': { 'Cl⁻':'Р', 'Br⁻':'Р', 'I⁻':'Р', 'S²⁻':'?', 'OH⁻':'М', 'SO₄²⁻':'М', 'CO₃²⁻':'Н', 'PO₄³⁻':'Н' },
                    'Pb²⁺': { 'Cl⁻':'М', 'Br⁻':'М', 'I⁻':'М', 'S²⁻':'Н', 'OH⁻':'Н', 'SO₄²⁻':'Н', 'CO₃²⁻':'Н', 'PO₄³⁻':'Н' },
                };
                if (rules[cation] && rules[cation][anion]) return rules[cation][anion];
                return '?';
            }

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">📖 Справочник</div>
                        <button onclick="showMainInterface()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <h2>🧪 Таблица Менделеева</h2>
                        ${renderPeriodicTable()}
                    </div>

                    <div class="card">
                        <h2>⚡ Ряд активности</h2>
                        <div class="activity-series" style="display: flex; flex-wrap: wrap; gap: 4px;">
                            ${activitySeries.map(m => `<span class="metal" style="background: rgba(255,170,0,0.1); border: 1px solid var(--warning); border-radius: 20px; padding: 4px 8px; font-size:0.8rem">${m}</span>`).join('')}
                        </div>
                    </div>

                    <div class="card">
                        <h2>💧 Растворимость</h2>
                        <div class="solubility-table" style="font-size:0.7rem; overflow-x: auto;">
                            <table style="border-collapse: collapse; width: 100%;">
                                <thead>
                                    <tr><th style="border: 1px solid #333; padding: 4px;">Катион \\ Анион</th>${anions.map(a => `<th style="border: 1px solid #333; padding: 4px;">${a}</th>`).join('')}</tr>
                                </thead>
                                <tbody>
                                    ${cations.map(c => {
                                        return `<tr><td style="border: 1px solid #333; padding: 4px;"><b>${c}</b></td>${anions.map(a => {
                                            let sol = getSolubility(c, a);
                                            let cls = '';
                                            if (sol === 'Р') cls = 'solubility-R';
                                            else if (sol === 'М') cls = 'solubility-M';
                                            else if (sol === 'Н') cls = 'solubility-N';
                                            else cls = 'solubility-unknown';
                                            return `<td style="border: 1px solid #333; padding: 4px;" class="${cls}">${sol}</td>`;
                                        }).join('')}</tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h2>📚 Термины</h2>
                        <div style="display: grid; gap: 6px; font-size:0.8rem">
                            ${Object.entries(termDefinitions).map(([term, def]) => `
                                <div>
                                    <span class="key-term" style="cursor: default;">${escapeHtml(term)}</span>
                                    <span style="color: var(--text-secondary); margin-left: 6px;">${escapeHtml(def)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </main>
                ${renderNavigation('Справочник')}
            `;
        }

        function generatePeriodicTable() {
            return [
                { number:1, symbol:'H', name:'Водород', period:1, group:1 },
                { number:2, symbol:'He', name:'Гелий', period:1, group:18 },
                { number:3, symbol:'Li', name:'Литий', period:2, group:1 },
                { number:4, symbol:'Be', name:'Бериллий', period:2, group:2 },
                { number:5, symbol:'B', name:'Бор', period:2, group:13 },
                { number:6, symbol:'C', name:'Углерод', period:2, group:14 },
                { number:7, symbol:'N', name:'Азот', period:2, group:15 },
                { number:8, symbol:'O', name:'Кислород', period:2, group:16 },
                { number:9, symbol:'F', name:'Фтор', period:2, group:17 },
                { number:10, symbol:'Ne', name:'Неон', period:2, group:18 },
                { number:11, symbol:'Na', name:'Натрий', period:3, group:1 },
                { number:12, symbol:'Mg', name:'Магний', period:3, group:2 },
                { number:13, symbol:'Al', name:'Алюминий', period:3, group:13 },
                { number:14, symbol:'Si', name:'Кремний', period:3, group:14 },
                { number:15, symbol:'P', name:'Фосфор', period:3, group:15 },
                { number:16, symbol:'S', name:'Сера', period:3, group:16 },
                { number:17, symbol:'Cl', name:'Хлор', period:3, group:17 },
                { number:18, symbol:'Ar', name:'Аргон', period:3, group:18 },
                { number:19, symbol:'K', name:'Калий', period:4, group:1 },
                { number:20, symbol:'Ca', name:'Кальций', period:4, group:2 },
                { number:21, symbol:'Sc', name:'Скандий', period:4, group:3 },
                { number:22, symbol:'Ti', name:'Титан', period:4, group:4 },
                { number:23, symbol:'V', name:'Ванадий', period:4, group:5 },
                { number:24, symbol:'Cr', name:'Хром', period:4, group:6 },
                { number:25, symbol:'Mn', name:'Марганец', period:4, group:7 },
                { number:26, symbol:'Fe', name:'Железо', period:4, group:8 },
                { number:27, symbol:'Co', name:'Кобальт', period:4, group:9 },
                { number:28, symbol:'Ni', name:'Никель', period:4, group:10 },
                { number:29, symbol:'Cu', name:'Медь', period:4, group:11 },
                { number:30, symbol:'Zn', name:'Цинк', period:4, group:12 },
                { number:31, symbol:'Ga', name:'Галлий', period:4, group:13 },
                { number:32, symbol:'Ge', name:'Германий', period:4, group:14 },
                { number:33, symbol:'As', name:'Мышьяк', period:4, group:15 },
                { number:34, symbol:'Se', name:'Селен', period:4, group:16 },
                { number:35, symbol:'Br', name:'Бром', period:4, group:17 },
                { number:36, symbol:'Kr', name:'Криптон', period:4, group:18 },
                { number:37, symbol:'Rb', name:'Рубидий', period:5, group:1 },
                { number:38, symbol:'Sr', name:'Стронций', period:5, group:2 },
                { number:39, symbol:'Y', name:'Иттрий', period:5, group:3 },
                { number:40, symbol:'Zr', name:'Цирконий', period:5, group:4 },
                { number:41, symbol:'Nb', name:'Ниобий', period:5, group:5 },
                { number:42, symbol:'Mo', name:'Молибден', period:5, group:6 },
                { number:43, symbol:'Tc', name:'Технеций', period:5, group:7 },
                { number:44, symbol:'Ru', name:'Рутений', period:5, group:8 },
                { number:45, symbol:'Rh', name:'Родий', period:5, group:9 },
                { number:46, symbol:'Pd', name:'Палладий', period:5, group:10 },
                { number:47, symbol:'Ag', name:'Серебро', period:5, group:11 },
                { number:48, symbol:'Cd', name:'Кадмий', period:5, group:12 },
                { number:49, symbol:'In', name:'Индий', period:5, group:13 },
                { number:50, symbol:'Sn', name:'Олово', period:5, group:14 },
                { number:51, symbol:'Sb', name:'Сурьма', period:5, group:15 },
                { number:52, symbol:'Te', name:'Теллур', period:5, group:16 },
                { number:53, symbol:'I', name:'Иод', period:5, group:17 },
                { number:54, symbol:'Xe', name:'Ксенон', period:5, group:18 },
                { number:55, symbol:'Cs', name:'Цезий', period:6, group:1 },
                { number:56, symbol:'Ba', name:'Барий', period:6, group:2 },
                { number:57, symbol:'La', name:'Лантан', period:6, group:3 },
                { number:58, symbol:'Ce', name:'Церий', period:6, group:3 },
                { number:59, symbol:'Pr', name:'Празеодим', period:6, group:3 },
                { number:60, symbol:'Nd', name:'Неодим', period:6, group:3 },
                { number:61, symbol:'Pm', name:'Прометий', period:6, group:3 },
                { number:62, symbol:'Sm', name:'Самарий', period:6, group:3 },
                { number:63, symbol:'Eu', name:'Европий', period:6, group:3 },
                { number:64, symbol:'Gd', name:'Гадолиний', period:6, group:3 },
                { number:65, symbol:'Tb', name:'Тербий', period:6, group:3 },
                { number:66, symbol:'Dy', name:'Диспрозий', period:6, group:3 },
                { number:67, symbol:'Ho', name:'Гольмий', period:6, group:3 },
                { number:68, symbol:'Er', name:'Эрбий', period:6, group:3 },
                { number:69, symbol:'Tm', name:'Тулий', period:6, group:3 },
                { number:70, symbol:'Yb', name:'Иттербий', period:6, group:3 },
                { number:71, symbol:'Lu', name:'Лютеций', period:6, group:3 },
                { number:72, symbol:'Hf', name:'Гафний', period:6, group:4 },
                { number:73, symbol:'Ta', name:'Тантал', period:6, group:5 },
                { number:74, symbol:'W', name:'Вольфрам', period:6, group:6 },
                { number:75, symbol:'Re', name:'Рений', period:6, group:7 },
                { number:76, symbol:'Os', name:'Осмий', period:6, group:8 },
                { number:77, symbol:'Ir', name:'Иридий', period:6, group:9 },
                { number:78, symbol:'Pt', name:'Платина', period:6, group:10 },
                { number:79, symbol:'Au', name:'Золото', period:6, group:11 },
                { number:80, symbol:'Hg', name:'Ртуть', period:6, group:12 },
                { number:81, symbol:'Tl', name:'Таллий', period:6, group:13 },
                { number:82, symbol:'Pb', name:'Свинец', period:6, group:14 },
                { number:83, symbol:'Bi', name:'Висмут', period:6, group:15 },
                { number:84, symbol:'Po', name:'Полоний', period:6, group:16 },
                { number:85, symbol:'At', name:'Астат', period:6, group:17 },
                { number:86, symbol:'Rn', name:'Радон', period:6, group:18 },
                { number:87, symbol:'Fr', name:'Франций', period:7, group:1 },
                { number:88, symbol:'Ra', name:'Радий', period:7, group:2 },
                { number:89, symbol:'Ac', name:'Актиний', period:7, group:3 },
                { number:90, symbol:'Th', name:'Торий', period:7, group:3 },
                { number:91, symbol:'Pa', name:'Протактиний', period:7, group:3 },
                { number:92, symbol:'U', name:'Уран', period:7, group:3 },
                { number:93, symbol:'Np', name:'Нептуний', period:7, group:3 },
                { number:94, symbol:'Pu', name:'Плутоний', period:7, group:3 },
                { number:95, symbol:'Am', name:'Америций', period:7, group:3 },
                { number:96, symbol:'Cm', name:'Кюрий', period:7, group:3 },
                { number:97, symbol:'Bk', name:'Берклий', period:7, group:3 },
                { number:98, symbol:'Cf', name:'Калифорний', period:7, group:3 },
                { number:99, symbol:'Es', name:'Эйнштейний', period:7, group:3 },
                { number:100, symbol:'Fm', name:'Фермий', period:7, group:3 },
                { number:101, symbol:'Md', name:'Менделевий', period:7, group:3 },
                { number:102, symbol:'No', name:'Нобелий', period:7, group:3 },
                { number:103, symbol:'Lr', name:'Лоуренсий', period:7, group:3 },
                { number:104, symbol:'Rf', name:'Резерфордий', period:7, group:4 },
                { number:105, symbol:'Db', name:'Дубний', period:7, group:5 },
                { number:106, symbol:'Sg', name:'Сиборгий', period:7, group:6 },
                { number:107, symbol:'Bh', name:'Борий', period:7, group:7 },
                { number:108, symbol:'Hs', name:'Хассий', period:7, group:8 },
                { number:109, symbol:'Mt', name:'Мейтнерий', period:7, group:9 },
                { number:110, symbol:'Ds', name:'Дармштадтий', period:7, group:10 },
                { number:111, symbol:'Rg', name:'Рентгений', period:7, group:11 },
                { number:112, symbol:'Cn', name:'Коперниций', period:7, group:12 },
                { number:113, symbol:'Nh', name:'Нихоний', period:7, group:13 },
                { number:114, symbol:'Fl', name:'Флеровий', period:7, group:14 },
                { number:115, symbol:'Mc', name:'Московий', period:7, group:15 },
                { number:116, symbol:'Lv', name:'Ливерморий', period:7, group:16 },
                { number:117, symbol:'Ts', name:'Теннессин', period:7, group:17 },
                { number:118, symbol:'Og', name:'Оганесон', period:7, group:18 }
            ];
        }

        // ========== ЭКЗАМЕН ==========
        function showExamSelectionPage() {
            currentPageState = { name: 'examselect', params: {} };
            loadAllData();

            const app = document.getElementById('app');
            app.innerHTML = `
                <header class="header">
                    <div class="header-content">
                        <div class="logo-text">📝 Выбор билетов</div>
                        <button onclick="showMainInterface()" class="back-btn">← Назад</button>
                    </div>
                </header>
                <main id="main-content" class="main-content scroll-container">
                    <div class="card">
                        <h3>Выберите билеты</h3>
                        <div class="quick-actions">
                            <button class="btn btn-secondary btn-icon" onclick="selectAllTickets(true)">✅ Все</button>
                            <button class="btn btn-secondary btn-icon" onclick="selectAllTickets(false)">❌ Ни одного</button>
                            <button class="btn btn-secondary btn-icon" onclick="selectUnlearnedTickets()">📚 Невыученные</button>
                            <button class="btn btn-secondary btn-icon" onclick="selectRandomTickets()">🎲 Случайные 5</button>
                        </div>
                        <div class="checkbox-group" id="exam-tickets-list">
                            ${tickets.map(t => {
                                const theoryDone = userProgress.questions?.[t.theory.id] || false;
                                const practiceDone = userProgress.questions?.[t.practice.id] || false;
                                return `
                                    <label class="checkbox-label">
                                        <input type="checkbox" value="${t.number}" checked> 
                                        Билет №${t.number} 
                                        ${theoryDone ? '✅' : '○'} ${practiceDone ? '✅' : '○'}
                                    </label>
                                `;
                            }).join('')}
                        </div>
                        <div style="display: flex; gap: 6px; margin-top: 12px;">
                            <button class="btn btn-primary" style="flex: 2;" onclick="startExamWithSelected()">▶️ Начать</button>
                            <button class="btn btn-secondary" style="flex: 1;" onclick="startExamWithSelected(true)">🔄 Случайно</button>
                        </div>
                    </div>
                </main>
                ${renderNavigation('Главная')}
            `;
        }

        function selectAllTickets(select) {
            document.querySelectorAll('#exam-tickets-list input[type=checkbox]').forEach(cb => cb.checked = select);
        }

        function selectUnlearnedTickets() {
            document.querySelectorAll('#exam-tickets-list input[type=checkbox]').forEach(cb => {
                const ticketNum = parseInt(cb.value);
                const ticket = tickets.find(t => t.number === ticketNum);
                if (ticket) {
                    const theoryDone = userProgress.questions?.[ticket.theory.id] || false;
                    const practiceDone = userProgress.questions?.[ticket.practice.id] || false;
                    cb.checked = !(theoryDone && practiceDone);
                }
            });
        }

        function selectRandomTickets() {
            selectAllTickets(false);
            const checkboxes = Array.from(document.querySelectorAll('#exam-tickets-list input[type=checkbox]'));
            const shuffled = checkboxes.sort(() => 0.5 - Math.random());
            shuffled.slice(0, 5).forEach(cb => cb.checked = true);
        }

        function startExamWithSelected(randomize = false) {
            const checkboxes = document.querySelectorAll('#exam-tickets-list input[type=checkbox]:checked');
            const selectedNumbers = Array.from(checkboxes).map(cb => parseInt(cb.value));
            if (selectedNumbers.length === 0) {
                showToast('Выберите хотя бы один билет', 'info');
                return;
            }
            const selectedTickets = tickets.filter(t => selectedNumbers.includes(t.number));
            const questions = [];
            selectedTickets.forEach(t => {
                questions.push(t.theory);
                questions.push(t.practice);
            });
            if (randomize) {
                questions.sort(() => Math.random() - 0.5);
            }
            runExam(questions, `Экзамен (${selectedNumbers.length} билетов)`);
        }

        function runExam(questions, title = 'Экзамен') {
            currentPageState = { name: 'exam', params: { questions, title } };
            // Очищаем предыдущий интервал
            if (activeExamInterval) clearInterval(activeExamInterval);

            let currentIndex = 0;
            let score = 0;
            let answerSubmitted = false;
            let timeLeft = questions.length * 60;

            const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

            function showQuestion() {
                if (currentIndex >= questions.length) {
                    clearInterval(activeExamInterval);
                    showResults();
                    return;
                }
                const q = questions[currentIndex];
                const progress = (currentIndex/questions.length)*100;

                const app = document.getElementById('app');
                app.innerHTML = `
                    <header class="header">
                        <div class="header-content">
                            <div class="logo-text">${title}</div>
                            <button onclick="showMainInterface()" class="back-btn">✕</button>
                        </div>
                    </header>
                    <main id="main-content" class="main-content scroll-container">
                        <div class="quiz-progress">
                            <span class="quiz-score">⭐ ${score}/${currentIndex}</span>
                            <span class="timer ${timeLeft < 60 ? 'warning' : ''}">⏱️ ${formatTime(timeLeft)}</span>
                        </div>
                        <div class="progress-bar" style="margin-bottom:16px"><div class="progress-fill" style="width:${progress}%"></div></div>
                        <div class="card">
                            <h3>Вопрос ${currentIndex+1}/${questions.length}</h3>
                            <p style="font-size:0.9rem;margin:16px 0">${escapeHtml(q.text)}</p>
                            <div class="answer-container">
                                <div class="answer-content hidden" id="exam-answer-${q.id}">${escapeHtml(q.answer)}</div>
                                <div style="display:flex; gap:6px; margin-top:8px">
                                    <button class="btn btn-secondary" style="flex:2" onclick="toggleExamAnswer(${q.id})">🔍 Показать ответ</button>
                                    <button class="btn btn-secondary" style="flex:1" onclick="examNext()">⏭️ Далее</button>
                                </div>
                                ${!answerSubmitted ? `
                                    <button class="btn btn-success" style="margin-top:8px" onclick="examMarkCorrect(${q.id})">✓ Отметить как верный</button>
                                ` : ''}
                            </div>
                        </div>
                    </main>
                `;
                window.toggleExamAnswer = (id) => {
                    const ans = document.getElementById(`exam-answer-${id}`);
                    if (ans) ans.classList.toggle('hidden');
                };
                window.examMarkCorrect = (id) => {
                    if (!answerSubmitted) {
                        answerSubmitted = true;
                        score++;
                        // XP начисляем только если вопрос ещё не изучен
                        if (!userProgress.questions?.[q.id]) {
                            updateProgress(q.id, q.type);
                        } else {
                            // Если уже изучен, всё равно засчитываем балл, но XP не даём
                        }
                        playSound('correct');
                        showToast('Ответ засчитан', 'success');
                        setTimeout(() => examNext(), 800);
                    }
                };
                window.examNext = () => {
                    if (!answerSubmitted) {
                        if (!stats.questionMistakes) stats.questionMistakes = {};
                        stats.questionMistakes[q.id] = (stats.questionMistakes[q.id] || 0) + 1;
                    }
                    currentIndex++;
                    answerSubmitted = false;
                    showQuestion();
                };
            }

            function showResults() {
                const percent = Math.round((score/questions.length)*100);
                if(!stats.quizResults) stats.quizResults=[];
                stats.quizResults.push({ date: new Date().toISOString(), score, total: questions.length, percentage: percent });
                if (stats.quizResults.length > 30) stats.quizResults.shift();
                
                addXP(score * 20, 'экзамен');
                
                saveAllData();
                checkAchievements();

                const app = document.getElementById('app');
                app.innerHTML = `
                    <header class="header">
                        <div class="header-content">
                            <div class="logo-text">📊 Результаты</div>
                            <button onclick="showMainInterface()" class="back-btn">✕</button>
                        </div>
                    </header>
                    <main id="main-content" class="main-content scroll-container">
                        <div class="card">
                            <div style="text-align:center">
                                <h1 style="font-size:2.5rem">${percent}%</h1>
                                <p>Правильных: ${score}/${questions.length}</p>
                                <p>+${score * 20} XP</p>
                            </div>
                            <div class="progress-bar" style="height:8px;margin:16px 0"><div class="progress-fill" style="width:${percent}%"></div></div>
                            <div class="grid-2">
                                <button class="btn btn-primary" onclick="showExamSelectionPage()">🔄 Новый экзамен</button>
                                <button class="btn btn-secondary" onclick="showMainInterface()">🏠 Главная</button>
                            </div>
                        </div>
                    </main>
                `;
            }

            activeExamInterval = setInterval(() => {
                timeLeft--;
                if(timeLeft<=0) { 
                    clearInterval(activeExamInterval); 
                    if (currentIndex < questions.length) showResults(); 
                }
                else {
                    const t = document.querySelector('.timer');
                    if(t) {
                        t.textContent = `⏱️ ${formatTime(timeLeft)}`;
                        t.classList.toggle('warning', timeLeft < 60);
                    }
                }
            },1000);

            showQuestion();
        }

        // ========== TELEGRAM ==========
        function initTelegram() {
            if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
                Telegram.WebApp.ready();
                Telegram.WebApp.expand();
                applySettings();
            }
        }

        function initApp() {
            initTelegram();
            loadAllData();
            showMainInterface();
            
            if (settings.reminders) {
                requestNotificationPermission();
            }

            document.addEventListener('visibilitychange', () => {
                if (document.hidden && settings.autoSave) {
                    saveAllData();
                }
            });

            window.addEventListener('beforeunload', () => {
                if (settings.autoSave) {
                    saveAllData();
                }
                if (activeQuizInterval) clearInterval(activeQuizInterval);
                if (activeExamInterval) clearInterval(activeExamInterval);
                if (reminderTimeout) clearTimeout(reminderTimeout);
            });
            
            createParticles();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initApp);
        } else {
            initApp();
        }

        // ========== ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ==========
        window.showMainInterface = showMainInterface;
        window.showTicketsPage = showTicketsPage;
        window.showTicket = showTicket;
        window.showTheoryPage = showTheoryPage;
        window.searchTheory = searchTheory;
        window.debounceSearchTheory = debounceSearchTheory;
        window.clearTheorySearch = clearTheorySearch;
        window.showPracticePage = showPracticePage;
        window.searchPractice = searchPractice;
        window.debounceSearchPractice = debounceSearchPractice;
        window.clearPracticeSearch = clearPracticeSearch;
        window.showQuestionDetail = showQuestionDetail;
        window.showStatsPage = showStatsPage;
        window.showSettingsPage = showSettingsPage;
        window.showQuizPage = showQuizPage;
        window.showRandomTicket = showRandomTicket;
        window.showRandomQuestion = showRandomQuestion;
        window.showWeakQuestionsPage = showWeakQuestionsPage;
        window.showFlashcardsPage = showFlashcardsPage;
        window.startFlashcards = startFlashcards;
        window.showReferencePage = showReferencePage;
        window.showExamSelectionPage = showExamSelectionPage;
        window.selectAllTickets = selectAllTickets;
        window.selectUnlearnedTickets = selectUnlearnedTickets;
        window.selectRandomTickets = selectRandomTickets;
        window.startExamWithSelected = startExamWithSelected;
        window.toggleBookmark = toggleBookmark;
        window.toggleQuestionAnswer = toggleQuestionAnswer;
        window.showNoteInput = showNoteInput;
        window.saveNote = saveNote;
        window.handleNoteInput = handleNoteInput;
        window.deleteNote = deleteNote;
        window.markQuestionLearned = markQuestionLearned;
        window.markQuestionLearnedSingle = markQuestionLearnedSingle;
        window.setTheme = setTheme;
        window.setAccentColor = setAccentColor;
        window.setFontSize = setFontSize;
        window.toggleSound = toggleSound;
        window.toggleVibration = toggleVibration;
        window.toggleReminders = toggleReminders;
        window.setReminderTime = setReminderTime;
        window.toggleAutoSave = toggleAutoSave;
        window.requestNotificationPermission = requestNotificationPermission;
        window.resetProgress = resetProgress;
        window.exportToTxt = exportToTxt;
        window.exportProgress = exportProgress;
        window.importProgress = importProgress;
        window.showAchievementsPage = showAchievementsPage;
        window.showChallengesPage = showChallengesPage;
        window.showHeatmapPage = showHeatmapPage;
        window.addTag = addTag;
        window.removeTag = removeTag;
        window.scrollToTop = scrollToTop;
        
        window.selectQuizOption = null;
        window.submitQuizAnswer = null;
        window.skipQuizQuestion = null;
        window.nextQuizQuestion = null;
        window.flashcardSwipeLeft = null;
        window.flashcardSwipeRight = null;
        window.handleTouchStart = null;
        window.handleTouchMove = null;
        window.handleTouchEnd = null;
        window.handleTouchCancel = null;
        window.toggleExamAnswer = null;
        window.examMarkCorrect = null;
        window.examNext = null;
