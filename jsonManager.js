const fs = require('fs');

function loadRules(path) {
    try {
        const data = fs.readFileSync(path, 'utf8');
        const jsonData = JSON.parse(data);
        return jsonData;
    } catch (err) {
        console.error('Error in jsonManager:', err);
        throw err;
    }
}

module.exports = { loadRules };