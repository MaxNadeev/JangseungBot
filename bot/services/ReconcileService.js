import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import ServiceClient from './ServiceClient.js';

/**
 * Пересчёт сообщений участников (дорогая операция) через юзер-сессию.
 * Запускается по расписанию (Scheduler) и по кнопке в чате с админом.
 * Использует существующий ServiceClient (кик удалённых, firstJoin, restricted).
 */
class ReconcileService {
    constructor() {
        this.isRunning = false;
    }

    async recountWithUserSession(db, groupId, profileManager) {
        if (this.isRunning) {
            return { success: false, error: 'Пересчёт уже выполняется' };
        }
        this.isRunning = true;
        var started = Date.now();

        try {
            var session = process.env.CLIENT_SESSION || '';
            if (!session) {
                return { success: false, error: 'нет сессии клиента' };
            }

            var client = new TelegramClient(
                new StringSession(session),
                parseInt(process.env.API_ID),
                process.env.API_HASH,
                { connectionRetries: 5 }
            );

            var authorized = false;
            try {
                authorized = await client.checkAuthorization();
            } catch (e) {
                authorized = false;
            }
            if (!authorized) {
                await client.disconnect().catch(() => {});
                return { success: false, error: 'нет сессии клиента' };
            }

            var serviceClient = new ServiceClient(client, db, groupId);
            var members = await serviceClient.getRecentParticipants();
            var banned = await serviceClient.getRestrictedParticipants('banned');
            var kicked = await serviceClient.getRestrictedParticipants('kicked');
            var admins = await serviceClient.getChatAdmins();

            if (profileManager) {
                profileManager.syncProfilesToUsers(db);
            }

            await client.disconnect().catch(() => {});

            return {
                success: true,
                members: members.length,
                banned: banned.length,
                kicked: kicked.length,
                admins: admins.length,
                seconds: Math.round((Date.now() - started) / 1000)
            };
        } catch (error) {
            console.error('ReconcileService error:', error);
            return { success: false, error: error.message };
        } finally {
            this.isRunning = false;
        }
    }
}

export default ReconcileService;
