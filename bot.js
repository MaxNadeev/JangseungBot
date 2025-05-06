require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.SECRET_KEY;
const adminId = process.env.ADMIN_ID;
const jsonManager = require('./jsonManager');
var messageLogging = false;
var membersLogging = false;

var spamRules = jsonManager.loadRules('spamRules.json');

const bot = new TelegramBot(token, { polling:true });

//console.log("TriggerWords: ", spamRules.triggerWords);/////////////////////

const handleNewMembers = (msg) => {
    var chatId = msg.chat.id;
    var newMembers = msg.new_chat_members || [];
    var fromUser = msg.from || { username: 'unknown, id: 0' };
    var logMsg = JSON.stringify(msg, null, 2);

    if (newMembers.length === 0) return;

    newMembers.forEach(async (member, index) => {
        await delay(index * 1000); //Антифлуд

        var name = [member.first_name, member.last_name].filter(Boolean).join(' ');
        var username = member.username ? `@${member.username}` : '';
        var userLink = `<a href="tg://user?id=${member.id}">${name || username || `Участник с ID ${member.id}`}</a>`;

        var welcomeMessage = `<b>${userLink}</b>, Привет! Hi! 안녕하세요\n\n🗣: 🇷🇺🇬🇧🇰🇷`;

        bot.sendMessage(chatId, welcomeMessage, {parse_mode: 'HTML'});
        if (membersLogging) {
            bot.sendMessage(
                adminId,
                `Пополнение в чате ${msg.chat.title || 'без названия'}:\n` +
                `Добавил: ${fromUser.username ? '@' + fromUser.username : 'id' + fromUser.id}\n` +
                `Новые участники: ${newMembers.map(m => m.username ? '@' + m.username : m.id).join(', ')}`,
                { parse_mode: 'HTML' }
            );
        }
    });
};

bot.on('new_chat_members', hangleNewMembers);
bot.on('new_chat_participant', (msg) => {
    msg.new_chat_members = [msg.new_chat_participant];
    handleNewMembers(msg);
});

// bot.on('new_chat_members', (msg) => {
//     const chatId = msg.chat.id;
//     const newMembers = msg.new_chat_members;
//     const logMsg = JSON.stringify(msg, null, 2);
    
//     newMembers.forEach(member => {
//         var name;
//         var firstName = member.first_name;
//         var lastName = member.last_name;
//         var username = member.username;
//         var id = member.id;
//         //var premium = member.is_premium;
//         var welcomeMessage;
        
//         // firstName && lastName   ? name = `${firstName} ${lastName}` 
//         //     : firstName         ? name = firstName 
//         //     : lastName          ? name = lastName 
//         //     :                     name = member.id
        
//         bot.sendMessage(adminId, `Пополнение в чате ${msg.chat.title || 'без названия'}:\n<code>${logMsg}</code>\n
//                 #Пополнение #${msg.chat.username} #${msg.from.username || ('id' + msg.from.id + ' #БЕЗusername')}`, {
//             parse_mode: 'HTML'
//         });
        
//         if (firstName && lastName){
//             name = `${firstName} ${lastName}`;
//         } else if (firstName){
//             name = firstName;
//         } else if (lastName){
//             name = lastName;
//         }
        
//         if (name && username){
//             welcomeMessage = `<b><a href="tg://user?id=${id}">${name}</a></b> (@${username}), Привет! Hi! 안녕하세요 \n\n🗣: 🇷🇺🇬🇧🇰🇷`;
//         } else if (name){
//             welcomeMessage = `<b><a href="tg://user?id=${id}">${name}</a></b>, Привет! Hi! 안녕하세요 \n\n🗣: 🇷🇺🇬🇧🇰🇷`;
//         } else if (username){
//             welcomeMessage = `<b><a href="tg://user?id=${id}">@${username}</a></b>, Привет! Hi! 안녕하세요 \n\n🗣: 🇷🇺🇬🇧🇰🇷`;
//         } else {
//             welcomeMessage = `<b><a href="tg://user?id=${id}">Участник с id ${id}</a></b>, Привет! Hi! 안녕하세요 \n\n🗣: 🇷🇺🇬🇧🇰🇷`;
//         }

//         bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
//     })
// });

bot.onText(/.*/, async (msg) => {
    if (messageLogging) {
        if (msg.chat.id.toString() !== adminId) {
            const logMsg = JSON.stringify(msg, null, 2);
            await bot.sendMessage(adminId, `Новое сообщение в чате ${msg.chat.title || 'без названия'}:\n<code>${logMsg}</code>\n
                #Сообщение #${msg.chat.username} #${msg.from.username || ('id' + msg.from.id + ' #БЕЗusername')}`, {
                parse_mode: 'HTML'
            });
        }
    }
    
});

bot.onText(/\/hi/, async (msg) => {
    const chatId = msg.chat.id;
    var message = 'Привет! Я Jangseung - тотем этой группы. Я отпугиваю злых духов и приманиваю хороших участников';
    bot.sendMessage(chatId, message);
});

bot.onText('messageLogging', async (msg) => {
    messageLogging ? messageLogging = false : messageLogging = true;
    var message = `messagelogging: ${messageLogging}\n#Настройки`;
    bot.sendMessage(adminId, message, { parse_mode: 'HTML' });
})

bot.onText('membersLogging', async (msg) => {
    membersLogging ? membersLogging = false : membersLogging = true;
    var message = `messagelogging: ${membersLogging}\n#Настройки`;
    bot.sendMessage(adminId, message, { parse_mode: 'HTML' });
})

// function hasSpamWords (text) {

// }

bot.on('polling_error', (error) => {
    console.error(`${(new Date).toLocaleString('ru')} | Polling error:`, error);
});

botStartReport();

function botStartReport () {
    var startDate = (new Date).toLocaleString('ru');
    console.log(`${startDate} | Bot started...`);
    bot.sendMessage(adminId, `Бот стартанул ${startDate}\n#Старт`, {
        parse_mode: 'HTML'
    });
};
