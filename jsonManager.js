const fs = require('fs/promises');

class JsonManager {
    static async read(path) {
        try {
            const data = await fs.readFile(path, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error('Error reading JSON:', err);
            throw err;
        }
    }
    
    static async write(path, data) {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            await fs.writeFile(path, jsonString, 'utf8');
        } catch (err) {
            console.error('Error writing JSON:', err);
            throw err;
        }
    }



    // static async update(path, modifier) {
    //     var data = await this.read(path);
    //     var updatedData = modifier(data);
    //     await this.write(path, updatedData);
    //     return updatedData;
    // }
}

module.exports = { JsonManager };