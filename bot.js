require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.SECRET_KEY;
const adminId = process.env.ADMIN_ID;
const jsonManager = require('./jsonManager');

var spamRules = jsonManager.loadRules('spamRules.json');

const bot = new TelegramBot(token, { polling:true });

console.log("TriggerWords: ", spamRules.triggerWords);/////////////////////

bot.on('new_chat_members', (msg) => {
    const chatId = msg.chat.id;
    const newMembers = msg.new_chat_members;

    newMembers.forEach(member => {
        var name;
        var firstName = member.first_name;
        var lastName = member.last_name;
        var username = member.username;
        var id = member.id;
        //var premium = member.is_premium;
        var welcomeMessage;
        
        // firstName && lastName   ? name = `${firstName} ${lastName}` 
        //     : firstName         ? name = firstName 
        //     : lastName          ? name = lastName 
        //     :                     name = member.id

        if (firstName && lastName){
            name = `${firstName} ${lastName}`;
        } else if (firstName){
            name = firstName;
        } else if (lastName){
            name = lastName;
        }
        
        if (name && username){
            welcomeMessage = `<b><a href="tg://user?id=${id}">${name}</a></b> (@${username}), Привет! Hi! 안녕하세요 \n\n🗣: 🇷🇺🇬🇧🇰🇷`;
        } else if (name){
            welcomeMessage = `<b><a href="tg://user?id=${id}">${name}</a></b>, Привет! Hi! 안녕하세요 \n\n🗣: 🇷🇺🇬🇧🇰🇷`;
        } else if (username){
            welcomeMessage = `<b><a href="tg://user?id=${id}">@${username}</a></b>, Привет! Hi! 안녕하세요 \n\n🗣: 🇷🇺🇬🇧🇰🇷`;
        } else {
            welcomeMessage = `<b><a href="tg://user?id=${id}">Участник с id ${id}</a></b>, Привет! Hi! 안녕하세요 \n\n🗣: 🇷🇺🇬🇧🇰🇷`;
        }

        bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
        
        console.log(`${(new Date).toLocaleString('ru')} | ${welcomeMessage} \n=========================`);
        console.log(JSON.stringify(msg, null, 2));
    })
});

bot.onText('text', (msg) => {
    if (msg.chat.id.toString() !== adminId) {
        const logMsg = JSON.stringify(msg, null, 2);
        bot.sendMessage(adminId, `Новое сообщение в чате ${msg.chat.title || 'без названия'}:\n<code>${logMsg}</code>`, {
            parse_mode: 'HTML'
        });
    }
});

bot.onText(/\/hi/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Привет! Я Jangseung - тотем этой группы. Я отпугиваю злых духов и приманиваю хороших участников');
    
    console.log(`${(new Date).toLocaleString('ru')}\n=========================`);
    console.log(JSON.stringify(msg, null, 2));
});

// function hasSpamWords (text) {

// }

bot.on('polling_error', (error) => {
    console.error(`${(new Date).toLocaleString('ru')} | Polling error:`, error);
  });
  
console.log(`${(new Date).toLocaleString('ru')} | Bot started...`);