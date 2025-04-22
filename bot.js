require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.SECRET_KEY;

const bot = new TelegramBot(token, { polling:true });

bot.onText(/\/jstatus/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Привет! Я Jangseung');
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
  });
  
console.log('Бот запущен...');