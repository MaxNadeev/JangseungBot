import { Api } from 'telegram';
import Store from '../utils/Store.js';

class EventHandler {
    #client = null;
    #groupId = null;
    #store = null;

    constructor(client) {
        this.#client = client;
        this.#groupId = process.env.GROUP_ID;
        this.#store = new Store();
    }

    async initialize() {
        await this.#store.loadTriggers();
        console.log('EventHandler initialized');
    }

    async handleNewMessage(event) {
        try {
            var message = event.message;
            
            // Проверяем, что сообщение из нужной группы
            if (String(message.chatId) !== String(this.#groupId)) {
                return;
            }

            // Обработка новых участников
            if (message.action instanceof Api.MessageActionChatAddUser) {
                await this.#handleNewMember(message);
                return;
            }

            // Пропускаем сервисные сообщения (кроме добавления пользователей)
            if (!(message instanceof Api.Message)) {
                return;
            }

            // Пропускаем сообщения без текста
            var messageText = message.text || '';
            if (!messageText) {
                return;
            }

            // Пропускаем реплаи
            if (message.isReply) {
                console.log('Skip reply');
                return;
            }

            // Проверка на триггеры
            if (!this.#store.сheckMessage(messageText)) {
                console.log('Pass');
                return;
            }

            console.log('Trigger detected in message:', messageText);
            await this.#handleTriggerMessage(message);

            var rawMessage = await this.#getRawMessage(message.id);
            console.log('\nRAW API RESPONSE:', JSON.stringify(rawMessage, null, 2), '\n');
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    async #handleNewMember(message) {
        try {
            var userId = message.action.users[0];
            var user = await this.#client.getEntity(userId);
            
            var welcomeMessage = this.#formatWelcomeMessage(
                user.firstName,
                user.lastName,
                user.username
            );
            
            await this.#client.sendMessage(message.chatId, {
                message: welcomeMessage,
                parseMode: 'html'
            });
        } catch (error) {
            console.error('Error welcoming new member:', error);
        }
    }

    #formatWelcomeMessage(firstName, lastName, username) {
        var safeFirstName = firstName || '';
        var safeLastName = lastName || '';
        var safeUsername = username ? `@${username}` : '';

        var nameParts = [];
        if (safeFirstName) nameParts.push(safeFirstName);
        if (safeLastName) nameParts.push(safeLastName);
        var displayName = nameParts.join(' ');

        if (safeUsername) {
            displayName += ` (${safeUsername})`;
        }

        if (!displayName) {
            displayName = 'Друг';
        }

        return `<b>${displayName}</b>, Привет! Hi! 안녕하세요 \n\n🗣: 🇷🇺🇬🇧🇰🇷`;
    }

    async #handleTriggerMessage(message) {
        try {
            await this.#client.sendMessage(message.chatId, {
                message: '@itdesig'
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    async #getRawMessage(messageId) {
        try {
            var result = await this.#client.invoke(
                new Api.channels.GetMessages({
                    channel: this.#groupId,
                    id: [new Api.InputMessageID({ id: messageId })]
                })
            );
            return result?.messages?.[0] || null;
        } catch (error) {
            console.error('Error getting raw message:', error);
            return null;
        }
    }
}

export default EventHandler;