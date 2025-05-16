const fs = require('fs');

class jsonManager {
    static async read(path) {
        try {
            var data = await fs.promises.readFile(path, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error('Error of Read JSON:', err);
            throw err;
        }
    }
    
    static async write(path, data) {
        try {
            var jsonString = JSON.stringify(data, null, 2);
            await fs.promises.writeFile(path, jsonString, 'utf8');
        } catch (err) {
            console.error('Error of writing JSON: ', err);
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


module.exports = { jsonManager };