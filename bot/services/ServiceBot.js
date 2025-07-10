import DBManager from "../managers/DBManager.js";
import { Api } from 'telegram';

/**
 * Сервис для работы с данными пользователей через бота
 * @class
 */
class ServiceBot {
    bot = null;
    groupId = null;
    dbManager = null;

    /**
     * Создает экземпляр ServiceBot
     * @constructor
     * @param {TelegramClient} bot - Экземпляр Telegram клиента
     * @param {DBManager} dbManager - Менеджер базы данных
     * @param {string} groupId - ID группы
     */
    constructor(bot, dbManager, groupId) {
        this.bot = bot;
        this.dbManager = dbManager;
        this.groupId = groupId;
    }
    
    /**
     * Получает данные пользователя из базы данных
     * @async
     * @method
     * @param {string} userId - ID пользователя
     * @returns {Promise<Object>} - Объект с результатом операции
     * @property {boolean} success - Успешность операции
     * @property {Object|null} user - Данные пользователя
     * @property {string|null} error - Сообщение об ошибке
     */
    async getUserFromDB(userId) {
        try {
            var result = await this.dbManager.getUser(userId);

            if (!result.success || !result.data) {
                return { success: false, error: 'User not found in database' };
            }

            var rawData = result.data;
            
            var user = {
                id: rawData.userId,
                username: rawData.username || null,
                firstName: rawData.firstName || null,
                lastName: rawData.lastName || null,
                realName: rawData.realName || null,
                phone: rawData.phone || null,
                isBot: Boolean(rawData.isBot),
                isPremium: Boolean(rawData.isPremium),
                age: rawData.age || null,
                place: rawData.placeName || null,
                nationality: rawData.nationality || null,
                msgCount: rawData.msgCount || 0,
                firstJoin: rawData.firstJoin || null,
                updatedOn: rawData.updatedOn || new Date().toLocaleString('ru-ru'),
                isInGroup: Boolean(rawData.isInGroup)
            };

            if (rawData.deleteMessages !== null) {
                user.isCreator = Boolean(rawData.isCreator);
                user.adminRights = {
                    adminChangeInfo: Boolean(rawData.adminChangeInfo),
                    postMessages: Boolean(rawData.postMessages),
                    editMessages: Boolean(rawData.editMessages),
                    deleteMessages: Boolean(rawData.deleteMessages),
                    banUsers: Boolean(rawData.banUsers),
                    adminPinMessages: Boolean(rawData.adminPinMessages),
                    addAdmins: Boolean(rawData.addAdmins),
                    canAnonymous: Boolean(rawData.canAnonymous),
                    manageCall: Boolean(rawData.manageCall),
                    other: Boolean(rawData.other),
                    adminManageTopics: Boolean(rawData.adminManageTopics)
                }
            }

            if (rawData.isBanned !== null || rawData.isKicked !== null) {
                user.restrictions = {
                    isBanned: Boolean(rawData.isBanned),
                    isKicked: Boolean(rawData.isKicked),
                    restrictedBy: rawData.restrictedBy || null,
                    restrictionDate: rawData.restrictionDate || null,
                    untilDate: rawData.untilDate || null,
                    rights: {
                        viewMessages: Boolean(rawData.viewMessages),
                        sendMessages: Boolean(rawData.sendMessages),
                        sendMedia: Boolean(rawData.sendMedia),
                        sendStickers: Boolean(rawData.sendStickers),
                        sendGifs: Boolean(rawData.sendGifs),
                        sendGames: Boolean(rawData.sendGames),
                        sendInline: Boolean(rawData.sendInline),
                        embedLinks: Boolean(rawData.embedLinks),
                        sendPolls: Boolean(rawData.sendPolls),
                        changeInfo: Boolean(rawData.changeInfo),
                        inviteUsers: Boolean(rawData.inviteUsers),
                        pinMessages: Boolean(rawData.pinMessages),
                        manageTopics: Boolean(rawData.manageTopics),
                        sendPhotos: Boolean(rawData.sendPhotos),
                        sendVideos: Boolean(rawData.sendVideos),
                        sendRoundvideos: Boolean(rawData.sendRoundvideos),
                        sendAudios: Boolean(rawData.sendAudios),
                        sendVoices: Boolean(rawData.sendVoices),
                        sendDocs: Boolean(rawData.sendDocs),
                        sendPlain: Boolean(rawData.sendPlain)
                    }
                };
            }

            return { success: true, user };
        } catch (error) {
            console.error('Error in getUserFromDB:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Получает данные пользователя из Telegram API
     * 
     * apiResult:  {
     *   success: true,
     *   user: {
     *       id: '123',
     *       username: 'Alena123',
     *       firstName: 'Аля',
     *       lastName: null,
     *       phone: null,
     *       isBot: false,
     *       isPremium: false,
     *       langCode: null,
     *       status: 'UserStatusRecently',
     *       about: null
     *   }
     *   }
     * 
     * @async
     * @method
     * @param {string} userId - ID пользователя
     * @returns {Promise<Object>} - Объект с результатом операции
     * @property {boolean} success - Успешность операции
     * @property {Object|null} user - Данные пользователя из API
     * @property {string|null} error - Сообщение об ошибке
     */
    async getUserFromAPI(userId) {
        try {
            // Получаем полную информацию о пользователе
            var userFull = await this.bot.invoke(
                new Api.users.GetFullUser({
                    id: userId
                })
            );

            var user = userFull.users[0];
            var fullInfo = userFull.fullUser;

            // Преобразуем данные в единый формат
            var userData = {
                id: user.id.toString(),
                username: user.username || null,
                firstName: user.firstName || null,
                lastName: user.lastName || null,
                phone: user.phone || null,
                isBot: user.bot || false,
                isPremium: user.premium || false,
                // Дополнительные поля, которые могут быть полезны
                langCode: user.langCode || null,
                // Информация о статусе
                status: user.status ? user.status.className : null,
                // Информация из fullUser
                about: fullInfo.about || null
            };

            // Если это группа/канал, добавляем информацию об административных правах
            if (userFull.chats && userFull.chats.length > 0) {
                var chat = userFull.chats[0];
                if (chat instanceof Api.Channel) {
                    userData.groupInfo = {
                        title: chat.title,
                        participantsCount: chat.participantsCount || 0,
                        adminRights: chat.adminRights ? {
                            adminChangeInfo: chat.adminRights.changeInfo,
                            postMessages: chat.adminRights.postMessages,
                            editMessages: chat.adminRights.editMessages,
                            deleteMessages: chat.adminRights.deleteMessages,
                            banUsers: chat.adminRights.banUsers,
                            adminPinMessages: chat.adminRights.pinMessages,
                            addAdmins: chat.adminRights.addAdmins,
                            canAnonymous: chat.adminRights.anonymous,
                            manageCall: chat.adminRights.manageCall,
                            other: chat.adminRights.other,
                            adminManageTopics: chat.adminRights.manageTopics
                        } : null,
                        bannedRights: chat.bannedRights ? {
                            viewMessages: chat.bannedRights.viewMessages,
                            sendMessages: chat.bannedRights.sendMessages,
                            sendMedia: chat.bannedRights.sendMedia,
                            sendStickers: chat.bannedRights.sendStickers,
                            sendGifs: chat.bannedRights.sendGifs,
                            sendGames: chat.bannedRights.sendGames,
                            sendInline: chat.bannedRights.sendInline,
                            embedLinks: chat.bannedRights.embedLinks,
                            sendPolls: chat.bannedRights.sendPolls,
                            changeInfo: chat.bannedRights.changeInfo,
                            inviteUsers: chat.bannedRights.inviteUsers,
                            pinMessages: chat.bannedRights.pinMessages,
                            manageTopics: chat.bannedRights.manageTopics
                        } : null
                    };
                }
            }

            return { success: true, user: userData };
        } catch (error) {
            console.error('Error in getUserFromAPI:', error);
            return { 
                success: false, 
                error: error.message,
                // Добавляем информацию об ошибке для отладки
                errorDetails: {
                    code: error.code,
                    className: error.className
                }
            };
        }
    }

    /**
     * Удаляет сообщение в чате по его ID
     * @async
     * @method
     * @param {string|number} chatId - ID чата, где находится сообщение
     * @param {string|number} messageId - ID сообщения для удаления
     * @returns {Promise<Object>} - Результат операции
     * @property {boolean} success - Успешность операции
     * @property {string|null} error - Сообщение об ошибке
     */
    async deleteMessage(chatId, messageId) {
        try {
            await this.bot.invoke(
                new Api.channels.DeleteMessages({
                    channel: chatId,
                    id: [parseInt(messageId)]
                })
            );
            return { success: true };
        } catch (error) {
            console.error('Error deleting message:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Банит пользователя в чате
     * @async
     * @method
     * @param {string|number} chatId - ID чата
     * @param {string|number} userId - ID пользователя
     * @param {number} [untilDate=0] - Дата разбана (timestamp)
     * @returns {Promise<Object>} - Результат операции
     */
    async banUser(chatId, userId, untilDate = 0) {
        try {
            await this.bot.invoke(
                new Api.channels.EditBanned({
                    channel: chatId,
                    participant: new Api.InputPeerUser({
                        userId: parseInt(userId),
                        accessHash: await this.getAccessHash(userId)
                    }),
                    bannedRights: new Api.ChatBannedRights({
                        untilDate: untilDate,
                        sendMessages: true
                    })
                })
            );
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getAccessHash(userId) {
        try {
            var entity = await this.bot.getInputEntity(userId);
            return entity.accessHash;
        } catch {
            return 0;
        }
    }
}

export default ServiceBot;