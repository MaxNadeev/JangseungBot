import Bot from './bot/core/Bot.js';
import Client from './bot/core/Client.js';
import dotenv from 'dotenv';

dotenv.config();

var runBot = async () => {
    var bot = new Bot();
    await bot.start();
};

var runClient = async () => {
    var client = new Client();
    await client.start();
    
    // Пример отправки эхо-сообщения
    // await client.sendEcho('me', 'Hello from client!');

    var fromCache = false;
    var msg = await client.getMembers(fromCache);
    console.log(msg);

    // var adminLog = await client.getAdminLog();
    // console.log(adminLog);

    // var userId = 7073986937;
    // var msgCount = await client.getUserMessageCount(userId);
    // console.log(`User has sent ${msgCount} messages`);

    // var userId = 7073986937;
    // var isMember = await client.isUserMember(userId);
    // console.log(isMember ? 'User is member' : 'User not member');
};

// Запускаем либо бота, либо клиента
var mode = process.argv[2];
if (mode === '--bot') {
    runBot();
} else if (mode === '--client') {
    runClient();
} else {
    console.log('Please specify mode: --bot or --client');
}