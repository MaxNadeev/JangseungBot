import { Api } from 'telegram';

class MessageStatsService {
    #client = null;
    #groupId = null;

    constructor(client, groupId) {
        this.#client = client;
        this.#groupId = groupId;
    }

    async getUserMessageCount(userId) {
        try {
            // Преобразуем userId в число (если это BigInt или строка)
            var numericUserId = Number(userId);
            
            // Убедимся, что groupId корректно преобразован
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

            return searchResult.count || 0;
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
            return 0; // Если не удалось получить accessHash
        }
    }
}

export default MessageStatsService;