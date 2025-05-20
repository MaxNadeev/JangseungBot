import { Api } from 'telegram';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import JsonManager from '../managers/JsonManager.js';

class UserService {
    #client = null;
    #db = null;
    #lastUpdateTimestamp = Date.now();

    constructor(client, db) {
        this.#client = client;
        this.#db = db;
    }

    async fetchMembers(groupId, useCache = true) {
        try {
            var members = [];
            var limit = 200;
            var offset = 0;
            var totalMembers = 0;
            var hasMore = true;

            while (hasMore) {
                var participants = await this.#client.invoke(
                    new Api.channels.GetParticipants({
                        channel: groupId,
                        filter: new Api.ChannelParticipantsRecent({}),
                        offset: offset,
                        limit: limit,
                        hash: useCache ? this.#calculateHash(offset, groupId) : BigInt(0)
                    })
                );

                if (participants instanceof Api.channels.ChannelParticipants) {
                    totalMembers = participants.count;
                    for (var user of participants.users) {
                        if (user instanceof Api.User) {
                            members.push({
                                id: user.id.value.toString(),
                                username: user.username || null,
                                firstName: user.firstName || '',
                                lastName: user.lastName || null,
                                phone: user.phone || null,
                                isBot: user.bot || false,
                                isPremium: user.premium || false
                            });
                        }
                    }

                    offset += participants.users.length;
                    hasMore = offset < totalMembers;
                } else {
                    hasMore = false;
                }
            }

            console.log(`Fetched ${members.length} members from group ${groupId}`);
            await this.#saveMembersToFile(members);
            return members;
        } catch (error) {
            console.log(`Error fetching members: ${error.message}`);
            throw error;
        }
    }

    async #saveMembersToFile(members) {
        try {
            var dataDir = path.join(process.cwd(), 'data');
            var filePath = path.join(dataDir, 'users.json');

            // Создаем директорию, если ее нет
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
                console.log('Created data directory');
            }

            // Преобразуем данные для сохранения
            var dataToSave = {
                lastUpdated: new Date().toISOString(),
                count: members.length,
                members: members
            };

            await JsonManager.write(filePath, dataToSave);
            console.log(`Saved ${members.length} members to users.json`);
        } catch (error) {
            console.error('Error saving members to file:', error);
            throw error;
        }
    }

    #calculateHash(offset) {
        var hash = crypto.createHash('sha256');
        var input = `${this.#lastUpdateTimestamp}_${offset}`;
        hash.update(input);
        var hexHash = hash.digest('hex');
        return BigInt(`0x${hexHash.substring(0, 16)}`);
    }
}

export default UserService;