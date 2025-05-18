// State Management
const state = {
    decks: [],
    currentDeck: null,
    currentCard: null,
    studySession: {
        cards: [],
        currentIndex: 0,
        score: 0,
        timer: null,
        timePerCard: 30, // Default 30 seconds
        isPaused: false,
        cardState: 'question', // 'question', 'hint', 'answer'
        deckCategories: new Set()
    },
    settings: {
        darkTheme: false,
        soundEnabled: true,
        soundType: 'card',
        mainBackground: 'default',
        mainBackgroundImage: null
    },
    selectedCategories: new Set(),
    deckCategories: new Set(), // Separate set for deck categories
    deckBackgroundImage: null
};

// DOM Elements
const elements = {
    views: {
        deckList: document.getElementById('deckList'),
        deckEdit: document.getElementById('deckEdit'),
        studyView: document.getElementById('studyView'),
    },
    buttons: {
        newDeck: document.getElementById('newDeckButton'),
        addCard: document.getElementById('addCardButton'),
        backToDecks: document.getElementById('backToDecks'),
        exitStudy: document.getElementById('exitStudy'),
        themeToggle: document.getElementById('themeToggle'),
        settingsButton: document.getElementById('settingsButton'),
        startSession: document.getElementById('startSessionButton'),
        resetDeck: document.getElementById('resetDeckButton'),
        deleteDeck: document.getElementById('deleteDeckButton'),
    },
    modals: {
        settings: document.getElementById('settingsModal'),
        addCard: document.getElementById('addCardModal'),
        sessionSettings: document.getElementById('sessionSettingsModal'),
        newDeck: document.getElementById('newDeckModal'),
    },
    containers: {
        deckGrid: document.getElementById('deckGrid'),
        cardList: document.getElementById('cardList'),
    },
    search: document.getElementById('deckSearch'),
    forms: {
        addCard: document.getElementById('addCardForm'),
        sessionSettings: document.getElementById('sessionSettingsForm'),
    },
};

// Sound Effects Management
const SoundManager = {
    sounds: {
        card: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
        paper: new Audio('https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3'),
        timer: new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'),
        success: new Audio('https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3'),
        error: new Audio('https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3')
    },

    init() {
        // Preload all sounds
        Object.values(this.sounds).forEach(sound => {
            sound.load();
            // Prevent multiple sounds from playing simultaneously
            sound.addEventListener('play', () => {
                Object.values(this.sounds).forEach(s => {
                    if (s !== sound && !s.paused) {
                        s.pause();
                        s.currentTime = 0;
                    }
                });
            });
        });
    },

    play(soundName) {
        if (!state.settings.soundEnabled) return;
        
        const sound = this.sounds[soundName];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(error => {
                console.warn('Sound playback failed:', error);
            });
        }
    }
};

// Timer Management
const TimerManager = {
    timer: null,
    timeLeft: 0,
    isPaused: false,
    warningThreshold: 5,
    warningSoundPlayed: false,

    start(duration) {
        this.stop();
        this.timeLeft = duration;
        this.isPaused = false;
        this.warningSoundPlayed = false;
        this.update();
        
        this.timer = setInterval(() => {
            if (!this.isPaused) {
                this.timeLeft--;
                this.update();
                
                if (this.timeLeft <= 0) {
                    this.stop();
                    this.handleTimeUp();
                } else if (this.timeLeft <= this.warningThreshold && !this.warningSoundPlayed) {
                    this.handleWarning();
                }
            }
        }, 1000);
    },

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    },

    pause() {
        this.isPaused = true;
    },

    resume() {
        this.isPaused = false;
    },

    update() {
        const timerElement = document.getElementById('timer');
        const progressBar = document.querySelector('.progress');
        
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const progress = (this.timeLeft / state.studySession.timePerCard) * 100;
        progressBar.style.width = `${progress}%`;

        if (this.timeLeft <= this.warningThreshold) {
            timerElement.classList.add('warning');
        } else {
            timerElement.classList.remove('warning');
        }
    },

    handleWarning() {
        this.warningSoundPlayed = true;
        SoundManager.play('timer');
        showToast('Time is running out!', 'warning');
    },

    handleTimeUp() {
        SoundManager.play('timer');
        showToast('Time\'s up!', 'warning');
        state.studySession.cardState = 'hint';
        updateCardButtons();
    }
};

