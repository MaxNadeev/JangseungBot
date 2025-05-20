import { Api } from 'telegram';

/**
 * Сервис для работы с Admin Log (журналом административных действий) в супергруппе.
 * Позволяет получать последние события, такие как:
 * - Изменение информации о группе
 * - Бан/разбан участников
 * - Изменение прав администраторов
 * - Удаление сообщений
 * - Закрепление сообщений
 * 
 * @property {TelegramClient} #client - Клиент GramJS для запросов к API
 * @property {number|string} #groupId - ID группы, за которой следим
 */
class AdminLogService {
    #client = null;
    #groupId = null;

    /**
     * @param {TelegramClient} client - Экземпляр GramJS клиента
     * @param {number|string} groupId - ID или username группы
     */
    constructor(client, groupId) {
        this.#client = client;
        this.#groupId = groupId;
    }

    /**
     * Получает последние административные события из группы.
     * @param {number} [limit=100] - Максимальное количество событий для получения
     * @param {string} [eventType='all'] - Тип событий ('all', 'ban', 'edit', 'delete', 'invite', etc.)
     * @returns {Promise<Array<Object>>} Массив событий в формате для обработки
     */
    async fetchEvents(limit = 100, eventType = 'all') {
        try {
            var filter = this.#getEventFilter(eventType);
            
            var result = await this.#client.invoke(
                new Api.channels.GetAdminLog({
                    channel: this.#groupId,
                    q: '', // Поисковый запрос (пустая строка = все события)
                    maxId: 0, // Максимальный ID события (0 = самые свежие)
                    minId: 0, // Минимальный ID события (0 = без ограничения)
                    limit: Math.min(limit, 100), // Telegram ограничивает 100 событиями за запрос
                    eventsFilter: filter,
                    admins: null // Массив администраторов для фильтра (null = все)
                })
            );

            return this.#parseEvents(result);
        } catch (error) {
            console.error('Error fetching admin log events:', error);
            throw error;
        }
    }

    /**
     * Преобразует сырые события из API в удобный для работы формат.
     * @param {Api.channels.AdminLogResults} result - Результат вызова GetAdminLog
     * @returns {Array<Object>} Массив обработанных событий
     */
    #parseEvents(result) {
        var events = [];
        var usersMap = new Map();

        // Создаем карту пользователей для быстрого доступа
        result.users.forEach(user => {
            usersMap.set(user.id, user);
        });

        result.events.forEach(event => {
            try {
                var parsedEvent = {
                    id: event.id,
                    date: new Date(event.date * 1000),
                    userId: event.userId,
                    action: this.#parseAction(event.action, usersMap)
                };

                events.push(parsedEvent);
            } catch (error) {
                console.error('Error parsing admin log event:', error);
            }
        });

        return events;
    }

    /**
     * Анализирует действие и возвращает его в читаемом формате.
     * @param {Api.TypeChannelAdminLogEventAction} action - Действие из API
     * @param {Map} usersMap - Карта пользователей (id → user)
     * @returns {Object} Описание действия
     */
    #parseAction(action, usersMap) {
        var actionInfo = { type: 'unknown' };

        if (action instanceof Api.ChannelAdminLogEventActionChangeTitle) {
            actionInfo.type = 'edit_title';
            actionInfo.oldTitle = action.prevValue;
            actionInfo.newTitle = action.newValue;
        } else if (action instanceof Api.ChannelAdminLogEventActionChangeAbout) {
            actionInfo.type = 'edit_about';
            actionInfo.oldAbout = action.prevValue;
            actionInfo.newAbout = action.newValue;
        } else if (action instanceof Api.ChannelAdminLogEventActionParticipantInvite) {
            actionInfo.type = 'invite';
            actionInfo.user = this.#getUserInfo(action.participant.userId, usersMap);
        } else if (action instanceof Api.ChannelAdminLogEventActionParticipantToggleBan) {
            actionInfo.type = action.newParticipant.banned ? 'ban' : 'unban';
            actionInfo.user = this.#getUserInfo(action.prevParticipant.userId, usersMap);
        } else if (action instanceof Api.ChannelAdminLogEventActionDeleteMessage) {
            actionInfo.type = 'delete_message';
            actionInfo.messageId = action.message.id;
        } else if (action instanceof Api.ChannelAdminLogEventActionChangePhoto) {
            actionInfo.type = 'change_photo';
            actionInfo.prevPhoto = action.prevPhoto;
            actionInfo.newPhoto = action.newPhoto;
        } else if (action instanceof Api.ChannelAdminLogEventActionParticipantJoin) {
            actionInfo.type = 'join';
            actionInfo.user = this.#getUserInfo(action.userId, usersMap);
        } else if (action instanceof Api.ChannelAdminLogEventActionParticipantLeave) {
            actionInfo.type = 'leave';
            actionInfo.user = this.#getUserInfo(action.userId, usersMap);
        } else if (action instanceof Api.ChannelAdminLogEventActionEditMessage) {
            actionInfo.type = 'edit_message';
            actionInfo.messageId = action.prevMessage.id;
        }

        return actionInfo;
    }

    /**
     * Получает информацию о пользователе из карты.
     * @param {number} userId - ID пользователя
     * @param {Map} usersMap - Карта пользователей
     * @returns {Object} Основная информация о пользователе
     */
    #getUserInfo(userId, usersMap) {
        var user = usersMap.get(userId);
        if (!user) return { id: userId };

        return {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName
        };
    }

    /**
     * Возвращает фильтр событий в зависимости от типа.
     * @param {string} eventType - Тип событий ('all', 'ban', 'edit', etc.)
     * @returns {Api.TypeChannelAdminLogEventsFilter} Фильтр для API
     */
    #getEventFilter(eventType) {
        switch (eventType.toLowerCase()) {
            case 'ban':
                return new Api.ChannelAdminLogEventsFilter({
                    kick: true,
                    ban: true,
                    unban: true
                });
            case 'edit':
                return new Api.ChannelAdminLogEventsFilter({
                    edit: true,
                    info: true
                });
            case 'delete':
                return new Api.ChannelAdminLogEventsFilter({
                    delete: true
                });
            case 'invite':
                return new Api.ChannelAdminLogEventsFilter({
                    invite: true,
                    join: true
                });
            case 'admin':
                return new Api.ChannelAdminLogEventsFilter({
                    admin: true
                });
            default:
                return null; // null = все события
        }
    }
}

export default AdminLogService;