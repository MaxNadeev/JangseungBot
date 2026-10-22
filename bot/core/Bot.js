import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/api.js';
import EventHandler from './EventHandler.js';
import ServiceBot from '../services/ServiceBot.js';
import Scheduler from '../utils/Scheduler.js';
import SilentJoinerService from '../services/SilentJoinerService.js';
import ReconcileService from '../services/ReconcileService.js';

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

    constructor(db, profileManager) {
        this.db = db;
        this.profileManager = profileManager;
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
        this.reconcileService = new ReconcileService();
        this.eventHandler = new EventHandler(this.botClient, this.db, profileManager, this.reconcileService);
        this.serviceBot = new ServiceBot(this.botClient, this.db, this.groupId);
    }

    async setupEvents() {
        this.botClient.addEventHandler(async (update) => {
            if (update instanceof Api.UpdateNewChannelMessage) {
                this.eventHandler.handleNewMessage(update);
            } else if (update instanceof Api.UpdateNewMessage) {
                this.eventHandler.handlePrivateMessage(update);
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
            
            await this.eventHandler.init();
            await this.setupEvents();

            // Автобан «молчащих» новичков
            this.scheduler = new Scheduler();
            this.silentJoinerService = new SilentJoinerService(this.serviceBot, this.db, process.env.ADMIN_ID, this.eventHandler.inspector);
            await this.silentJoinerService.runOnce();
            this.scheduler.addTask('silentJoiner', () => {
                this.silentJoinerService.runOnce();
            }, 60 * 1000);

            // Пересчёт сообщений по расписанию
            var recountHours = parseInt(process.env.RECOUNT_INTERVAL_HOURS, 10) || 24;
            this.scheduler.addTask('recount', () => {
                this.reconcileService.recountWithUserSession(this.db, this.groupId, this.profileManager);
            }, recountHours * 3600 * 1000);

            var date = new Date().toLocaleString('ru-ru');
            console.log(`${date} Bot started. Monitoring group: ${process.env.GROUP_ID}`);
        } catch (error) {
            console.error('Bot startup failed:', error);
            process.exit(1);
        }
    }
}

export default Bot;