// Keyboard Shortcuts
const shortcuts = {
    'h': () => document.querySelector('.hint-button').click(),
    'a': () => document.querySelector('.answer-button').click(),
    'b': () => document.querySelector('.back-to-question').click(),
    '1': () => document.querySelector('[data-score="1"]').click(),
    '2': () => document.querySelector('[data-score="0.5"]').click(),
    '3': () => document.querySelector('[data-score="0"]').click(),
    'Escape': () => {
        if (document.querySelector('.modal.active')) {
            document.querySelector('.modal.active').classList.remove('active');
        } else if (document.getElementById('studyView').classList.contains('active')) {
            document.getElementById('exitStudy').click();
        }
    }
};

// Toast Notification System
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize Application
function init() {
    loadState();
    setupEventListeners();
    renderDeckList();
    applyTheme();
}

// State Management Functions
function loadState() {
    const savedState = localStorage.getItem('flashcardApp');
    if (savedState) {
        const parsed = JSON.parse(savedState);
        state.decks = parsed.decks || [];
        state.settings = parsed.settings || state.settings;
        
        // Apply saved background
        if (state.settings.mainBackground === 'custom' && state.settings.mainBackgroundImage) {
            applyBackground('custom', state.settings.mainBackgroundImage);
        } else {
            applyBackground(state.settings.mainBackground);
        }
    }
}

function saveState() {
    localStorage.setItem('flashcardApp', JSON.stringify({
        decks: state.decks,
        settings: state.settings,
    }));
}

// Deck Management
function createDeck(name, color = '#ff1b1b', categories = [], background = 'default', backgroundImage = null) {
    const deck = {
        id: Date.now().toString(),
        name,
        color,
        categories: categories,
        background,
        backgroundImage,
        cards: [],
        stats: {
            highestScore: 0,
            lastStudied: null,
        }
    };
    state.decks.push(deck);
    saveState();
    renderDeckList();
}

function deleteDeck(deckId) {
    state.decks = state.decks.filter(deck => deck.id !== deckId);
    saveState();
    renderDeckList();
}

function updateDeck(deckId, updates) {
    const deck = state.decks.find(d => d.id === deckId);
    if (deck) {
        Object.assign(deck, updates);
        saveState();
        renderDeckList();
    }
}

// Card Management with Images
async function createCard(deckId, question, hint, answer, categories = [], images = {}) {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck) {
        throw new Error('Deck not found');
    }

    // Process images
    const processedImages = {};
    for (const [key, file] of Object.entries(images)) {
        if (file) {
            processedImages[key] = await convertImageToBase64(file);
        }
    }

    const card = {
        id: Date.now().toString(),
        question,
        hint,
        answer,
        categories: categories,
        images: processedImages,
        stats: {
            lastResponse: null,
            responseCount: 0,
            correctCount: 0,
        }
    };

    deck.cards.push(card);
    
    // Update deck categories
    categories.forEach(category => {
        if (!deck.categories.includes(category)) {
            deck.categories.push(category);
        }
    });

    saveState();
    renderCardList(deckId);
    return card;
}

function updateCard(deckId, cardId, updates) {
    const deck = state.decks.find(d => d.id === deckId);
    if (deck) {
        const card = deck.cards.find(c => c.id === cardId);
        if (card) {
            Object.assign(card, updates);
            saveState();
            renderCardList(deckId);
        }
    }
}

function deleteCard(deckId, cardId) {
    const deck = state.decks.find(d => d.id === deckId);
    if (deck) {
        deck.cards = deck.cards.filter(card => card.id !== cardId);
        saveState();
        renderCardList(deckId);
    }
}

function editCard(deckId, cardId) {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck) return;

    const card = deck.cards.find(c => c.id === cardId);
    if (!card) return;

    // Reset selected categories
    state.selectedCategories = new Set(card.categories);

    // Populate form with card data
    document.getElementById('cardQuestion').value = card.question;
    document.getElementById('cardHint').value = card.hint;
    document.getElementById('cardAnswer').value = card.answer;
    
    // Update category tags
    updateCategoryTags();

    // Show modal
    elements.modals.addCard.classList.add('active');

    // Update form submission handler
    const form = elements.forms.addCard;
    const originalSubmitHandler = form.onsubmit;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const updates = {
            question: document.getElementById('cardQuestion').value,
            hint: document.getElementById('cardHint').value,
            answer: document.getElementById('cardAnswer').value,
            categories: Array.from(state.selectedCategories),
            images: {
                question: document.getElementById('cardQuestionImage').files[0],
                hint: document.getElementById('cardHintImage').files[0],
                answer: document.getElementById('cardAnswerImage').files[0]
            }
        };
        await updateCard(deckId, cardId, updates);
        elements.modals.addCard.classList.remove('active');
        form.reset();
        state.selectedCategories.clear();
        updateCategoryTags();
        form.onsubmit = originalSubmitHandler;
    };
}

