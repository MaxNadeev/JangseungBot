/**
 * Коллекция вспомогательных функций для работы с данными, временем и Telegram API.
 * @namespace Helpers
 */
const Helpers = {
    /**
     * Форматирует дату в удобочитаемый строковый вид.
     * @param {Date} date - Объект даты.
     * @param {string} [format='DD.MM.YYYY HH:mm'] - Формат вывода (см. `date-fns`).
     * @returns {string} Отформатированная дата.
     * @example
     * Helpers.formatDate(new Date()); // "17.05.2025 14:30"
     */
    formatDate(date, format = 'dd.MM.yyyy HH:mm') {
      return format(date, format);
    },
  
    /**
     * Разделяет массив на чанки (пакеты) для batch-обработки.
     * @param {Array} array - Исходный массив.
     * @param {number} chunkSize - Размер чанка.
     * @returns {Array<Array>} Массив чанков.
     * @example
     * Helpers.chunk([1, 2, 3, 4], 2); // [[1, 2], [3, 4]]
     */
    chunk(array, chunkSize) {
      const chunks = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
      }
      return chunks;
    },
  
    /**
     * Проверяет, является ли объект валидным пользователем Telegram.
     * @param {Object} user - Объект пользователя из GramJS.
     * @returns {boolean} True, если это пользователь (не бот/канал).
     */
    isValidUser(user) {
      return user && user.className === 'User' && !user.bot;
    },
  
    /**
     * Генерирует случайную строку из символов.
     * @param {number} length - Длина строки.
     * @returns {string} Случайная строка.
     */
    generateRandomString(length = 8) {
      return Math.random().toString(36).substring(2, 2 + length);
    },
  
    /**
     * Экранирует спецсимволы MarkdownV2 для Telegram.
     * @param {string} text - Исходный текст.
     * @returns {string} Экранированная строка.
     */
    escapeMarkdown(text) {
      const symbols = '_*[]()~`>#+-=|{}.!';
      return text.split('').map(char => 
        symbols.includes(char) ? `\\${char}` : char
      ).join('');
    }
  };
  
  export default Helpers;