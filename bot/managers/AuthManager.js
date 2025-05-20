import { StringSession } from 'telegram/sessions/index.js';
import readline from 'readline/promises';

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
                onError: (err) => console.log('Auth error:', err)
            });

            var sessionString = this.#client.session.save();
            console.log('Save this session string to avoid re-login:');
            console.log(sessionString);
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