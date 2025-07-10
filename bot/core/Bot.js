import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/api.js';
import EventHandler from './EventHandler.js';
import ServiceBot from '../services/ServiceBot.js';

class Bot {
    db;
    botToken;
    sessionString;
    apiId;
    apiHash;
    groupId;
    botClient;
    eventHandler;
    serviceBot;

    constructor(db) {
        this.db = db;
        this.botToken = process.env.BOT_TOKEN;
        this.sessionString = process.env.BOT_SESSION || '';
        this.apiId = parseInt(process.env.API_ID);
        this.apiHash = process.env.API_HASH;
        this.groupId = process.env.GROUP_ID;
        this.botClient = new TelegramClient(
            new StringSession(this.sessionString),
            this.apiId,
            this.apiHash,
            {
                connectionRetries: 5,
                useWSS: false,
                //baseLogger: console
            }
        );
        this.eventHandler = new EventHandler(this.botClient, this.db);
        this.serviceBot = new ServiceBot(this.botClient, this.db, this.groupId);
    }

    async setupEvents() {
        this.botClient.addEventHandler(async (update) => {
            if (update instanceof Api.UpdateNewChannelMessage) {
                this.eventHandler.handleNewMessage(update);
            } else if (update instanceof Api.UpdateBotCallbackQuery) {
                this.eventHandler.handleCallbackQuery(update);
            }
        });
    }

    async start() {
        try {
            await this.botClient.start({
                botAuthToken: process.env.BOT_TOKEN
            });
            
            this.eventHandler.init();
            await this.setupEvents();
            var date = new Date().toLocaleString('ru-ru');
            console.log(`${date} Bot started. Monitoring group: ${process.env.GROUP_ID}`);
        } catch (error) {
            console.error('Bot startup failed:', error);
            process.exit(1);
        }
    }
}

export default Bot;