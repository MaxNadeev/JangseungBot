import fs from 'fs/promises';
import JsonManager from './JsonManager.js';
import { config } from 'dotenv';
import dotenv from 'dotenv'; 
dotenv.config();

class Logger {
    constructor(bot) {
        this.adminId = process.env.ADMIN_ID;
        this.bot = bot;
        this.membersLogging = false;
        this.messagesLogging = false;
        this.configPath = './config.json';
        this.reportPath = './reportError.txt';
    }

    // ======================
    // Основные методы отправки
    // ======================

    async sendToAdmin(message) {
        try {
            await this.bot.telegram.sendMessage(
                this.adminId, 
                message, 
                { parse_mode: 'HTML' }
            );
        } catch (error) {
            console.error(`Error sending to admin:`, error);
        }
    }

    async sendMessage(chatId, text, options = {}) {
        return this.bot.telegram.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            ...options
        });
    }

    async reply(ctx, text, options = {}) {
        return ctx.reply(text, {
            parse_mode: 'HTML',
            ...options
        });
    }

    // ======================
    // Работа с конфигурацией
    // ======================

    async loadConfig() {
        try {
            const config = await JsonManager.read(this.configPath);
            if (!config?.logging) {
                throw new Error('Invalid config structure');
            }
            
            this.messagesLogging = config.logging.messages;
            this.membersLogging = config.logging.members;
            
            await this.sendToAdmin('Конфигурация успешно загружена');
        } catch (error) {
            await this.sendToAdmin(`Ошибка загрузки конфига: <code>${error.message}</code>`);
        }
    }

    async saveConfig() {
        const config = {
            logging: {
                members: this.membersLogging,
                messages: this.messagesLogging
            }
        };
        
        try {
            await JsonManager.write(this.configPath, config);
            await this.sendToAdmin('Настройки успешно сохранены');
        } catch (error) {
            await this.sendToAdmin(`Ошибка сохранения: <code>${error.message}</code>`);
        }
    }

    // ======================
    // Логирование участников
    // ======================

    async handleMemberUpdate(ctx, actionType) {
        if (!this.membersLogging) return;

        const { old_chat_member, new_chat_member } = ctx.update.chat_member;
        const member = new_chat_member.user;
        
        const actions = {
            'left_to_member': {
                title: 'Новый участник',
                hashtag: '#НовыйУчастник'
            },
            'left_to_restricted': {
                title: 'Добавлен с ограничениями',
                hashtag: '#ОграниченныйДобавлен'
            },
            // ... остальные типы действий
        };

        const action = actions[actionType];
        if (!action) return;

        const message = `
<b>${action.title}</b>
👤 ${this.getUserInfo(member)}
Чат: ${ctx.chat.title || 'Без названия'}
${action.hashtag} ${this.getUserTag(member)}
        `;

        await this.sendToAdmin(message.trim());
    }

    // ======================
    // Логирование сообщений
    // ======================

    async logMessage(ctx) {
        if (!this.messagesLogging || ctx.chat.id.toString() === this.adminId) return;

        const message = `
<b>Новое сообщение</b>
📝 ${ctx.message.text?.substring(0, 100) || 'Медиа-сообщение'}
👤 ${this.getUserInfo(ctx.from)}
Чат: ${ctx.chat.title || 'Без названия'}
${this.getUserTag(ctx.from)}
        `;

        await this.sendToAdmin(message.trim());
    }

    // ======================
    // Вспомогательные методы
    // ======================

    getUserInfo(user) {
        const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Без имени';
        const username = user.username ? `@${user.username}` : '';
        return `${name} ${username} (ID: ${user.id})`;
    }

    getUserTag(user) {
        return user.username 
            ? `#${user.username} #id${user.id}`
            : `#id${user.id} #БезUsername`;
    }

    // ======================
    // Обработка ошибок
    // ======================

    async logError(error, context = '') {
        const timestamp = new Date().toLocaleString('ru');
        const errorMessage = `
<b>ОШИБКА</b> [${timestamp}]
${context}
<code>${error.message || JSON.stringify(error)}</code>
        `;

        await this.sendToAdmin(errorMessage.trim());
        await this.writeErrorReport(error);
    }

    async writeErrorReport(error) {
        try {
            const timestamp = new Date().toLocaleString('ru');
            await fs.appendFile(this.reportPath, `[${timestamp}] ${error.stack}\n\n`);
        } catch (err) {
            console.error('Failed to write error report:', err);
        }
    }

    // ======================
    // Управление ботом
    // ======================

    async sendStartupReport() {
        try {
            let report = 'Бот успешно запущен';
            try {
                const errorContent = await fs.readFile(this.reportPath, 'utf-8');
                if (errorContent) {
                    report += `\n\nПредыдущая ошибка:\n<code>${errorContent.substring(0, 1000)}</code>`;
                    await fs.unlink(this.reportPath);
                }
            } catch {} // Игнорируем ошибки чтения файла
            
            await this.sendToAdmin(report);
        } catch (error) {
            console.error('Startup report failed:', error);
        }
    }
}

export { Logger };