import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import ServiceClient from './ServiceClient.js';

/**
 * Пересчёт сообщений участников (дорогая операция) через юзер-сессию.
 * Запускается по расписанию (Scheduler) и по кнопке в чате с админом.
 * Использует существующий ServiceClient (кик удалённых, firstJoin, restricted).
 */
class ReconcileService {
    constructor(botClient = null) {
        this.isRunning = false;
        this.botClient = botClient;
    }

    async recountWithUserSession(db, groupId, profileManager) {
        if (this.isRunning) {
            return { success: false, error: 'Апдейт уже выполняется' };
        }
        this.isRunning = true;
        var started = Date.now();

        try {
            var session = process.env.CLIENT_SESSION || '';
            console.log('[ReconcileService] process.env.CLIENT_SESSION длина:', session.length);
            console.log('[ReconcileService] process.env.CLIENT_SESSION первые 50 символов:', session.substring(0, 50));
            
            if (!session) {
                console.error('[ReconcileService] CLIENT_SESSION пуста в process.env');
                return { success: false, error: 'нет сессии клиента' };
            }

            console.log('[ReconcileService] Создаю TelegramClient с сессией...');
            var client = new TelegramClient(
                new StringSession(session),
                parseInt(process.env.API_ID),
                process.env.API_HASH,
                { connectionRetries: 5 }
            );

            // checkAuthorization() сам НЕ подключается (invoke требует уже установленный connect),
            // поэтому подключаемся явно, как это делает client.start() в --client режиме.
            var connected = await client.connect();
            console.log('[ReconcileService] connect результат:', connected);

            var authorized = false;
            try {
                console.log('[ReconcileService] Проверяю авторизацию...');
                authorized = await client.checkAuthorization();
                console.log('[ReconcileService] checkAuthorization результат:', authorized);
            } catch (e) {
                console.error('[ReconcileService] checkAuthorization ошибка:', e.message);
                authorized = false;
            }
            if (!authorized) {
                console.error('[ReconcileService] Клиент не авторизован. Сессия устарела или невалидна.');
                await client.destroy().catch(() => {});
                return { success: false, error: 'сессия клиента устарела или невалидна' };
            }

            var serviceClient = new ServiceClient(client, db, groupId, this.botClient);
            var members = await serviceClient.getRecentParticipants();
            var banned = await serviceClient.getRestrictedParticipants('banned');
            var kicked = await serviceClient.getRestrictedParticipants('kicked');
            var admins = await serviceClient.getChatAdmins();

            if (profileManager) {
                profileManager.syncProfilesToUsers(db);
            }

            // destroy() (а не disconnect()) — ставит _destroyed=true, чтобы фоновый
            // _updateLoop клиента пересчёта остановился и не слал TIMEOUT-пинги.
            await client.destroy().catch(() => {});

            return {
                success: true,
                members: members.length,
                banned: banned.length,
                kicked: kicked.length,
                admins: admins.length,
                deleted: serviceClient.deletedKicked,
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
