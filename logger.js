const fs = require('fs/promises');
const { JsonManager } = require('./jsonManager'); // Изменен импорт
require('dotenv').config();

class Logger {
    constructor(bot) {
        this.adminId = process.env.ADMIN_ID;
        this.bot = bot;
        this.membersLogging = false;
        this.messagesLogging = false;
        this.configPath = './config.json';
        this.reportPath = './reportError.txt';
    };

    async sendToAdmin(message) {
        try {
            await this.bot.sendMessage(this.adminId, message, { parse_mode: 'HTML' });
        } catch (error) {
            var date = (new Date).toLocaleString('ru');
            console.error(`Error to send to Admin ${date}:\n`, error);
        };
    };

    // CONFIG

    async loadConfig() {
        var message;
        try {
            var config = await JsonManager.read(this.configPath);
            if (!config?.logging) {
                throw new Error('Invalid config: missing "logging" section');
            }
            this.messagesLogging = config.logging.messages;
            this.membersLogging = config.logging.members;
            message = 'Logger config loaded';
        } catch (error) {
            message = `Error: Logger config NOT loaded\n<code>${error}</code>`;
        }

        message ||= 'Warning: loadConfig message is empty';
        await this.sendToAdmin(message);
    };

    async writeConfig(parameter) {
        var message;
        try {
            await JsonManager.write(this.configPath, parameter);
        } catch (error) {
            message = `Error: Could not write config\n'<code>${error}</code>`;
        }

        message ||= 'Warning: writeConfig message is empty';
        await this.sendToAdmin(message);
    };

    async changeParam(param) {
        var message;
        if (this.hasOwnProperty(param) && typeof this[param] === 'boolean') {
            this[param] = !this[param];
            
            message = `${param}: ${this[param]}\n#Настройки`;
            var data = {
                "logging":
                {
                    "members": this.membersLogging,
                    "messages": this.messagesLogging
                }
            }
            JsonManager.write(this.configPath, data);
        }

        message ||= 'Warning: changeParam message is empty';
        await this.sendToAdmin(message);
    };


    // USERS

    async #logMemberAction(member, msg, actionInfo) {
        if (!this.membersLogging) return;

        var { action, selfAction, actionPast, hashtag } = actionInfo;
        var logMsg = JSON.stringify(msg, null, 2);
        var id = member.id;
        var fromId = msg.from?.id;
        var tagUser = this.#getUserTag(member);
        var userInfo = this.#getUserInfo(member);

        var message;
        if (id === fromId || !msg.from) {
            message = `<b>${action} в чате ${msg.chat.title || 'без названия'}:</b>\n` +
                      `${selfAction ? 'Участник' : 'Бывший админ'}: ${userInfo}\n\n` +
                      `<code>${logMsg}</code>\n\n` +
                      `${hashtag} ${tagUser}`;
        } else {
            var fromInfo = this.#getUserInfo(msg.from);
            var tagFromUser = this.#getUserTag(msg.from);

            message = `<b>${action} в чате ${msg.chat.title || 'без названия'}:</b>\n` +
                      `${actionPast}: ${fromInfo}\n` +
                      `${selfAction ? 'Участник' : 'Бывший админ'}: ${userInfo}\n\n` +
                      `<code>${logMsg}</code>\n\n` +
                      `${hashtag} ${tagUser} ${tagFromUser}`;
        }

