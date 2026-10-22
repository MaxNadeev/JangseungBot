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
    profileManager;
    adminId;

    /**
     * Создает экземпляр EventHandler
     * @constructor
     * @param {TelegramClient} bot - Экземпляр Telegram клиента
     * @param {DBManager} db - Менеджер базы данных
     */
    constructor(bot, db, profileManager, reconcileService) {
        this.botClient = bot;
        this.groupId = process.env.GROUP_ID;
        this.adminId = process.env.ADMIN_ID;
        this.inspector = new Inspector();
        this.db = db;
        this.profileManager = profileManager;
        this.reconcileService = reconcileService;
        this.botService = new ServiceBot(this.botClient, this.db, this.groupId);
        this.botUsername = null; // Добавим для хранения username бота
    }

    /**
     * Инициализирует обработчик событий
     * @async
     * @method
     * @returns {Promise<void>}
     */
    async init() {
        await this.inspector.loadTriggers();
        // Получаем username бота при инициализации
        await this.loadBotUsername();
    }

    /**
     * Загружает username бота
     * @async
     * @method
     * @returns {Promise<void>}
     */
    async loadBotUsername() {
        try {
            var me = await this.botClient.getMe();
            this.botUsername = me.username;
            console.log(`${new Date().toLocaleString('ru-ru')} Bot username loaded: @${this.botUsername}`);
        } catch (error) {
            console.error(`${new Date().toLocaleString('ru-ru')} Error loading bot username:`, error);
            this.botUsername = 'Jangseungbot'; // fallback
        }
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
                var actionClass = message.action?.className;

                if (actionClass === 'MessageActionChatJoinedByRequest' || 
                    actionClass === 'MessageActionChatJoinedByLink') {
                    var userId = message.fromId?.userId?.value?.toString();
                    if (!userId) return;
                    await this.handleUserJoined(userId, message.date);
                    return;
                } else if (actionClass === 'MessageActionChatAddUser') {
                    var addedUsers = message.action?.users || [];
                    for (var u of addedUsers) {
                        await this.handleUserJoined(u.toString(), message.date);
                    }
                    return;
                }
            } else if (className === 'Message') {
                console.log(`\n${new Date().toLocaleString('ru-ru')} message:`, update.message.message);
                var userId = message.fromId?.userId?.value?.toString();
                if (!userId) return;
                
                // Команда (/hi): сообщение сохраняется — считаем
                if (await this.handleCommands(message)) {
                    await this.db.incrementUserMessage(userId);
                    return;
                }
                
                // Свои сообщения бота: не проверяем на спам, но считаем
                if (message.out) {
                    await this.db.incrementUserMessage(userId);
                    return;
                }
                
                // Медиа (фото/видео) — проверяем лимит новичков
                if (this.#isPhotoVideo(message)) {
                    var mediaUser = await this.botService.getUserFromDB(userId);
                    var mediaMsgCount = mediaUser.success ? (mediaUser.user.msgCount || 0) : 0;
                    var isExempt = mediaUser.success && (mediaUser.user.adminRights || mediaUser.user.trusted);
                    if (!isExempt && mediaMsgCount < this.inspector.minMessagesForMedia) {
                        await this.handleMediaViolation(message, userId);
                        return;
                    }
                    await this.db.incrementUserMessage(userId);
                    return;
                }
                
                // Пустые сообщения и ответы на приветствие не проверяем, но считаем
                if (!message.message || message.replyTo) {
                    await this.db.incrementUserMessage(userId);
                    return;
                }

                var userData = await this.botService.getUserFromDB(userId);
                var userMsgCount = 0;
                
                if (userData.success) {
                    console.log(`${new Date().toLocaleString('ru-ru')} user in DB`);
                    userMsgCount = userData.user.msgCount || 0;
                    
                    // Админы и доверенные: пропускаем проверку, но считаем
                    if (userData.user.adminRights || userData.user.trusted) {
                        console.log(`${new Date().toLocaleString('ru-ru')} Admin/trusted message, skipping check`);
                        await this.db.incrementUserMessage(userId);
                        return;
                    }
                    
                    // Пропускаем проверку если у пользователя больше minMessages сообщений
                    // (эта проверка теперь внутри inspector.сheckMessage)
                } else {
                    console.log(`${new Date().toLocaleString('ru-ru')} userData (from DB): NONE`);
                }
                
                console.log(`${new Date().toLocaleString('ru-ru')} checkMessage...`);
                var hasProblem = this.inspector.сheckMessage(message.message, userMsgCount);
                console.log(`${new Date().toLocaleString('ru-ru')} hasProblem: `, hasProblem);
                
                if (!hasProblem) {
                    // прошло проверку — сообщение сохраняется, считаем
                    await this.db.incrementUserMessage(userId);
                    return;
                }
                
                // Триггер: сообщение удаляется — НЕ считаем
                console.log(`${new Date().toLocaleString('ru-ru')} Trigger detected in message:`, message.message);
                await this.handleTriggerMessage(message, userId);
            } else {
                console.log(`\n${new Date().toLocaleString('ru-ru')} className === ${className}\nupdate: ${JSON.stringify(update, null, 2)}\n`);
            }
        } catch (error) {
            console.error(`${new Date().toLocaleString('ru-ru')} Error handling message:`, error);
        }
    }

    /**
     * Обрабатывает личное сообщение (в чате с админом)
     * @async
     * @method
     * @param {Object} update - Объект обновления
     * @returns {Promise<void>}
     */
    async handlePrivateMessage(update) {
        try {
            var message = update.message;
            if (message.className !== 'Message') return;
            if (message.out) return; // свои сообщения бота
            
            var senderId = message.peerId?.userId?.value?.toString();
            if (senderId !== this.adminId) return; // только админ

            await this.handleCommands(message);
        } catch (error) {
            console.error(`${new Date().toLocaleString('ru-ru')} Error handling private message:`, error);
        }
    }

    /**
     * Обрабатывает команды
     * @async
     * @method
     * @param {Object} message - Объект сообщения
     * @returns {Promise<boolean>} True если команда обработана
     */
    async handleCommands(message) {
        try {
            var text = message.message;
            if (!text) return false;

            // Убираем лишние пробелы
            text = text.trim();
            
            // Проверяем, начинается ли сообщение с /
            if (!text.startsWith('/')) return false;
            
            // Извлекаем команду (убираем / в начале)
            var commandText = text.substring(1).trim();
            
            // Убираем @username если он есть
            var command = commandText.split(' ')[0];
            command = command.split('@')[0].toLowerCase();
            
            // Проверяем команду
            if (command === 'hi') {
                // Проверяем, адресована ли команда конкретно этому боту
                if (commandText.includes('@')) {
                    var mentionedUsername = commandText.split('@')[1].toLowerCase();
                    if (mentionedUsername !== this.botUsername?.toLowerCase()) {
                        return false; // Команда адресована другому боту
                    }
                }
                
                await this.handleHiCommand(message);
                return true;
            }

            if (command === 'recount') {
                var senderId = message.fromId?.userId?.value?.toString() || message.peerId?.userId?.value?.toString();
                if (senderId !== this.adminId) return false;

                const buttonRecount = new Api.KeyboardButtonCallback({
                    text: '▶️ Запустить пересчёт',
                    data: Buffer.from('recount_start'),
                });
                const row = new Api.KeyboardButtonRow({ buttons: [buttonRecount] });
                const replyMarkup = new Api.ReplyInlineMarkup({ rows: [row] });

                await this.botClient.sendMessage(this.adminId, {
                    message: 'Пересчёт сообщений участников:',
                    buttons: replyMarkup
                });
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error handling command:', error);
            return false;
        }
    }

    /**
     * Обрабатывает команду /hi
     * @async
     * @method
     * @param {Object} message - Объект сообщения
     * @returns {Promise<void>}
     */
    async handleHiCommand(message) {
        try {
            var peer = message.peerId;
            var userId = message.fromId?.userId?.value?.toString() || peer?.userId?.value?.toString();
            var chatId;
            if (peer && peer.className === 'PeerUser') {
                // личный чат — отвечаем пользователю напрямую
                chatId = peer.userId?.value?.toString() || userId;
            } else {
                chatId = peer?.channelId?.value?.toString() || this.groupId;
            }
            var messageId = message.id;
            var userInfo = null;
            
            if (userId) {
                var apiResult = await this.botService.getUserFromAPI(userId);
                if (apiResult.success) {
                    userInfo = apiResult.user;
                }
            }
            
            // Формируем ответ
            var response = this.formatHiResponse(userInfo);
            
            // Отправляем ответ
            await this.botClient.sendMessage(chatId, {
                message: response,
                replyTo: messageId
            });
            
            console.log(`Replied to /hi command from user ${userId}`);
            
        } catch (error) {
            console.error('Error handling /hi command:', error);
        }
    }

    /**
     * Форматирует ответ на команду /hi
     * @method
     * @param {Object|null} userInfo - Информация о пользователе
     * @returns {string} Форматированный ответ
     */
    formatHiResponse(userInfo) {
        var baseResponse = 'Привет!';
        
        if (!userInfo) return baseResponse;
        
        var username = userInfo.username;
        var firstName = userInfo.firstName;
        var lastName = userInfo.lastName;
        
        // Формируем обращение
        var appeal = '';
        if (firstName) {
            appeal = ` ${firstName}`;
        }
        if (username) {
            appeal += appeal ? ` (@${username})` : ` @${username}`;
        }
        
        return `${baseResponse}${appeal}!`;
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

                // Получаем информацию о пользователе для отправки администратору
                var userInfo = await this.botService.getUserFromAPI(userId);
                var username = userInfo.success ? userInfo.user.username : null;
                var firstName = userInfo.success ? userInfo.user.firstName : null;
                var lastName = userInfo.success ? userInfo.user.lastName : null;
                
                var displayName = [firstName, lastName].filter(Boolean).join(' ');
                if (username) {
                    displayName = displayName ? `${displayName} (@${username})` : `@${username}`;
                } else if (!displayName) {
                    displayName = `ID: ${userId}`;
                }

                // Отправляем сообщение с кнопкой
                await this.botClient.sendMessage(this.adminId, {
                    message: `Удалил сообщение от ${displayName}:\n${message.message}`,
                    buttons: replyMarkup
                });
            } else {
                console.error('Failed to delete message:', deleteResult.error);
            }
        } catch (error) {
            console.error('Error handling trigger message:', error);
        }
    }

    /**
     * Определяет, является ли сообщение фото/видео/GIF
     * @param {Object} message - Объект сообщения
     * @returns {boolean}
     */
    #isPhotoVideo(message) {
        var media = message.media;
        if (!media) return false;
        if (media.className === 'MessageMediaPhoto') return true;
        if (media.className === 'MessageMediaDocument') {
            var attrs = media.document?.attributes || [];
            return attrs.some(a => a.className === 'DocumentAttributeVideo' || a.className === 'DocumentAttributeAnimated');
        }
        return false;
    }

    /**
     * Удаляет фото/видео от новичка (первые N сообщений без медиа) и уведомляет админа
     * @async
     * @method
     * @param {Object} message - Объект сообщения
     * @param {string} userId - ID пользователя
     * @returns {Promise<void>}
     */
    async handleMediaViolation(message, userId) {
        try {
            var deleteResult = await this.botService.deleteMessage(this.groupId, message.id);
            if (!deleteResult.success) {
                console.error('Failed to delete media message:', deleteResult.error);
                return;
            }

            const buttonRestrict = new Api.KeyboardButtonCallback({
                text: 'Ограничить',
                data: Buffer.from(`ban_${userId}`),
            });
            const buttonAllow = new Api.KeyboardButtonCallback({
                text: 'Доверять',
                data: Buffer.from(`allow_${userId}`),
            });
            const row = new Api.KeyboardButtonRow({ buttons: [buttonRestrict, buttonAllow] });
            const replyMarkup = new Api.ReplyInlineMarkup({ rows: [row] });

            var userInfo = await this.botService.getUserFromAPI(userId);
            var username = userInfo.success ? userInfo.user.username : null;
            var firstName = userInfo.success ? userInfo.user.firstName : null;
            var lastName = userInfo.success ? userInfo.user.lastName : null;
            var displayName = [firstName, lastName].filter(Boolean).join(' ');
            if (username) {
                displayName = displayName ? `${displayName} (@${username})` : `@${username}`;
            } else if (!displayName) {
                displayName = `ID: ${userId}`;
            }

            await this.botClient.sendMessage(this.adminId, {
                message: `Удалил фото/видео от ${displayName} — новичок (первые ${this.inspector.minMessagesForMedia} сообщений без медиа)`,
                buttons: replyMarkup
            });
        } catch (error) {
            console.error('Error handling media violation:', error);
        }
    }

    /**
     * Обрабатывает вход нового пользователя: фиксирует firstJoin и приветствует
     * @async
     * @method
     * @param {string} userId - ID пользователя
     * @param {number} joinDate - unix-время входа в секундах (message.date)
     * @returns {Promise<void>}
     */
    async handleUserJoined(userId, joinDate) {
        var epochMs = joinDate ? joinDate * 1000 : Date.now();
        await this.db.setUserJoined(userId, epochMs);
        if (this.profileManager) {
            this.profileManager.upsertProfile(userId, { firstJoin: epochMs });
        }
        await this.sayHello(userId);
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
            username = dbResult.user.username || null;
            firstName = dbResult.user.firstName || null;
            lastName = dbResult.user.lastName || null;
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

            if (action === 'recount_start') {
                await this.botClient.sendMessage(this.adminId, { message: 'Пересчёт запущен…' });
                var result = await this.reconcileService.recountWithUserSession(this.db, this.groupId, this.profileManager);
                if (result.success) {
                    await this.botClient.sendMessage(this.adminId, {
                        message: `Пересчёт завершён: участников ${result.members}, банов ${result.banned}, киков ${result.kicked}, админов ${result.admins}, ${result.seconds} сек.`
                    });
                } else {
                    await this.botClient.sendMessage(this.adminId, {
                        message: `Ошибка пересчёта: ${result.error}`
                    });
                }
            } else if (action === 'unban') {
                await this.botService.unbanUser(this.groupId, userId);
                await this.db.clearRestriction(userId);
                await this.botClient.sendMessage(this.adminId, {
                    message: `Пользователь ${userId} разбанен`
                });
            } else if (action === 'ban') {
                await this.botService.banUser(this.groupId, userId);
                await this.botClient.sendMessage(this.adminId, {
                    message: `Пользователь ${userId} был ограничен`
                });
            } else if (action === 'allow') {
                // Помечаем пользователя как доверенного (в profiles и в users)
                if (this.profileManager) {
                    this.profileManager.upsertProfile(userId, { trusted: 1 });
                }
                await this.db.setTrusted(userId, 1);
                await this.botClient.sendMessage(this.adminId, {
                    message: `Пользователь ${userId} добавлен в белый список`
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