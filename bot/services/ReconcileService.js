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

    /**
     * Прогресс-репортёр: одно редактируемое сообщение админу с индикатором из 10 кубиков.
     * update(text) — рисует бар с текущим прогрессом; stage(label) — продвигает на +2 кубика (20%).
     * @returns {{update: Function, stage: Function}}
     */
    #makeProgressReporter() {
        var bot = this.botClient;
        var adminId = process.env.ADMIN_ID;

        if (!bot || !adminId) {
            return { update: async () => {}, stage: async () => {} };
        }

        var msgId = null;
        var done = 0;
        var totalStages = 5;

        var render = (text) => {
            var filled = done * 2;
            var bar = '🟩'.repeat(filled) + '⬛'.repeat(10 - filled);
            return bar + '\n' + text;
        };

        var sendOrEdit = async (text) => {
            try {
                if (msgId != null) {
                    await bot.editMessage(adminId, { message: msgId, text });
                } else {
                    var sent = await bot.sendMessage(adminId, { message: text });
                    msgId = sent && sent.id ? sent.id : null;
                }
            } catch (e) {
                console.error(`${new Date().toLocaleString('ru-ru')} [ReconcileService] progress edit error:`, e && e.message);
                // если edit упал (сообщение удалено) — пробуем отправить заново
                try {
                    var sent2 = await bot.sendMessage(adminId, { message: text });
                    msgId = sent2 && sent2.id ? sent2.id : null;
                } catch (e2) {
                    console.error(`${new Date().toLocaleString('ru-ru')} [ReconcileService] progress send error:`, e2 && e2.message);
                }
            }
        };

        return {
            update: async (text) => { await sendOrEdit(render(text)); },
            stage: async (label) => {
                done = Math.min(done + 1, totalStages);
                await sendOrEdit(render(label));
            }
        };
    }

    async #notifyOnce(text) {
        if (!this.botClient || !process.env.ADMIN_ID) return;
        try {
            await this.botClient.sendMessage(process.env.ADMIN_ID, { message: text });
        } catch (e) {
            console.error(`${new Date().toLocaleString('ru-ru')} [ReconcileService] notify error:`, e && e.message);
        }
    }

    async recountWithUserSession(db, groupId, profileManager) {
        if (this.isRunning) {
            await this.#notifyOnce('⚠️ Апдейт уже выполняется, подождите.');
            return { success: false, error: 'Апдейт уже выполняется' };
        }
        this.isRunning = true;
        var started = Date.now();
        var progress = this.#makeProgressReporter();

        try {
            await progress.update('Подключаюсь к клиенту…');

            var session = process.env.CLIENT_SESSION || '';
            console.log(`${new Date().toLocaleString('ru-ru')} [ReconcileService] process.env.CLIENT_SESSION length:`, session.length);
            console.log(`${new Date().toLocaleString('ru-ru')} [ReconcileService] process.env.CLIENT_SESSION first 50 symbols:`, session.substring(0, 50));

            if (!session) {
                console.error(`${new Date().toLocaleString('ru-ru')} [ReconcileService] CLIENT_SESSION empty inprocess.env`);
                await progress.update('❌ Ошибка: нет сессии клиента');
                return { success: false, error: 'нет сессии клиента' };
            }

            console.log(`${new Date().toLocaleString('ru-ru')} [ReconcileService] Создаю TelegramClient с сессией...`);
            var client = new TelegramClient(
                new StringSession(session),
                parseInt(process.env.API_ID),
                process.env.API_HASH,
                { connectionRetries: 5 }
            );
            // Гасим служебные логи GramJS у разового клиента пересчёта: иначе его фоновый
            // _updateLoop при shutdown кидает безобидный «Error: TIMEOUT» (пинг уже отключённого сендера).
            client.setLogLevel('none');

            // checkAuthorization() сам НЕ подключается (invoke требует уже установленный connect),
            // поэтому подключаемся явно, как это делает client.start() в --client режиме.
            var connected = await client.connect();
            console.log(`${new Date().toLocaleString('ru-ru')} [ReconcileService] connect результат:`, connected);

            var authorized = false;
            try {
                console.log(`${new Date().toLocaleString('ru-ru')} [ReconcileService] Checking authorization...`);
                authorized = await client.checkAuthorization();
                console.log(`${new Date().toLocaleString('ru-ru')} [ReconcileService] checkAuthorization result:`, authorized);
            } catch (e) {
                console.error(`${new Date().toLocaleString('ru-ru')} [ReconcileService] checkAuthorization error:`, e.message);
                authorized = false;
            }
            if (!authorized) {
                console.error(`${new Date().toLocaleString('ru-ru')} [ReconcileService] Client is not authorized. Session has expired or is invalid.`);
                await client.destroy().catch(() => {});
                await progress.update('❌ Error: session has expired or is invalid');
                return { success: false, error: 'session has expired or is invalid' };
            }

            var serviceClient = new ServiceClient(
                client, db, groupId, this.botClient,
                (label) => progress.stage(label)
            );
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

            var seconds = Math.round((Date.now() - started) / 1000);
            await progress.update(`✅ Апдейт выполнен\n\nУчастников: ${members.length}\nБанов: ${banned.length}\nКиков: ${kicked.length}\nАдминов: ${admins.length}\nУдалено удалённых аккаунтов: ${serviceClient.deletedKicked}\nВыполненто за ${seconds} сек.`);

            return {
                success: true,
                members: members.length,
                banned: banned.length,
                kicked: kicked.length,
                admins: admins.length,
                deleted: serviceClient.deletedKicked,
                seconds: seconds
            };
        } catch (error) {
            console.error(`${new Date().toLocaleString('ru-ru')} [ReconcileService] Error:`, error);
            var errMsg = error && error.message ? error.message : String(error);
            await progress.update('❌ Ошибка: ' + errMsg);
            return { success: false, error: errMsg };
        } finally {
            this.isRunning = false;
        }
    }
}

export default ReconcileService;
