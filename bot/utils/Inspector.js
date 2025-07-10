import JsonManager from '../managers/JsonManager.js';

class Inspector {
    constructor() {
        this.triggerWords = new Set();
        this.linkIndicators = new Set();
        this.symbols = new Set();
        this.minLength = null;
    }

    async loadTriggers() {
        try {
            var triggers = await JsonManager.read('./data/triggers.json');
            if (triggers) {
                // Загрузка триггерных слов
                triggers.triggerWords.forEach(word => 
                    this.triggerWords.add(this.normalizeWord(word)));
                
                // Загрузка индикаторов ссылок
                triggers.linkIndicators.forEach(link => 
                    this.linkIndicators.add(link.toLowerCase()));
                
                // Загрузка символов
                triggers.symbols.forEach(symbol => 
                    this.symbols.add(symbol));
                
                this.minLength = triggers.additionalRules?.minLength || null;
                console.log(`Triggers loaded. Words: ${this.triggerWords.size}. Links indicators: ${this.linkIndicators.size}. Symbols: ${this.symbols.size}.`);
            }
        } catch (error) {
            console.error('Error loading triggers:', error);
        }
    }

    normalizeWord(word) {
        return word.toLowerCase().trim();
    }

    сheckMessage(text) {
        if (!text) return false;
        if (this.minLength && text.length < this.minLength) return false;

        var normalizedText = text.toLowerCase();
        
        // Быстрая проверка на символы (первым делом)
        for (var symbol of this.symbols) {
            if (text.includes(symbol)) {
                console.log('symbol:', symbol);
                return true;
            }
        }

        // Быстрая проверка ссылок (вторым делом)
        for (var link of this.linkIndicators) {
            if (normalizedText.includes(link)) {
                console.log('link:', link);
                return true;
            }
        }

        // Проверка триггерных слов (только если не найдены символы и ссылки)
        var words = new Set(
            normalizedText
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                .split(/\s+/)
        );

        for (var word of this.triggerWords) {
            if (words.has(word)) {
                console.log('word:', word);
                return true;
            }
        }
        

        return false;
    }
}

export default Inspector;