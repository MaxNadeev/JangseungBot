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
     * Проверяет, содержит ли текст корейские символы
     * @param {string} text - Текст для проверки
     * @returns {boolean} true если содержит корейские символы
     */
    hasKoreanCharacters(text) {
        if (!text) return false;
        
        // Диапазон корейских символов в Unicode:
        // Хангыль: 0xAC00–0xD7A3 (современные слоги)
        // Ханча (китайские иероглифы, используемые в корейском): 0x4E00–0x9FFF
        // Упрощенный диапазон для корейских символов
        var koreanRegex = /[\uAC00-\uD7A3\u3131-\u318E\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]/;
        
        return koreanRegex.test(text);
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
        
        // НОВАЯ ПЕРВАЯ ПРОВЕРКА: корейские символы
        if (this.hasKoreanCharacters(text)) {
            console.log(`${new Date().toLocaleString('ru-ru')} Message contains Korean characters, skipping all checks`);
            return false;
        }
        
        // ВТОРАЯ ПРОВЕРКА: минимальное количество сообщений пользователя
        if (this.minMessages && userMsgCount >= this.minMessages) {
            console.log(`${new Date().toLocaleString('ru-ru')} User has ${userMsgCount} messages, skipping check (min: ${this.minMessages})`);
            return false;
        }
        
        // ТРЕТЬЯ ПРОВЕРКА: минимальная длина сообщения
        if (this.minLength && text.length < this.minLength) {
            console.log(`${new Date().toLocaleString('ru-ru')} Message too short: ${text.length} chars (min: ${this.minLength})`);
            return false;
        }

        var normalizedText = text.toLowerCase();
        
        // ЧЕТВЕРТАЯ ПРОВЕРКА: разрешенные слова (имеют наивысший приоритет после корейских символов)
        if (this.hasAllowedWords(normalizedText)) {
            console.log(`${new Date().toLocaleString('ru-ru')} Message contains allowed words, skipping further checks`);
            return false;
        }

        // ПЯТАЯ ПРОВЕРКА: символы
        for (var symbol of this.symbols) {
            if (text.includes(symbol)) {
                console.log(`${new Date().toLocaleString('ru-ru')} trigger symbol:`, symbol);
                return true;
            }
        }

        // ШЕСТАЯ ПРОВЕРКА: ссылки
        for (var link of this.linkIndicators) {
            if (normalizedText.includes(link)) {
                console.log(`${new Date().toLocaleString('ru-ru')} trigger link:`, link);
                return true;
            }
        }

        // СЕДЬМАЯ ПРОВЕРКА: запрещенные слова
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