// Study Session Management
function startStudySession(deckId, timePerCard) {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck) return;

    // Filter cards by selected categories if any
    let cards = [...deck.cards];
    if (state.studySession.deckCategories.size > 0) {
        cards = cards.filter(card => 
            card.categories.some(cat => state.studySession.deckCategories.has(cat))
        );
    }

    if (cards.length === 0) {
        showToast('No cards available for selected categories', 'error');
        return;
    }

    // Sort cards based on performance
    cards.sort((a, b) => {
        if (a.stats.lastResponse === 'dont_know') return -1;
        if (b.stats.lastResponse === 'dont_know') return 1;
        if (a.stats.lastResponse === 'not_sure') return -1;
        if (b.stats.lastResponse === 'not_sure') return 1;
        return Math.random() - 0.5;
    });

    state.studySession = {
        cards,
        currentIndex: 0,
        score: 0,
        timePerCard: timePerCard || 30,
        cardState: 'question',
        deckCategories: new Set(deck.categories)
    };

    state.currentDeck = deck;
    showView('studyView');
    updateScoreDisplay();
    showNextCard();
    showToast(`Starting session with ${cards.length} cards`, 'info');
}

function showNextCard() {
    if (state.studySession.currentIndex >= state.studySession.cards.length) {
        endStudySession();
        return;
    }

    const card = state.studySession.cards[state.studySession.currentIndex];
    state.currentCard = card;
    state.studySession.cardState = 'question';

    // Reset card state
    const flashcard = document.querySelector('.flashcard');
    flashcard.classList.remove('show-hint', 'show-answer');
    
    // Update card content
    updateCardContent(card);
    
    // Start timer
    TimerManager.start(state.studySession.timePerCard);
}

function updateCardContent(card) {
    const questionContent = document.querySelector('.question');
    const hintContent = document.querySelector('.hint');
    const answerContent = document.querySelector('.answer');

    // Clear previous content
    questionContent.innerHTML = '';
    hintContent.innerHTML = '';
    answerContent.innerHTML = '';

    // Add question content
    questionContent.innerHTML = card.question;
    if (card.images.question) {
        const img = document.createElement('img');
        img.src = card.images.question;
        img.alt = 'Question image';
        questionContent.appendChild(img);
    }

    // Add hint content
    hintContent.innerHTML = card.hint;
    if (card.images.hint) {
        const img = document.createElement('img');
        img.src = card.images.hint;
        img.alt = 'Hint image';
        hintContent.appendChild(img);
    }

    // Add answer content
    answerContent.innerHTML = card.answer;
    if (card.images.answer) {
        const img = document.createElement('img');
        img.src = card.images.answer;
        img.alt = 'Answer image';
        answerContent.appendChild(img);
    }

    // Update button states
    updateCardButtons();
}

function updateCardButtons() {
    const hintButton = document.querySelector('.hint-button');
    const answerButton = document.querySelector('.answer-button');
    const backButtons = document.querySelectorAll('.back-to-question');
    const flashcard = document.querySelector('.flashcard');

    switch (state.studySession.cardState) {
        case 'question':
            hintButton.style.display = 'flex';
            answerButton.style.display = 'flex';
            backButtons.forEach(btn => btn.style.display = 'none');
            flashcard.classList.remove('show-hint', 'show-answer');
            break;
        case 'hint':
            hintButton.style.display = 'none';
            answerButton.style.display = 'none';
            backButtons.forEach(btn => btn.style.display = 'flex');
            flashcard.classList.add('show-hint');
            flashcard.classList.remove('show-answer');
            break;
        case 'answer':
            hintButton.style.display = 'none';
            answerButton.style.display = 'none';
            backButtons.forEach(btn => btn.style.display = 'flex');
            flashcard.classList.add('show-answer');
            flashcard.classList.remove('show-hint');
            break;
    }
}

