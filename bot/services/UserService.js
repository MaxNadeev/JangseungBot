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

    async getRecentParticipants(limit = 300) {
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

    async getRestrictedParticipants(filterType = 'banned', limit = 300) {
        try {
            var filter;
            
            switch (filterType) {
                case 'banned':
                    filter = new Api.ChannelParticipantsBanned({ q: '' });
                    break;
                case 'kicked':
                    filter = new Api.ChannelParticipantsKicked({ q: '' });
                    break;
                default:
                    throw new Error('Invalid filter type. Use "banned" or "kicked"');
            }

            var result = await this.#client.invoke(
                new Api.channels.GetParticipants({
                    channel: this.#groupId,
                    filter: filter,
                    offset: 0,
                    limit: limit,
                    hash: 0
                })
            );

            if (!result || !result.users || !result.participants) {
                console.log(`No ${filterType} participants data found`);
                return [];
            }

            // Создаем маппинг userId -> user для быстрого поиска
            var usersMap = new Map();
            result.users.forEach(user => {
                usersMap.set(user.id.toString(), user);
            });

            return result.participants.map(participant => {
                var userId = participant.peer.userId?.toString() || 
                             participant.userId?.toString();
                if (!userId) return null;
                
                var user = usersMap.get(userId) || {};
                var bannedRights = participant.bannedRights;
                var isKicked = filterType === 'kicked';

                return {
                    id: userId,
                    username: user.username || null,
                    firstName: user.firstName || null,
                    lastName: user.lastName || null,
                    deleted: user.deleted,
                    isBanned: !isKicked,
                    isKicked: isKicked,
                    bannedRights: bannedRights ? this.#formatBannedRights(bannedRights) : null,
                    restrictionInfo: {
                        date: participant.date,
                        restrictedBy: participant.kickedBy?.toString()
                    }
                };
            }).filter(Boolean);

        } catch (error) {
            console.error(`Error getting ${filterType} participants:`, error);
            return [];
        }
    }

    #formatBannedRights(bannedRights) {
        return {
            viewMessages: bannedRights.viewMessages,
            sendMessages: bannedRights.sendMessages,
            sendMedia: bannedRights.sendMedia,
            sendStickers: bannedRights.sendStickers,
            sendGifs: bannedRights.sendGifs,
            sendGames: bannedRights.sendGames,
            sendInline: bannedRights.sendInline,
            embedLinks: bannedRights.embedLinks,
            sendPolls: bannedRights.sendPolls,
            changeInfo: bannedRights.changeInfo,
            inviteUsers: bannedRights.inviteUsers,
            pinMessages: bannedRights.pinMessages,
            manageTopics: bannedRights.manageTopics,
            sendPhotos: bannedRights.sendPhotos,
            sendVideos: bannedRights.sendVideos,
            sendRoundvideos: bannedRights.sendRoundvideos,
            sendAudios: bannedRights.sendAudios,
            sendVoices: bannedRights.sendVoices,
            sendDocs: bannedRights.sendDocs,
            sendPlain: bannedRights.sendPlain,
            untilDate: bannedRights.untilDate
        };
    }

    async getChatAdmins(includeCreator = true, limit = 30) {
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

            if (!result || !result.users || !result.participants) {
                console.log('No admin data found');
                return [];
            }

            // Создаем маппинг userId -> participant для быстрого поиска
            var participantsMap = new Map();
            result.participants.forEach(participant => {
                if (participant.userId) {
                    participantsMap.set(participant.userId.toString(), participant);
                }
            });

            var admins = [];
            
            result.users.forEach(user => {
                var participant = participantsMap.get(user.id.toString());
                if (!participant) return;

                var isCreator = participant.className === 'ChannelParticipantCreator';
                var adminRights = participant.adminRights;
                
                // Если не включаем создателя и это создатель - пропускаем
                if (!includeCreator && isCreator) return;

                admins.push({
                    id: user.id.toString(),
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    isAdmin: true,
                    isCreator: isCreator,
                    isBot: user.bot || false,
                    adminRights: adminRights ? {
                        changeInfo: adminRights.changeInfo,
                        postMessages: adminRights.postMessages,
                        editMessages: adminRights.editMessages,
                        deleteMessages: adminRights.deleteMessages,
                        banUsers: adminRights.banUsers,
                        inviteUsers: adminRights.inviteUsers,
                        pinMessages: adminRights.pinMessages,
                        addAdmins: adminRights.addAdmins,
                        anonymous: adminRights.anonymous,
                        manageCall: adminRights.manageCall,
                        other: adminRights.other,
                        manageTopics: adminRights.manageTopics
                    } : null
                });
            });

            // Сортируем: сначала создатель, затем остальные админы
            admins.sort((a, b) => b.isCreator - a.isCreator);

            return admins;

        } catch (error) {
            console.error('Error getting chat admins:', error);
            return [];
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