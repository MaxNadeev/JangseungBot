import JsonManager from '../managers/JsonManager.js';

class Inspector {
    constructor() {
        this.triggerWords = new Set();
        this.allowedWords = new Set();
        this.linkIndicators = new Set();
        this.symbols = new Set();
        this.minLength = null;
        this.minMessages = null;
    }

    async loadTriggers() {
        try {
            var triggers = await JsonManager.read('./data/triggers.json');
            if (triggers) {
                // Загрузка триггерных слов
                triggers.triggerWords.forEach(word => 
                    this.triggerWords.add(this.normalizeWord(word)));
                
                // Загрузка разрешенных слов
                if (triggers.allowed) {
                    triggers.allowed.forEach(word => 
                        this.allowedWords.add(this.normalizeWord(word)));
                }
                
                // Загрузка индикаторов ссылок
                triggers.linkIndicators.forEach(link => 
                    this.linkIndicators.add(link.toLowerCase()));
                
                // Загрузка символов
                triggers.symbols.forEach(symbol => 
                    this.symbols.add(symbol));
                
                this.minLength = triggers.additionalRules?.minLength || null;
                this.minMessages = triggers.additionalRules?.minMessages || null;
                
                console.log(`Triggers loaded. Words: ${this.triggerWords.size}. Allowed: ${this.allowedWords.size}. Links indicators: ${this.linkIndicators.size}. Symbols: ${this.symbols.size}.`);
            }
        } catch (error) {
            console.error('Error loading triggers:', error);
        }
    }

    normalizeWord(word) {
        return word.toLowerCase().trim();
    }

    /**
     * Проверяет, содержит ли текст разрешенные слова
     * @param {string} text - Текст для проверки
     * @returns {boolean} true если содержит разрешенные слова
     */
    hasAllowedWords(text) {
        if (!text || this.allowedWords.size === 0) return false;
        
        var normalizedText = text.toLowerCase();
        var words = new Set(
            normalizedText
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                .split(/\s+/)
        );

        for (var allowedWord of this.allowedWords) {
            if (words.has(allowedWord)) {
                console.log('allowed word found:', allowedWord);
                return true;
            }
        }
        
        return false;
    }

    сheckMessage(text, userMsgCount = 0) {
        if (!text) return false;
        
        // Проверка минимального количества сообщений пользователя
        if (this.minMessages && userMsgCount >= this.minMessages) {
            console.log(`${new Date().toLocaleString('ru-ru')} User has ${userMsgCount} messages, skipping check (min: ${this.minMessages})`);
            return false;
        }
        
        // Проверка минимальной длины сообщения
        if (this.minLength && text.length < this.minLength) {
            console.log(`${new Date().toLocaleString('ru-ru')} Message too short: ${text.length} chars (min: ${this.minLength})`);
            return false;
        }

        var normalizedText = text.toLowerCase();
        
        // ПЕРВАЯ ПРОВЕРКА: разрешенные слова (имеют наивысший приоритет)
        if (this.hasAllowedWords(normalizedText)) {
            console.log(`${new Date().toLocaleString('ru-ru')} Message contains allowed words, skipping further checks`);
            return false;
        }

        // ВТОРАЯ ПРОВЕРКА: символы
        for (var symbol of this.symbols) {
            if (text.includes(symbol)) {
                console.log(`${new Date().toLocaleString('ru-ru')}trigger symbol:`, symbol);
                return true;
            }
        }

        // ТРЕТЬЯ ПРОВЕРКА: ссылки
        for (var link of this.linkIndicators) {
            if (normalizedText.includes(link)) {
                console.log(`${new Date().toLocaleString('ru-ru')} trigger link:`, link);
                return true;
            }
        }

        // ЧЕТВЕРТАЯ ПРОВЕРКА: запрещенные слова
        var words = new Set(
            normalizedText
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                .split(/\s+/)
        );

        for (var word of this.triggerWords) {
            if (words.has(word)) {
                console.log(`${new Date().toLocaleString('ru-ru')} trigger word:`, word);
                return true;
            }
        }

        return false;
    }
}

export default Inspector;