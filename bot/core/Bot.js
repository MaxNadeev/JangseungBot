import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import EventHandler from './EventHandler.js';

class Bot {
    #bot = null;
    #eventHandler = null;

    constructor() {
        var apiId = parseInt(process.env.API_ID);
        var apiHash = process.env.API_HASH;
        var botToken = process.env.BOT_TOKEN;
        var sessionString = process.env.BOT_SESSION || '';

        this.#bot = new TelegramClient(
            new StringSession(sessionString),
            apiId,
            apiHash,
            { connectionRetries: 5 }
        );

        this.#eventHandler = new EventHandler(this.#bot);
    }

    async #setupEvents() {
        await this.#eventHandler.initialize();
        
        // Обработка всех новых сообщений (включая сервисные)
        this.#bot.addEventHandler(
            this.#eventHandler.handleNewMessage.bind(this.#eventHandler),
            new NewMessage({})
        );
    }

    async start() {
        await this.#bot.start({
            botAuthToken: process.env.BOT_TOKEN
        });
        await this.#setupEvents();
        console.log('Bot started. Monitoring group:', process.env.GROUP_ID);
    }
}

export default Bot;