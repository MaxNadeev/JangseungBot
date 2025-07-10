import Inspector from '../utils/Inspector.js';
import ServiceBot from '../services/ServiceBot.js';
import { Api } from 'telegram';

/**
 * Обработчик событий бота
 * @class
 */
class EventHandler {
    botClient;
    groupId;
    inspector;
    botService;
    db;
    adminId;

    /**
     * Создает экземпляр EventHandler
     * @constructor
     * @param {TelegramClient} bot - Экземпляр Telegram клиента
     * @param {DBManager} db - Менеджер базы данных
     */
    constructor(bot, db) { // удалить db
        this.botClient = bot;
        this.groupId = process.env.GROUP_ID;
        this.adminId = process.env.ADMIN_ID;
        this.inspector = new Inspector();
        this.db = db; // удалить db
        this.botService = new ServiceBot(this.botClient, this.db, this.groupId);
    }

    /**
     * Инициализирует обработчик событий
     * @async
     * @method
     * @returns {Promise<void>}
     */
    async init() {
        await this.inspector.loadTriggers();
    }

    /**
     * Обрабатывает новое сообщение
     * @async
     * @method
     * @param {Object} update - Объект обновления
     * @returns {Promise<void>}
     */
    async handleNewMessage(update) {
        try {
            var message = update.message;
            var className = message.className;

            if (className === 'MessageService') {
                console.log(`\n className === ${className}\nupdate: ${JSON.stringify(update, null, 2)}\n`);
                var actionClass = message.action.className;
                
                if (actionClass === 'MessageActionChatJoinedByRequest' || 
                    actionClass === 'MessageActionChatAddUser') {
                    var userId = message.fromId?.userId?.value?.toString();
                    if (!userId) return;
                    await this.sayHello(userId);
                    return;
                }
            } else if (className === 'Message') {

                /**
                 * TEMPORARY TEST
                 */

                // const buttonRestrict = new Api.KeyboardButtonCallback({
                //     text: 'Ограничить',
                //     data: Buffer.from(`ban_${userId}`),
                // });

                // const buttonAllow = new Api.KeyboardButtonCallback({
                //     text: 'Выдать 옥새',
                //     data: Buffer.from(`allow_${userId}`),
                // });
                
                // // Создаем ряд кнопок (правильное использование переменной)
                // const buttons = [buttonRestrict, buttonAllow]; // Определяем переменную buttons
                // const row = new Api.KeyboardButtonRow({ buttons });
                
                // const replyMarkup = new Api.ReplyInlineMarkup({
                //     rows: [row],
                // });


                // // Отправляем сообщение с кнопкой
                // await this.botClient.sendMessage(this.adminId, {
                //     message: `Сообщение:\n${update.message.message}`,
                //     buttons: buttons
                // });

                /** END */

                console.log(`\n${new Date().toLocaleString('ru-ru')} message:`, update.message.message);
                var userId = message.fromId?.userId?.value?.toString();
                if (!userId) return;
                if (!message.message || '') return;
                if (message.replyTo) return;

                var userData = await this.botService.getUserFromDB(userId);
                
                if (userData.success) {
                    console.log('user in DB');
                    if (userData.user.adminRights) return;
                    if (userData.user.isInGroup && userData.user.msgCount > 100) return;
                } else {
                    console.log('userData (from DB): NONE');
                }
                
                console.log('сheckMessage...')
                var hasProblem = this.inspector.сheckMessage(message.message);
                console.log('hasProblem: ', hasProblem);
                if (!hasProblem) return;
                
                console.log('Trigger detected in message:', message.message);
                await this.handleTriggerMessage(message, userId);
            } else {
                console.log(`\n className === ${className}\nupdate: ${JSON.stringify(update, null, 2)}\n`);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    /**
     * Обрабатывает сообщение с триггером
     * @async
     * @method
     * @param {Object} message - Триггерное сообщение
     * @param {string} userId - ID пользователя
     * @returns {Promise<void>}
     */
    async handleTriggerMessage(message, userId) {
        console.log('message:', message);
        try {            
            // Удаляем сообщение
            var deleteResult = await this.botService.deleteMessage(
                this.groupId, 
                message.id
            );
            
            if (deleteResult.success) {
                const buttonRestrict = new Api.KeyboardButtonCallback({
                    text: 'Ограничить',
                    data: Buffer.from(`ban_${userId}`),
                });

                const buttonAllow = new Api.KeyboardButtonCallback({
                    text: 'Доверять',
                    data: Buffer.from(`allow_${userId}`),
                });
                
                const buttons = [buttonRestrict, buttonAllow];
                const row = new Api.KeyboardButtonRow({ buttons });
                
                const replyMarkup = new Api.ReplyInlineMarkup({
                    rows: [row],
                });


                // Отправляем сообщение с кнопкой
                await this.botClient.sendMessage(this.adminId, {
                    message: `Удалил соообщение от ${message.user?.firstName || ''} ${message.user?.lastName || ''} [${userId}]:\n${message.message}`,
                    buttons: buttons
                });
            } else {
                console.error('Failed to delete message:', deleteResult.error);
            }
        } catch (error) {
            console.error('Error handling trigger message:', error);
        }
    }

  

    /**
     * Приветствует нового пользователя
     * @async
     * @method
     * @param {string | number} userId - ID пользователя
     * @returns {Promise<void>}
     */
    async sayHello(userId) {
        var greeting = 'Привет, 안녕하세요';
        var appeal;
        var username;
        var firstName;
        var lastName;
        var dbResult = await this.botService.getUserFromDB(userId);
        var apiResult = await this.botService.getUserFromAPI(userId);

        if (dbResult.success) {
            username = apiResult.user.username || null;
            firstName = apiResult.user.firstName || null;
            lastName = apiResult.user.lastName || null;
            appeal = this.formatAppeal(username, firstName, lastName);
            greeting = `Привет! С возвращением${appeal}`;
        } else {
            username = apiResult.user.username || null;
            firstName = apiResult.user.firstName || null;
            lastName = apiResult.user.lastName || null;
            appeal = this.formatAppeal(username, firstName, lastName);
            greeting = `Привет, 안녕하세요! ${appeal}`;
        }

        await this.botClient.sendMessage(this.groupId, {
            message: `${greeting}`
        });
    }

    /**
     * Форматирует обращение к пользователю
     * @method
     * @param {string} username - Имя пользователя
     * @param {string} firstName - Имя
     * @param {string} lastName - Фамилия
     * @returns {string} - Форматированное обращение
     */
    formatAppeal(username, firstName, lastName) {
        var formattedUsername = username ? `@${username.replace(/^@/, '')}` : null;
        var fullName = [firstName, lastName].filter(Boolean).join(' ') || null;
        var mainPart = '';

        if (fullName && formattedUsername) {
            mainPart = `${fullName} (${formattedUsername})`;
        } else if (fullName) {
            mainPart = fullName;
        } else if (formattedUsername) {
            mainPart = formattedUsername;
        }
        
        return `${mainPart ? ' ' + mainPart : ''}!`;
    }

    /**
     * Обрабатывает callback-запросы от кнопок
     * @async
     * @method
     * @param {Object} update - Объект обновления
     * @returns {Promise<void>}
     */
    async handleCallbackQuery(update) {
        console.log('handleCallbackQuery update', update);
        try {
            const data = update.data.toString();
            const userId = data.split('_')[1];
            const action = data.split('_')[0];

            if (action === 'ban') {
                await this.botService.banUser(this.groupId, userId);
                await this.botClient.sendMessage(this.adminId, {
                    message: `Пользователь ${userId} был ограничен`
                });
            } else if (action === 'allow') {
                await this.botClient.sendMessage(this.adminId, {
                    message: 'allowed'
                });
            }

            // Ответим на callback, чтобы убрать "часики" у кнопки
            await this.botClient.invoke(new Api.messages.SetBotCallbackAnswer({
                queryId: update.queryId,
                message: 'Действие выполнено',
                alert: false
            }));

        } catch (error) {
            console.error('Error handling callback query:', error);
        }
    }
}

export default EventHandler;