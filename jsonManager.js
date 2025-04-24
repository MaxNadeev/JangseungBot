const fs = require('fs'); // Импортируем стандартный fs, а не fs.promises

function loadJson(path) {
    try {
        const data = fs.readFileSync(path, 'utf8'); // Синхронное чтение
        const jsonData = JSON.parse(data);
        return jsonData;
    } catch (err) {
        console.error('Error in jsonManager:', err);
        throw err; // Пробрасываем ошибку дальше
    }
}

module.exports = loadJson;