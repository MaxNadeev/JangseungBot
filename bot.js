require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.SECRET_KEY;

const bot = new TelegramBot(token, { polling:true });

bot.on('new_chat_members', (msg) => {
    const chatId = msg.chat.id;
    const newMembers = msg.new_chat_members;

    newMembers.forEach(member => {
        var name;
        var greeting;
        var firstName = member.first_name;
        var lastName = member.last_name;
        var username = member.username;
        var id = member.id;
        //var premium = member.is_premium;
        var language = member.language_code;
        
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
        } else if (username){
            name = username;
        } else {
            name = `id ${id}`;
        }

        var welcomeMessage = `${name}, Привет! Hi! 안녕하세요 \n\n🗣: 🇷🇺🇬🇧🇰🇷`;

        bot.sendMessage(chatId, welcomeMessage);
        
        console.log(`${(new Date).toLocaleString('ru')} | ${welcomeMessage} \n=========================`);
        console.log(JSON.stringify(msg, null, 2));
    })
});

bot.onText(/\/hi/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Привет! Я Jangseung - тотем этой группы. Я отпугиваю злых духов и приманиваю хороших участников');
    
    console.log(`${(new Date).toLocaleString('ru')}\n=========================`);
    console.log(JSON.stringify(msg, null, 2));
});

bot.on('polling_error', (error) => {
    console.error(`${(new Date).toLocaleString('ru')} | Polling error:`, error);
  });
  
console.log(`${(new Date).toLocaleString('ru')} | Bot started...`);