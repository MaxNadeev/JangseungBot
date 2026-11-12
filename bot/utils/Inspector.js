import JsonManager from '../managers/JsonManager.js';

class Inspector {
    constructor() {
        this.triggerWords = new Set();
        this.allowedWords = new Set();
        this.linkIndicators = new Set();
        this.symbols = new Set();
        this.minLength = null;
        this.minMessages = null;
        this.silentJoinThresholdMin = 5; // дефолт значение
        this.silentJoinBanEnabled = true; // дефолт значение
        this.silentJoinWindowMin = 60; // дефолт значение
        this.minMessagesForMedia = 5; // дефолт значение
        this.minMessagesForBotMention = 5; // дефолт значение
        this.inactiveDays = 365;
        this.inactiveMaxMessages = 1;
        this.inactiveBatchSize = 10;
        this.recountIntervalHours = 24; // дефолт значение
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
                
                // Загрузка символов (нормализуем в нижний регистр для регистронезависимой проверки)
                triggers.symbols.forEach(symbol => 
                    this.symbols.add(symbol.toLowerCase()));
                
                this.minLength = triggers.additionalRules?.minLength || null;
                this.minMessages = triggers.additionalRules?.minMessages || null;
                this.silentJoinThresholdMin = triggers.additionalRules?.silentJoinThresholdMin ?? 5; // страховка с дефолтным значением
                this.silentJoinBanEnabled = triggers.additionalRules?.silentJoinBanEnabled ?? true; // страховка с дефолтным значением
                this.silentJoinWindowMin = triggers.additionalRules?.silentJoinWindowMin ?? 60; // страховка с дефолтным значением
                this.minMessagesForMedia = triggers.additionalRules?.minMessagesForMedia ?? 5; // страховка с дефолтным значением
                this.minMessagesForBotMention = triggers.additionalRules?.minMessagesForBotMention ?? 5; // страховка с дефолтным значением
                this.inactiveDays = triggers.additionalRules?.inactiveDays ?? 365;
                this.inactiveMaxMessages = triggers.additionalRules?.inactiveMaxMessages ?? 1;
                this.inactiveBatchSize = triggers.additionalRules?.inactiveBatchSize ?? 10;
                this.recountIntervalHours = triggers.additionalRules?.recountIntervalHours ?? 24;
                
                console.log(`${new Date().toLocaleString('ru-ru')} [Inspector] Triggers loaded. Words: ${this.triggerWords.size}. Allowed: ${this.allowedWords.size}. Links indicators: ${this.linkIndicators.size}. Symbols: ${this.symbols.size}.`);
            }
        } catch (error) {
            console.error(`${new Date().toLocaleString('ru-ru')} [Inspector] Error loading triggers:`, error);
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
                console.log(`${new Date().toLocaleString('ru-ru')} [Inspector] allowed word found:`, allowedWord);
                return true;
            }
        }
        
        return false;
    }

    /**
     * Извлекает username ботов из entities сообщения
     * @param {Array|null} entities - Массив entities из message
     * @param {string} messageText - Текст сообщения
     * @returns {Array<string>} Массив username ботов (без @)
     */
    extractBotMentions(entities, messageText) {
        if (!entities || !Array.isArray(entities) || !messageText) {
            return [];
        }
        
        var botUsernames = [];
        
        // Проходим по entities типа MessageEntityMention
        for (var entity of entities) {
            if (entity.className === 'MessageEntityMention') {
                // Извлекаем username из текста по offset и length
                var username = messageText.substring(
                    entity.offset + 1, // +1 чтобы пропустить @
                    entity.offset + entity.length
                );
                
                // Проверяем, заканчивается ли на "bot" (case-insensitive)
                if (username.toLowerCase().endsWith('bot')) {
                    botUsernames.push(username);
                }
            }
        }
        
        return botUsernames;
    }

    /**
     * Проверяет, является ли сообщение bot-mention спамом от новичка
     * @param {Array|null} entities - Массив entities из message
     * @param {string} messageText - Текст сообщения
     * @param {number} userMsgCount - Количество сообщений пользователя
     * @returns {boolean} true если это bot-mention спам
     */
    isBotMentionSpam(entities, messageText, userMsgCount) {
        if (!entities || !messageText) return false;
        
        // Проверяем количество сообщений пользователя
        if (this.minMessagesForBotMention && userMsgCount >= this.minMessagesForBotMention) {
            return false;
        }
        
        // Извлекаем bot mentions
        var botMentions = this.extractBotMentions(entities, messageText);
        
        if (botMentions.length > 0) {
            console.log(`${new Date().toLocaleString('ru-ru')} [Inspector] Bot mention spam detected:`, botMentions);
            return true;
        }
        
        return false;
    }

    сheckMessage(message, userMsgCount = 0) {
        // Извлекаем нужные поля из объекта message
        var text = message?.message || message;
        var entities = message?.entities || null;
        
        // Для обратной совместимости: если передали строку, используем её
        if (typeof message === 'string') {
            text = message;
            entities = null;
        }
        
        if (!text) return false;
        
        // ПЕРВАЯ ПРОВЕРКА: корейские символы
        if (this.hasKoreanCharacters(text)) {
            console.log(`${new Date().toLocaleString('ru-ru')} Message contains Korean characters, skipping all checks`);
            return false;
        }
        
        // ВТОРАЯ ПРОВЕРКА: минимальное количество сообщений пользователя
        if (this.minMessages && userMsgCount >= this.minMessages) {
            console.log(`${new Date().toLocaleString('ru-ru')} User has ${userMsgCount} messages, skipping check (min: ${this.minMessages})`);
            return false;
        }
        
        // ТРЕТЬЯ ПРОВЕРКА: bot-mention спам от новичков
        if (this.isBotMentionSpam(entities, text, userMsgCount)) {
            console.log(`${new Date().toLocaleString('ru-ru')} Bot mention spam from newbie detected`);
            return true;
        }
        
        // ЧЕТВЕРТАЯ ПРОВЕРКА: минимальная длина сообщения
        if (this.minLength && text.length < this.minLength) {
            console.log(`${new Date().toLocaleString('ru-ru')} Message too short: ${text.length} chars (min: ${this.minLength})`);
            return false;
        }

        var normalizedText = text.toLowerCase();
        
        // ПЯТАЯ ПРОВЕРКА: разрешенные слова (имеют наивысший приоритет после корейских символов)
        if (this.hasAllowedWords(normalizedText)) {
            console.log(`${new Date().toLocaleString('ru-ru')} Message contains allowed words, skipping further checks`);
            return false;
        }

        // ШЕСТАЯ ПРОВЕРКА: символы (регистронезависимо)
        for (var symbol of this.symbols) {
            if (normalizedText.includes(symbol)) {
                console.log(`${new Date().toLocaleString('ru-ru')} trigger symbol:`, symbol);
                return true;
            }
        }

        // СЕДЬМАЯ ПРОВЕРКА: ссылки
        for (var link of this.linkIndicators) {
            if (normalizedText.includes(link)) {
                console.log(`${new Date().toLocaleString('ru-ru')} trigger link:`, link);
                return true;
            }
        }

        // ВОСЬМАЯ ПРОВЕРКА: запрещенные слова
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