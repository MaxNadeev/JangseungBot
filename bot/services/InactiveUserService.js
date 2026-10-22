import { Api } from 'telegram';
import { buildDisplayName } from '../utils/format.js';

/**
 * Неактивные «старожилы»: участник в группе долго (inactiveDays), а сообщений
 * мало (inactiveMaxMessages). Админу отправляется ОДНО сообщение с батчем
 * (inactiveBatchSize) и кнопками «Ограничить N» (переиспользуют callback ban).
 * Каждый отправленный помечается inactiveReported, чтобы не слать повторно.
 */
class InactiveUserService {
    constructor(botService, db, adminId, inspector) {
        this.botService = botService;
        this.db = db;
        this.adminId = adminId;
        this.inspector = inspector;
        this.isRunning = false;
        this.inactiveDays = inspector?.inactiveDays ?? 365;
        this.inactiveMaxMessages = inspector?.inactiveMaxMessages ?? 1;
        this.inactiveBatchSize = inspector?.inactiveBatchSize ?? 10;
    }

    async runOnce() {
        if (this.isRunning) return { success: true, skipped: true };
        this.isRunning = true;
        try {
            var cutoff = Date.now() - this.inactiveDays * 86400000;
            var userIds = this.db.getDormantUsers(cutoff, this.inactiveMaxMessages, this.inactiveBatchSize);

            if (userIds.length === 0) {
                return { success: true, reported: 0 };
            }

            var lines = [];
            var rows = [];
            for (var i = 0; i < userIds.length; i++) {
                var userId = userIds[i];

                var displayName = buildDisplayName(userId, null);
                try {
                    var userResult = await this.botService.getUserFromDB(userId);
                    if (userResult.success) {
                        displayName = buildDisplayName(userId, userResult.user);
                    }
                } catch (e) {
                    // не критично — остаётся ID
                }

                lines.push(`${i + 1}. ${displayName}`);
                rows.push(new Api.KeyboardButtonRow({
                    buttons: [
                        new Api.KeyboardButtonCallback({
                            text: `Ограничить ${i + 1}`,
                            data: Buffer.from(`ban_${userId}`),
                        })
                    ]
                }));
            }

            var replyMarkup = new Api.ReplyInlineMarkup({ rows });

            await this.botService.bot.sendMessage(this.adminId, {
                message: `Неактивные участники (в группе > ${this.inactiveDays} дн., ≤ ${this.inactiveMaxMessages} сообщ.):\n${lines.join('\n')}`,
                buttons: replyMarkup
            });

            for (var uid of userIds) {
                this.db.setInactiveReported(uid, Date.now());
            }

            return { success: true, reported: userIds.length };
        } catch (error) {
            console.error('InactiveUserService error:', error);
            return { success: false, error: error.message };
        } finally {
            this.isRunning = false;
        }
    }
}

export default InactiveUserService;
