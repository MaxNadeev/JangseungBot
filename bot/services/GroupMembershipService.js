import { Api } from 'telegram';

class GroupMembershipService {
    #client = null;
    #groupId = null;

    constructor(client, groupId) {
        this.#client = client;
        this.#groupId = groupId;
    }

    async isUserInGroup(userId) {
        try {
            // 1. Проверяем существование группы
            var groupExists = await this.#checkGroupExists();
            if (!groupExists) return false;

            // 2. Получаем информацию о пользователе
            var userEntity = await this.#getUserEntitySafe(userId);
            if (!userEntity) return false;

            // 3. Проверяем участие в группе
            return await this.#checkParticipation(userEntity);
        } catch (error) {
            console.error('Error in isUserInGroup:', error);
            return false;
        }
    }

    async #checkGroupExists() {
        try {
            await this.#client.getInputEntity(this.#groupId);
            return true;
        } catch (error) {
            console.error('Group not found:', error.message);
            return false;
        }
    }

    async #getUserEntitySafe(userId) {
        try {
            // Пробуем получить сущность через getEntity (более надежный метод)
            var entity = await this.#client.getEntity(userId);
            return entity;
        } catch (error) {
            // Если не получилось, пробуем создать ручной InputPeer
            if (error.message.includes('Could not find the input entity')) {
                console.warn(`Creating manual peer for user ${userId}`);
                return new Api.InputPeerUser({
                    userId: userId,
                    accessHash: 0 // Используем 0, если хэш доступа неизвестен
                });
            }
            console.error('Error getting user entity:', error.message);
            return null;
        }
    }

    async #checkParticipation(userEntity) {
        try {
            var participant = await this.#client.invoke(
                new Api.channels.GetParticipant({
                    channel: this.#groupId,
                    participant: userEntity
                })
            );
            return !!participant;
        } catch (error) {
            if (error.errorMessage === 'USER_NOT_PARTICIPANT') {
                return false;
            }
            console.error('Error checking participation:', error.message);
            return false;
        }
    }
}

export default GroupMembershipService;