        await this.sendToAdmin(message || `Warning: log ${action} message is empty`);
    }

    #getUserTag(user) {
        return user.username ? `#${user.username} #id${user.id}` : `#id${user.id} #БЕЗusername`;
    }

    #getUserInfo(user) {
        var name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Участник без имени';
        var username = user.username ? `@${user.username}` : '';
        return `${name} ${username} (id${user.id})`;
    }

    
    async logLeft2Member(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Пополнение в чате',
            selfAction: true,
            actionPast: 'Добавил',
            hashtag: '#Пополнение'
        });
    }

    async logLeft2Restricted(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Добавлен с ограничениями',
            selfAction: true,
            actionPast: 'Добавил',
            hashtag: '#ПополнениеСОграничением'
        });
    }

    async logMember2Left(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Участник вышел',
            selfAction: true,
            actionPast: 'Инициировал',
            hashtag: '#Уход'
        });
    }

    async logMember2Restricted(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Ограничен в чате',
            selfAction: true,
            actionPast: 'Ограничил',
            hashtag: '#Ограничение'
        });
    }

    async logMember2Kicked(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Забанен в чате',
            selfAction: true,
            actionPast: 'Забанил',
            hashtag: '#Бан'
        });
    }

    async logMember2Administrator(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Повышен до админа',
            selfAction: false,
            actionPast: 'Повысил',
            hashtag: '#Повышение'
        });
    }

    async logRestricted2Member(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Сняты ограничения',
            selfAction: true,
            actionPast: 'Снял ограничения',
            hashtag: '#СнятиеОграничений'
        });
    }

    async logRestricted2Left(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Ограниченный участник вышел',
            selfAction: true,
            actionPast: 'Инициировал',
            hashtag: '#УходОграниченного'
        });
    }

    async logAdministrator2Member(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Понижен в чате',
            selfAction: false,
            actionPast: 'Понизил',
            hashtag: '#Понижение'
        });
    }

    async logAdministrator2Left(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Админ вышел',
            selfAction: false,
            actionPast: 'Инициировал',
            hashtag: '#УходАдмина'
        });
    }

    async logAdministrator2Kicked(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Админ забанен',
            selfAction: false,
            actionPast: 'Забанил',
            hashtag: '#БанАдмина'
        });
    }

    async logKicked2Left(member, msg) {
        await this.#logMemberAction(member, msg, {
            action: 'Разбанен в чате',
            selfAction: true,
            actionPast: 'Разбанил',
            hashtag: '#Разбан'
        });
    }


    // MESSAGES

    async logNewMessage (msg) {
        if (!this.messagesLogging || msg.chat.id.toString() === this.adminId) return;
        
        const logMsg = JSON.stringify(msg, null, 2);
        var fromUserTag = '';

        if (msg.from) {
            var fromUsername = msg.from.username ? `@${msg.from.username}` : null;
            fromUserTag = `#${fromUsername || ('id' + msg.from.id + ' #БЕЗusername')}`;
        } else {
            fromUserTag = '#БЕЗотправителя';
        }

        var message = `Новое сообщение в чате ${msg.chat.title || 'без названия'}:\n<code>${logMsg}</code>\n\n
            #Сообщение #${msg.chat.username} #${msg.from.username} ${fromUserTag}`;
        
        await this.sendToAdmin(message);
            
    };


    // ANOTHER


    async readErrorReport() {
        var data;
        try {
            data = await fs.readFile(this.reportPath, 'utf-8');
            this.writeErrorReport('');
        } catch (err) {
            const message = err.code === 'ENOENT'
                ? 'Файл отчёта не получен, вероятно это первый запуск или ошибок не было'
                : `Ошибка при чтении отчёта:\n\n<code>${err}</code>\n\n#Отчёт`;
            
            await this.sendToAdmin(message);
            data = null;
            this.writeErrorReport('');
        }
        return data;
    };

    async writeErrorReport(error) {
        var message;
        if (!error) {
            message = 'в writeErrorReport не была передана ошибка';
            await this.sendToAdmin(message);
            return;
        }
        try {
            var date = (new Date).toLocaleString('ru');
            var errText = `Ошибка [${date}]: ${error}`;
            await fs.writeFile(this.reportPath, errText, 'utf-8');
            message = `Успешно записана ошибка в файл\n\n<code>${errText}</code>`;
            await this.sendToAdmin(message);
        } catch (err) {
            message = `Не удалось записать ошибку ${errText} в файл\n\n<code>${err}</code>`;
            await this.sendToAdmin(message);
        };
    };

    async botStartReport() {
        const startDate = new Date().toLocaleString('ru');
        let message;
        const errorReport = await this.readErrorReport();
        
        if (errorReport && errorReport.trim()) {
            message = `Бот стартанул ${startDate}\nПредыдущая остановка была вызвана ошибкой:\n<code>${errorReport}</code>\n#Старт #Ошибка`;
        } else {
            message = `Бот стартанул ${startDate}\n#Старт`;
        }
    
        console.log(`${startDate} | Bot started...`);
        await this.sendToAdmin(message);
    };

    async botStopReport() {

    }

    async logError (text, error) {
        var message = `${text} ${error}\n#Ошибка`;
        await this.sendToAdmin(message);
    };
};


module.exports = Logger;