function updateScoreDisplay() {
    document.getElementById('currentScore').textContent = state.studySession.score.toFixed(1);
    document.getElementById('highScore').textContent = state.currentDeck.stats.highestScore.toFixed(1);
}

function handleCardResponse(response) {
    const card = state.currentCard;
    if (!card) return;

    // Play appropriate sound
    if (response === 'sure') {
        SoundManager.play('success');
    } else if (response === 'dont_know') {
        SoundManager.play('error');
    } else {
        SoundManager.play(state.settings.soundType);
    }

    // Show feedback
    const feedback = response === 'sure' ? 'Great job!' :
                    response === 'not_sure' ? 'Keep practicing!' :
                    'Don\'t worry, you\'ll get it next time!';
    showToast(feedback, response === 'sure' ? 'success' : 'info');

    // Update card stats
    card.stats.lastResponse = response;
    card.stats.responseCount++;
    if (response === 'sure') {
        card.stats.correctCount++;
        state.studySession.score += 1;
    } else if (response === 'not_sure') {
        state.studySession.score += 0.5;
    }

    updateScoreDisplay();

    // Move to next card with animation
    const flashcard = document.querySelector('.flashcard');
    flashcard.classList.add('fade-out');
    setTimeout(() => {
        state.studySession.currentIndex++;
        showNextCard();
        flashcard.classList.remove('fade-out');
    }, 300);
}

function endStudySession() {
    // Update deck stats
    if (state.currentDeck) {
        state.currentDeck.stats.lastStudied = new Date().toISOString();
        if (state.studySession.score > state.currentDeck.stats.highestScore) {
            state.currentDeck.stats.highestScore = state.studySession.score;
        }
    }

    // Show session end modal
    const modal = document.getElementById('sessionEndModal');
    document.getElementById('finalScore').textContent = state.studySession.score.toFixed(1);
    document.getElementById('sessionHighScore').textContent = state.currentDeck.stats.highestScore.toFixed(1);
    document.getElementById('cardsStudied').textContent = state.studySession.cards.length;
    modal.classList.add('active');

    saveState();
}

// UI Management
function showView(viewName) {
    Object.values(elements.views).forEach(view => view.classList.remove('active'));
    elements.views[viewName].classList.add('active');
}

function renderDeckList() {
    const deckGrid = elements.containers.deckGrid;
    deckGrid.innerHTML = '';

    state.decks.forEach(deck => {
        const deckElement = document.createElement('div');
        deckElement.className = 'deck-card';
        deckElement.style.borderLeft = `4px solid ${deck.color}`;
        
        // Apply deck background if it exists
        if (deck.background === 'custom' && deck.backgroundImage) {
            deckElement.style.backgroundImage = `url(${deck.backgroundImage})`;
            deckElement.classList.add('background-custom');
        } else if (deck.background !== 'default') {
            deckElement.classList.add(`background-${deck.background}`);
        }

        deckElement.innerHTML = `
            <h3>${deck.name}</h3>
            <p>${deck.cards.length} cards</p>
            <p>Highest Score: ${deck.stats.highestScore}</p>
        `;
        deckElement.addEventListener('click', () => {
            state.currentDeck = deck;
            showView('deckEdit');
            renderCardList(deck.id);
        });
        deckGrid.appendChild(deckElement);
    });
}

function renderCardList(deckId) {
    const cardList = elements.containers.cardList;
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck) return;

    cardList.innerHTML = '';
    deck.cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card-item';
        cardElement.dataset.cardId = card.id;
        
        const categoriesHtml = card.categories.map(cat => 
            `<span class="category-tag">${cat}</span>`
        ).join('');

        cardElement.innerHTML = `
            <div class="card-content">
                <h4>${card.question}</h4>
                ${card.images.question ? `<img src="${card.images.question}" alt="Question image" class="card-image-preview">` : ''}
                <div class="card-categories">${categoriesHtml}</div>
            </div>
            <div class="card-actions">
                <button class="edit-card">Edit</button>
                <button class="delete-card">Delete</button>
            </div>
        `;
        cardList.appendChild(cardElement);
    });
}

// Theme Management
function toggleTheme() {
    state.settings.darkTheme = !state.settings.darkTheme;
    applyTheme();
    saveState();
}

