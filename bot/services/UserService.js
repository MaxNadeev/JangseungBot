import { Api } from 'telegram';

class UserService {
    #client = null;
    #groupId = null;
    #db = null;

    constructor(client, db, groupId) {
        this.#client = client;
        this.#db = db;
        this.#groupId = groupId;
    }

    async getRecentParticipants(limit = 200) {
        try {
            var result = await this.#client.invoke(
                new Api.channels.GetParticipants({
                    channel: this.#groupId,
                    filter: new Api.ChannelParticipantsRecent(),
                    offset: 0,
                    limit: limit,
                    hash: 0
                })
            );

            console.log(result); ////////////////////////

            var users = result.users || [];
            return users.map(user => ({
                id: user.id.toString(),
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                isBot: user.bot || false,
                isPremium: user.premium || false
            }));

        } catch (error) {
            console.error('Error getting recent participants:', error);
            return [];
        }
    }

    async getBannedParticipants(limit = 200) {
        try {
            var result = await this.#client.invoke(
                new Api.channels.GetParticipants({
                    channel: this.#groupId,
                    filter: new Api.ChannelParticipantsBanned({ q: '' }), // q - фильтр по имени (пустая строка = все)
                    offset: 0,
                    limit: limit,
                    hash: 0
                })
            );

            console.log(result); ////////////////////

            return result.users.map(user => ({
                id: user.id.toString(),
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                isBanned: true // Явно помечаем как забаненных
            }));

        } catch (error) {
            console.error('Error getting banned participants:', error);
            return [];
        }
    }

    async getKickedParticipants(limit = 200) {
        try {
            var result = await this.#client.invoke(
                new Api.channels.GetParticipants({
                    channel: this.#groupId,
                    filter: new Api.ChannelParticipantsKicked({ q: '' }), // Пустая строка = все кикнутые
                    offset: 0,
                    limit: limit,
                    hash: 0
                })
            );

            console.log(result);

            return result.users.map(user => ({
                id: user.id.toString(),
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                wasKicked: true // Явно помечаем как кикнутых
            }));

        } catch (error) {
            console.error('Error getting kicked participants:', error);
            return [];
        }
    }

    async getChatAdmins(limit = 100) {
        try {
            var result = await this.#client.invoke(
                new Api.channels.GetParticipants({
                    channel: this.#groupId,
                    filter: new Api.ChannelParticipantsAdmins(),
                    offset: 0,
                    limit: limit,
                    hash: 0
                })
            );

            console.log(result); /////////////////

            return result.users.map(user => ({
                id: user.id.toString(),
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                isAdmin: true, // Помечаем как админа
                isBot: user.bot || false // Добавляем флаг бота
            }));

        } catch (error) {
            console.error('Error getting chat admins:', error);
            return [];
        }
    }

    async getChatCreator() {
        try {
            var result = await this.#client.invoke(
                new Api.channels.GetParticipants({
                    channel: this.#groupId,
                    filter: new Api.ChannelParticipantsAdmins(),
                    offset: 0,
                    limit: 100,
                    hash: 0
                })
            );

            // Ищем участника с ролью creator
            var creator = result.participants.find(p => 
                p.className === 'ChannelParticipantCreator'
            );

            if (!creator) {
                console.log('Chat creator not found');
                return null;
            }

            // Находим соответствующий объект пользователя
            var user = result.users.find(u => 
                u.id.equals(creator.userId)
            );

            return {
                id: user.id.toString(),
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                isCreator: true,
                adminRights: creator.adminRights // Можно добавить детали прав
            };

        } catch (error) {
            console.error('Error getting chat creator:', error);
            return null;
        }
    }

    async isUserInGroup(userId) {
        try {
            var numericUserId = Number(userId);
            if (isNaN(numericUserId)) {
                console.error('Invalid user ID format');
                return false;
            }

            var members = await this.getParticipants('recent');
            var bannedUsers = await this.getParticipants('kicked');

            var isMember = members.some(member => 
                Number(member.id) === numericUserId
            );
            
            var isBanned = bannedUsers.some(user => 
                Number(user.id) === numericUserId
            );

            await this.#db.updateUserStats(numericUserId.toString(), {
                inGroup: isMember && !isBanned ? 1 : 0,
                isBanned: isBanned ? 1 : 0
            });

            return isMember && !isBanned;
        } catch (error) {
            console.error('Error checking user membership:', error);
            return false;
        }
    }

    async getUserMessageCount(userId) {
        try {
            var numericUserId = Number(userId);
            if (isNaN(numericUserId)) {
                console.error('Invalid user ID format');
                return 0;
            }

            var peer = await this.#client.getInputEntity(this.#groupId);
            
            var searchResult = await this.#client.invoke(
                new Api.messages.Search({
                    peer: peer,
                    q: '',
                    filter: new Api.InputMessagesFilterEmpty(),
                    minDate: 0,
                    maxDate: 0,
                    offsetId: 0,
                    addOffset: 0,
                    limit: 1,
                    maxId: 0,
                    minId: 0,
                    fromId: new Api.InputPeerUser({
                        userId: numericUserId,
                        accessHash: await this.#getAccessHash(numericUserId)
                    }),
                    hash: 0
                })
            );

            var count = searchResult.count || 0;
            
            await this.#db.updateUserStats(numericUserId.toString(), {
                msgCount: count
            });

            return count;
        } catch (error) {
            console.error(`Error getting message count for user ${userId}:`, error);
            return 0;
        }
    }

    async #getAccessHash(userId) {
        try {
            var entity = await this.#client.getInputEntity(userId);
            return entity.accessHash;
        } catch {
            return 0;
        }
    }
}

export default UserService;