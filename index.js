import Bot from './bot/core/Bot.js';
import Client from './bot/core/Client.js';
import dotenv from 'dotenv';
import DBManager from './bot/managers/DBManager.js';
import readline from 'readline/promises';

dotenv.config();

var dbManager = new DBManager('./data/users.db');
await dbManager.init();

const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

var runBot = async () => {
    var bot = new Bot();
    await bot.start();
};

var runClient = async () => {
    var client = new Client(dbManager);
    await client.start();
    
    // Пример отправки эхо-сообщения
    // await client.sendEcho('me', 'Hello from client!');

    // var participants = await client.getRecentParticipants();
    // // console.log(participants);
    // console.log('Recent participants:', participants.length);
    
    var bannedUsers = await client.getRestrictedParticipants();
    // console.log(bannedUsers[0],bannedUsers[1], bannedUsers[2],bannedUsers[3],bannedUsers[4]);
    console.log('Banned users:', bannedUsers.length);
    
    var kickedUsers = await client.getRestrictedParticipants('kicked');
    // console.log(kickedUsers[0],kickedUsers[1],kickedUsers[2], kickedUsers[3], kickedUsers[4]);
    console.log('Kicked users:', kickedUsers.length);

    // var admins = await client.getChatAdmins();
    // console.log(admins);
    // console.log('Chat admins:', admins.length);
    
    // var creator = await client.getChatCreator();
    // console.log(creator);

    // var userData = await dbManager.getUsersFromDB();
    // console.log('Users in DB:', dbUsers.users.length);

    // тест группа ID
    // var testUserIds = {
    //     member: 1224705528,
    //     adminBot: 8103951797,
    //     creator: 330496561,
    //     notInGroup: 1234,
    //     adminHuman: 5323999526,
    //     thisCodeAdmin: 7073986937,
    //     restrictedUser: 7778392694,
    //     excluded: 5603746843,
    //     banned: 7593290595,
    //     restricted2: 6606136961
    // };




    // var userId;
    // while (userId !== '0') {
    //     userId = await rl.question('Введите ID пользователя: ');
    //     
    // }
    

    

    // var adminLog = await client.getAdminLog();
    // console.log(adminLog);
    
    // var userId = 7073986937;
    // var msgCount = await client.getUserMessageCount(userId);
    // console.log(`User has sent ${msgCount} messages`);
    
    // var userId = 7073986937;
    // var isMember = await client.isUserMember(userId);
    // console.log(isMember ? 'User is member' : 'User not member');
    
    // var userId = 7073986937;
    // var userData = await dbManager.getUsersFromDB(userId);
    // console.log(userData);

    await client.stop();
    process.exit(0);

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