function applyTheme() {
    document.body.classList.toggle('dark-theme', state.settings.darkTheme);
    elements.buttons.themeToggle.innerHTML = state.settings.darkTheme ? 
        '<i class="fas fa-sun"></i>' : 
        '<i class="fas fa-moon"></i>';
}

// Session Management
function resetDeckProgress(deckId) {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck) return;

    deck.cards.forEach(card => {
        card.stats = {
            lastResponse: null,
            responseCount: 0,
            correctCount: 0,
        };
    });
    deck.stats.highestScore = 0;
    saveState();
    renderCardList(deckId);
}

// Image handling
function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Background Management
function applyBackground(type, image = null) {
    const body = document.body;
    // Remove all background classes
    body.classList.remove(
        'background-gradient1',
        'background-gradient2',
        'background-pattern1',
        'background-pattern2',
        'background-custom'
    );

    if (type === 'custom' && image) {
        body.classList.add('background-custom');
        body.style.backgroundImage = `url(${image})`;
    } else if (type !== 'default') {
        body.classList.add(`background-${type}`);
    } else {
        body.style.backgroundImage = '';
    }
}

function handleBackgroundChange(type, fileInput = null) {
    if (type === 'custom' && fileInput && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.settings.mainBackgroundImage = e.target.result;
            applyBackground('custom', e.target.result);
            saveState();
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        state.settings.mainBackgroundImage = null;
        applyBackground(type);
        saveState();
    }
}

