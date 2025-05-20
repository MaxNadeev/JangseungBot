import JsonManager from '../managers/JsonManager.js';

class Store {
    constructor() {
        this.triggerWords = new Set();
        this.linkIndicators = new Set();
        this.minLength = null;
    }

    async loadTriggers() {
        try {
            var triggers = await JsonManager.read('./data/triggers.json');
            if (triggers) {
                triggers.triggerWords.forEach(word => 
                    this.triggerWords.add(this.normalizeWord(word)));
                triggers.linkIndicators.forEach(link => 
                    this.linkIndicators.add(link.toLowerCase()));
                this.minLength = triggers.additionalRules?.minLength || null;
                console.log('Triggers loaded. Min length:', this.minLength);
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
        
        // Создаем Set слов из сообщения, очищая от пунктуации
        var words = new Set(
            normalizedText
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                .split(/\s+/)
        );

        // Проверяем триггерные слова
        for (var word of this.triggerWords) {
            if (words.has(word)) {
                console.log('word:', word);
                return true;
            }
        }

        // Проверка ссылок (отдельная логика, так как ищем подстроки)
        for (var link of this.linkIndicators) {
            if (normalizedText.includes(link)) {
                console.log('link:', link);
                return true;
            }
        }

        return false;
}
}

export default Store;