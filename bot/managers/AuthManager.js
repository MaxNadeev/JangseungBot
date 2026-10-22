import { StringSession } from 'telegram/sessions/index.js';
import readline from 'readline/promises';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class AuthManager {
    #client = null;

    constructor(client) {
        this.#client = client;
    }

    async authenticate() {
        if (!await this.#client.checkAuthorization()) {

            await this.#client.start({
                phoneNumber: async () => await this.#prompt('Please enter your number: '),
                password: async () => await this.#prompt('Please enter your password: '),
                phoneCode: async () => await this.#prompt('Please enter the code you received: '),
                onError: (err) => console.log(`${new Date().toLocaleString('ru-ru')} [AuthManager] Auth error:`, err)
            });

            var sessionString = this.#client.session.save();
            
            // Сохраняем новую сессию в .env
            await this.#updateEnvSession(sessionString);
            console.log(`${new Date().toLocaleString('ru-ru')} [AuthManager] Session updated in .env and loaded into process.env`);
        }
    }

    async #updateEnvSession(sessionString) {
        var envPath = path.join(__dirname, '..', '..', '.env');
        
        try {
            var envContent = fs.readFileSync(envPath, 'utf-8');
            
            // Заменяем строку CLIENT_SESSION или добавляем её
            if (envContent.includes('CLIENT_SESSION=')) {
                envContent = envContent.replace(
                    /CLIENT_SESSION=.*/,
                    `CLIENT_SESSION=${sessionString}`
                );
            } else {
                envContent += `\nCLIENT_SESSION=${sessionString}`;
            }
            
            fs.writeFileSync(envPath, envContent, 'utf-8');
            
            // Обновляем process.env чтобы не перезапускать
            process.env.CLIENT_SESSION = sessionString;
        } catch (error) {
            console.error(`${new Date().toLocaleString('ru-ru')} [AuthManager] Ошибка при сохранении сессии в .env:`, error.message);
        }
    }

    async #prompt(text) {
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        var answer = await rl.question(text);
        rl.close();
        return answer;
    }
}

export default AuthManager;