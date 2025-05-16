require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.SECRET_KEY;
const jsonManager = require('./jsonManager');
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
    var { old_chat_member, new_chat_member } = msg.chat_member;
    var member = new_chat_member.user;
    var oldStatus = old_chat_member.status;
    var newStatus = new_chat_member.status;

    var handler = statusTransitions[oldStatus]?.[newStatus];
    if (handler) {
        await logger[handler](member, msg);
    }
});



// console.log("TriggerWords: ", spamRules.triggerWords);/////////////////////

// const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// const handleNewMembers = (msg) => {
//     try {
//         var chatId = msg.chat.id;
//         var newMembers = msg.new_chat_members || [];

//         if (newMembers.length === 0) return;

//         newMembers.forEach(async (member, index) => {
//             await delay(index * 1000);

//             var name = [member.first_name, member.last_name].filter(Boolean).join(' ');
//             var username = member.username ? `@${member.username}` : false;
//             var userLink = `<a href="tg://user?id=${member.id}">${name || username || `Участник с ID ${member.id}`}</a>`;

//             var welcomeMessage = `<b>${userLink}</b>, Привет! Hi! 안녕하세요\n\n🗣: 🇷🇺🇬🇧🇰🇷`;

//             bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
            
            
//         });
//     } catch (error) {
//         var text = 'При вступлении нового пользователя возникла ошибка: ';
//         reportErrorToAdmin(text, error);
//     }
// };

// bot.on('new_chat_members', handleNewMembers);
// bot.on('new_chat_participant', (msg) => {
//     msg.new_chat_members = [msg.new_chat_participant];
//     handleNewMembers(msg);
// });

// bot.on('left_chat_member', (msg) => {
//     var { left_chat_member: user, chat, from } = msg;

//     if (user.id === bot.getMe().id) return;

//     var userName = user.first_name || user.username || `c id ${user.id}`;
//     var isKicked = from.id !== user.id;
//     var action = isKicked ? "был исключён" : "покинул чат";
//     var who = isKicked ? ` (администратором @${from.username || from.id})` : '';

//     const message = `🚪 Пользователь <b>${userName}</b> ${action}${who}.`;
//     bot.sendMessage(chat.id, message, { parse_mode: 'HTML' });
//     logLeftMember(message, bot);
// });

bot.onText(/.*/, async (msg) => {
    logNewMessage(msg);
});

bot.onText(/\/hi/, async (msg) => {
    const chatId = msg.chat.id;
    var message = 'Привет! Я Jangseung - тотем этой группы. Я отпугиваю злых духов и приманиваю хороших участников';
    bot.sendMessage(chatId, message);
});

bot.onText('messagesLogging', async (msg) => {
    changeParam('messagesLogging');
})

bot.onText('membersLogging', async (msg) => {
    changeParam('membersLogging');
})

// function hasSpamWords (text) {

// }

bot.on('polling_error', (error) => {
    console.error(`${(new Date).toLocaleString('ru')} | Polling error:`, error);
});

logger.botStartReport();