// Event Listeners
function setupEventListeners() {
    // Theme toggle
    elements.buttons.themeToggle.addEventListener('click', toggleTheme);

    // Settings modal
    elements.buttons.settingsButton.addEventListener('click', () => {
        elements.modals.settings.classList.add('active');
    });

    // Close modal
    document.querySelector('.close-modal').addEventListener('click', () => {
        elements.modals.settings.classList.remove('active');
    });

    // New deck
    elements.buttons.newDeck.addEventListener('click', () => {
        elements.modals.newDeck.classList.add('active');
    });

    // Back to decks
    elements.buttons.backToDecks.addEventListener('click', () => {
        showView('deckList');
    });

    // Exit study
    elements.buttons.exitStudy.addEventListener('click', () => {
        if (confirm('Are you sure you want to end this study session?')) {
            endStudySession();
        }
    });

    // Delete Deck button
    elements.buttons.deleteDeck.addEventListener('click', () => {
        if (!state.currentDeck) return;
        if (confirm('Are you sure you want to delete this deck? This action cannot be undone.')) {
            deleteDeck(state.currentDeck.id);
            showView('deckList');
        }
    });

    // Card flip
    document.querySelector('.flashcard').addEventListener('click', () => {
        const flashcard = document.querySelector('.flashcard');
        if (!flashcard.classList.contains('flipped')) {
            if (state.settings.soundEnabled) {
                SoundManager.play(state.settings.soundType);
            }
            flashcard.classList.add('flipped');
        }
    });

    // Hint button
    document.querySelector('.hint-button').addEventListener('click', () => {
        if (state.settings.soundEnabled) {
            SoundManager.play(state.settings.soundType);
        }
        state.studySession.cardState = 'hint';
        updateCardButtons();
    });

    // Answer button
    document.querySelector('.answer-button').addEventListener('click', () => {
        if (state.settings.soundEnabled) {
            SoundManager.play(state.settings.soundType);
        }
        state.studySession.cardState = 'answer';
        updateCardButtons();
    });

    // Back to question buttons
    document.querySelectorAll('.back-to-question').forEach(button => {
        button.addEventListener('click', () => {
            if (state.settings.soundEnabled) {
                SoundManager.play(state.settings.soundType);
            }
            state.studySession.cardState = 'question';
            updateCardButtons();
        });
    });

    // Response buttons
    document.querySelectorAll('.response-button').forEach(button => {
        button.addEventListener('click', () => {
            const response = button.dataset.score === '1' ? 'sure' :
                           button.dataset.score === '0.5' ? 'not_sure' : 'dont_know';
            handleCardResponse(response);
        });
    });

    // Search
    elements.search.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const deckElements = document.querySelectorAll('.deck-card');
        deckElements.forEach(element => {
            const deckName = element.querySelector('h3').textContent.toLowerCase();
            element.style.display = deckName.includes(searchTerm) ? 'block' : 'none';
        });
    });

    // Add Card button
    elements.buttons.addCard.addEventListener('click', () => {
        if (!state.currentDeck) return;
        // Reset form and categories
        elements.forms.addCard.reset();
        state.selectedCategories.clear();
        updateCategoryTags();
        // Show modal
        elements.modals.addCard.classList.add('active');
    });

    // Category input for cards
    const categoryInput = document.getElementById('categoryInput');
    if (categoryInput) {
        categoryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const category = categoryInput.value.trim();
                if (category && !state.selectedCategories.has(category)) {
                    state.selectedCategories.add(category);
                    updateCategoryTags();
                }
                categoryInput.value = '';
            }
        });
    }

    // New deck form
    const newDeckForm = document.getElementById('newDeckForm');
    if (newDeckForm) {
        newDeckForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('deckName').value;
            const color = document.getElementById('deckColor').value;
            const background = document.getElementById('deckBackground').value;
            const categories = Array.from(state.deckCategories);
            createDeck(name, color, categories, background, state.deckBackgroundImage);
            elements.modals.newDeck.classList.remove('active');
            newDeckForm.reset();
            state.deckCategories.clear();
            state.deckBackgroundImage = null;
            updateDeckCategoryTags();
        });
    }

    // Add Card form submission
    elements.forms.addCard.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentDeck) return;
        
        const question = document.getElementById('cardQuestion').value;
        const hint = document.getElementById('cardHint').value;
        const answer = document.getElementById('cardAnswer').value;
        
        if (!question || !hint || !answer) {
            alert('Please fill in all required fields');
            return;
        }
        
        // Get image files
        const images = {
            question: document.getElementById('cardQuestionImage').files[0],
            hint: document.getElementById('cardHintImage').files[0],
            answer: document.getElementById('cardAnswerImage').files[0]
        };

        try {
            await createCard(
                state.currentDeck.id, 
                question, 
                hint, 
                answer, 
                Array.from(state.selectedCategories), 
                images
            );
            elements.modals.addCard.classList.remove('active');
            e.target.reset();
            state.selectedCategories.clear();
            updateCategoryTags();
        } catch (error) {
            console.error('Error adding card:', error);
            alert('Error adding card. Please try again.');
        }
    });

    // Close modals
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
            // Reset forms and categories when closing modals
            if (elements.modals.addCard.classList.contains('active')) {
                elements.forms.addCard.reset();
                state.selectedCategories.clear();
                updateCategoryTags();
            }
            if (elements.modals.newDeck.classList.contains('active')) {
                document.getElementById('newDeckForm').reset();
                state.deckCategories.clear();
                updateDeckCategoryTags();
            }
        });
    });

    // Card actions
    elements.containers.cardList.addEventListener('click', (e) => {
        const cardItem = e.target.closest('.card-item');
        if (!cardItem) return;

        const cardId = cardItem.dataset.cardId;
        if (e.target.classList.contains('delete-card')) {
            if (confirm('Are you sure you want to delete this card?')) {
                deleteCard(state.currentDeck.id, cardId);
            }
        } else if (e.target.classList.contains('edit-card')) {
            editCard(state.currentDeck.id, cardId);
        }
    });

    // Start Session button
    elements.buttons.startSession.addEventListener('click', () => {
        if (!state.currentDeck) return;
        elements.modals.sessionSettings.classList.add('active');
    });

    // Session Settings form
    elements.forms.sessionSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        const timePerCard = parseInt(document.getElementById('timePerCard').value);
        elements.modals.sessionSettings.classList.remove('active');
        startStudySession(state.currentDeck.id, timePerCard);
    });

    // Time per card range input
    document.getElementById('timePerCard').addEventListener('input', (e) => {
        document.getElementById('timePerCardValue').textContent = `${e.target.value} seconds`;
    });

    // Reset Deck button
    elements.buttons.resetDeck.addEventListener('click', () => {
        if (!state.currentDeck) return;
        if (confirm('Are you sure you want to reset all progress for this deck?')) {
            resetDeckProgress(state.currentDeck.id);
        }
    });

    // Image upload previews
    ['Question', 'Hint', 'Answer'].forEach(section => {
        const input = document.getElementById(`card${section}Image`);
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.createElement('img');
                    preview.src = e.target.result;
                    preview.className = 'card-image-preview active';
                    input.parentNode.appendChild(preview);
                };
                reader.readAsDataURL(file);
            }
        });
    });

    // Category input for decks
    const deckCategoryInput = document.getElementById('deckCategoryInput');
    if (deckCategoryInput) {
        deckCategoryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const category = deckCategoryInput.value.trim();
                if (category && !state.deckCategories.has(category)) {
                    state.deckCategories.add(category);
                    updateDeckCategoryTags();
                }
                deckCategoryInput.value = '';
            }
        });
    }

    // Session end modal buttons
    document.getElementById('newSessionButton').addEventListener('click', () => {
        document.getElementById('sessionEndModal').classList.remove('active');
        startStudySession(state.currentDeck.id, state.studySession.timePerCard);
    });

    document.getElementById('returnToDeckButton').addEventListener('click', () => {
        document.getElementById('sessionEndModal').classList.remove('active');
        showView('deckList');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const shortcut = shortcuts[e.key.toLowerCase()];
        if (shortcut) {
            e.preventDefault();
            shortcut();
        }
    });

    // Sound settings
    document.getElementById('soundSwitch').addEventListener('change', (e) => {
        state.settings.soundEnabled = e.target.checked;
        saveState();
        if (state.settings.soundEnabled) {
            SoundManager.play(state.settings.soundType);
        }
    });

    document.getElementById('soundSelect').addEventListener('change', (e) => {
        state.settings.soundType = e.target.value;
        saveState();
        if (state.settings.soundEnabled) {
            SoundManager.play(state.settings.soundType);
        }
    });

    // Card interaction
    document.querySelector('.flashcard').addEventListener('click', (e) => {
        if (e.target.closest('.card-buttons')) return;
        
        if (state.studySession.cardState === 'question') {
            SoundManager.play(state.settings.soundType);
            state.studySession.cardState = 'answer';
            updateCardButtons();
        }
    });

    // Main background settings
    const mainBackgroundSelect = document.getElementById('mainBackground');
    const customBackgroundInput = document.getElementById('customBackground');

    if (mainBackgroundSelect) {
        mainBackgroundSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            if (type === 'custom') {
                customBackgroundInput.click();
            } else {
                handleBackgroundChange(type);
            }
        });
    }

    if (customBackgroundInput) {
        customBackgroundInput.addEventListener('change', (e) => {
            handleBackgroundChange('custom', e.target);
        });
    }

    // Deck background settings
    const deckBackgroundSelect = document.getElementById('deckBackground');
    const deckCustomBackgroundInput = document.getElementById('deckCustomBackground');

    if (deckBackgroundSelect) {
        deckBackgroundSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            if (type === 'custom') {
                deckCustomBackgroundInput.click();
            }
        });
    }

    if (deckCustomBackgroundInput) {
        deckCustomBackgroundInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    state.deckBackgroundImage = event.target.result;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
}

