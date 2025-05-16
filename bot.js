require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.SECRET_KEY;

const Logger = require('./logger');

// var spamRules = jsonManager.loadRules('spamRules.json');

const bot = new TelegramBot(token, { 
    polling:true,
    chat_member: true
});

const logger = new Logger(bot);
logger.loadConfig();

const statusTransitions = {
    left: {
        member: 'logLeft2Member',
        restricted: 'logLeft2Restricted'
    },
    member: {
        left: 'logMember2Left',
        restricted: 'logMember2Restricted',
        kicked: 'logMember2Kicked',
        administrator: 'logMember2Administrator'
    },
    restricted: {
        member: 'logRestricted2Member',
        left: 'logRestricted2Left'
    },
    administrator: {
        member: 'logAdministrator2Member',
        left: 'logAdministrator2Left',
        kicked: 'logAdministrator2Kicked'
    },
    kicked: {
        left: 'logKicked2Left'
    }
};

bot.on('chat_member', async (msg) => {
    console.log('chat_member'); ///////////////////////////////////
    var { old_chat_member, new_chat_member } = msg.chat_member;
    var member = new_chat_member.user;
    var oldStatus = old_chat_member.status;
    var newStatus = new_chat_member.status;

    var handler = statusTransitions[oldStatus]?.[newStatus];
    console.log('member: ', member, 'oldStatus: ', oldStatus, 'newStatus: ', newStatus); ////////////////////
    if (handler) {
        await logger[handler](member, msg);
    }
});

const commands = ['messagesLogging', 'membersLogging'];

bot.onText(/.*/, async (msg) => {
    if (commands.includes(msg.text)) {
        logger.changeParam(msg.text);
    }
    logger.logNewMessage(msg);
});

bot.onText(/\/hi/, async (msg) => {
    const chatId = msg.chat.id;
    var message = 'Привет! Я Jangseung - тотем этой группы. Я отпугиваю злых духов и приманиваю хороших участников';
    bot.sendMessage(chatId, message);
});

// function hasSpamWords (text) {

// }

bot.on('polling_error', (error) => {
    var errText = `${(new Date).toLocaleString('ru')} | Polling error:)`;
    logger.logError(errText, error);
});

logger.botStartReport();