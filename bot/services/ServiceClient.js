import { Api } from 'telegram';
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));


class ServiceClient {
    #client = null;
    #groupId = null;
    #db = null;

    constructor(client, db, groupId) {
        this.#client = client;
        this.#db = db;
        this.#groupId = groupId;
    }

    async #saveParticipantsToDB(participants, type = 'member') {
        try {
            
            var updatedOn = new Date().toLocaleString('ru-ru');
            for (var participant of participants) {
                await wait(Math.random() * 333);
                var msgCount = await this.getUserMessageCount(participant.id);
                console.log('#saveParticipantsToDB msgCount: ', msgCount);
                // для таблицы users
                var userData = {
                    id: participant.id,
                    username: participant.username,
                    firstName: participant.firstName,
                    lastName: participant.lastName,
                    phone: participant.phone,
                    isBot: participant.isBot,
                    isPremium: participant.isPremium,
                    isInGroup: type === 'member' ? 1 : type === 'kicked' ? 0 : type === 'admin' ? 1 : null,
                    msgCount: msgCount,
                    updatedOn: updatedOn,
                };

                // Сохраняем в users
                var result = await this.#db.upsertUser(userData);
                if (!result.success) {
                    console.error('Failed to save user:', participant.id);
                    continue;
                }

                // для таблицы restricted
                if (type === 'banned' || type === 'kicked') {
                    var restrictedData = {
                        userId: participant.id,
                        isBanned: type === 'banned',
                        isKicked: type === 'kicked',
                        restrictedBy: participant.restrictionInfo?.restrictedBy,
                        restrictionDate: participant.restrictionInfo?.date,
                        untilDate: participant.bannedRights?.untilDate,
                        updatedOn: updatedOn
                    };

                    // Проверяем, существует ли пользователь, который наложил ограничение
                    if (restrictedData.restrictedBy) {
                        var restrictorExists = await this.#db.getUser(restrictedData.restrictedBy);
                        if (!restrictorExists.success || !restrictorExists.user) {
                            restrictedData.restrictedBy = null; // Убираем ссылку, если пользователь не найден
                        }
                    }

                    // Сохраняем в таблицу restricted
                    var restrictedResult = await this.#db.upsertRestricted(restrictedData);
                    if (!restrictedResult.success) {
                        console.error('Failed to save restricted data for:', participant.id);
                        continue;
                    }

                    // Сохраняем права в таблицу restricted
                    if (participant.bannedRights) {
                        var rightsResult = await this.#db.upsertRestrictedRights({
                            userId: participant.id,
                            ...participant.bannedRights
                        });
                        if (!rightsResult.success) {
                            console.error('Failed to save restricted rights for:', participant.id);
                        }
                    }
                }

                // для таблицы admins
                if (type === 'admin') {
                    var adminData = {
                        userId: participant.id,
                        isCreator: participant.isCreator,
                        updatedOn: updatedOn
                    };

                    // Проверяем, существует ли пользователь, который назначил админа
                    if (adminData.promotedBy) {
                        var promoterExists = await this.#db.getUser(adminData.promotedBy);
                        if (!promoterExists.success || !promoterExists.user) {
                            adminData.promotedBy = null;
                        }
                    }

                    // Сохраняем в таблицу admins
                    var adminResult = await this.#db.upsertAdmin(adminData);
                    if (!adminResult.success) {
                        console.error('Failed to save admin data for:', participant.id);
                        continue;
                    }

                    // Сохраняем права в таблицу admins
                    if (participant.adminRights) {
                        var adminRightsResult = await this.#db.upsertAdminRights({
                            userId: participant.id,
                            ...participant.adminRights
                        });
                        if (!adminRightsResult.success) {
                            console.error('Failed to save admin rights for:', participant.id);
                        }
                    }
                }
            }
            return { success: true, count: participants.length };
        } catch (error) {
            console.error('Error saving participants:', error);
            return { success: false, error: error.message };
        }
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

            var users = result.users || [];
            var participants = users.map(user => ({
                id: user.id.toString(),
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                isBot: user.bot || false,
                isPremium: user.premium || false,
            }));

            // Сохраняем в базу данных
            await this.#saveParticipantsToDB(participants, 'member');
            
            return participants;
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

            var restrictedParticipants = result.participants.map(participant => {
                var userId = participant.peer.userId?.toString() || 
                             participant.userId?.toString();
                if (!userId) return null;
                
                var user = usersMap.get(userId) || {};
                var bannedRights = participant.bannedRights;
                var isKicked = filterType === 'kicked';
                var isInGroup = isKicked ? 0 : null;

                return {
                    id: userId,
                    username: user.username || null,
                    firstName: user.firstName || null,
                    lastName: user.lastName || null,
                    phone: user.phone || null,
                    isBot: user.bot || false,
                    isPremium: user.premium || false,
                    isBanned: !isKicked,
                    isKicked: isKicked,
                    isInGroup: isInGroup,
                    updatedOn: new Date().toLocaleString('ru-ru'),
                    bannedRights: bannedRights ? this.#formatBannedRights(bannedRights) : null,
                    restrictionInfo: {
                        date: new Date(participant.date).toLocaleString('ru-ru'),
                        restrictedBy: participant.kickedBy?.toString()
                    }
                };
            }).filter(Boolean);

            // Сохраняем в базу данных
            await this.#saveParticipantsToDB(restrictedParticipants, filterType);
            
            return restrictedParticipants;
        } catch (error) {
            console.error(`Error getting ${filterType} participants:`, error);
            return [];
        }
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
                    phone: user.phone || null,
                    isBot: user.bot || false,
                    isPremium: user.premium || false,
                    isAdmin: true,
                    isCreator: isCreator,
                    updatedOn: new Date().toLocaleString('ru-ru'),
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

            // Сохраняем в базу данных
            await this.#saveParticipantsToDB(admins, 'admin');
            
            return admins;
        } catch (error) {
            console.error('Error getting chat admins:', error);
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

    /**
     * 
     * @param {number} userId 
     * @returns {number}
     */
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
            return -1;
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

export default ServiceClient;