function updateCategoryTags() {
    const selectedCategories = document.getElementById('selectedCategories');
    if (!selectedCategories) return;
    
    selectedCategories.innerHTML = '';
    
    state.selectedCategories.forEach(category => {
        const tag = document.createElement('div');
        tag.className = 'category-tag';
        tag.innerHTML = `
            ${category}
            <span class="remove-category" data-category="${category}">
                <i class="fas fa-times"></i>
            </span>
        `;
        selectedCategories.appendChild(tag);
    });

    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-category').forEach(button => {
        button.addEventListener('click', () => {
            const category = button.dataset.category;
            state.selectedCategories.delete(category);
            updateCategoryTags();
        });
    });
}

function updateDeckCategoryTags() {
    const deckSelectedCategories = document.getElementById('deckSelectedCategories');
    if (!deckSelectedCategories) return;
    
    deckSelectedCategories.innerHTML = '';
    
    state.deckCategories.forEach(category => {
        const tag = document.createElement('div');
        tag.className = 'deck-category-tag';
        tag.innerHTML = `
            ${category}
            <span class="remove-category" data-category="${category}">
                <i class="fas fa-times"></i>
            </span>
        `;
        deckSelectedCategories.appendChild(tag);
    });

    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-category').forEach(button => {
        button.addEventListener('click', () => {
            const category = button.dataset.category;
            state.deckCategories.delete(category);
            updateDeckCategoryTags();
        });
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    SoundManager.init();
    init();
}); 