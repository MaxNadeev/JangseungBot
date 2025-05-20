import fs from 'fs/promises';
import path from 'path';

class JsonManager {
    static async read(path, { silent = false } = {}) {
        try {
            var data = await fs.readFile(path, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            if (silent && err.code === 'ENOENT') {
                return null;
            }
            throw this._handleError('READ', path, err);
        }
    }

    static async write(filePath, data, { pretty = true } = {}) {
        try {
            // Создаем директорию, если ее нет
            var dir = path.dirname(filePath);
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
            }

            var jsonString = pretty 
                ? JSON.stringify(data, null, 2)
                : JSON.stringify(data);
            await fs.writeFile(filePath, jsonString, 'utf8');
        } catch (err) {
            throw this._handleError('WRITE', filePath, err);
        }
    }

    static async update(path, modifier) {
        try {
            var currentData = await this.read(path, { silent: true }) || {};
            var updatedData = await modifier(currentData);
            await this.write(path, updatedData);
            return updatedData;
        } catch (err) {
            throw this._handleError('UPDATE', path, err);
        }
    }

    static _handleError(operation, path, err) {
        var error = new Error(`JSON ${operation} error for ${path}: ${err.message}`);
        error.originalError = err;
        return error;
    }
}

export default JsonManager;