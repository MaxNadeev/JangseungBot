import { Api } from 'telegram';

/**
 * Автобан «молчащих» новичков.
 *
 * Участник, который вступил в группу и не написал ни одного сообщения за
 * silentJoinThresholdMin минут, получает лишение прав (banUser = restrict
 * sendMessages), а не исключение из группы. Админы и доверенные (trusted) не
 * затрагиваются (правило уже в SQL GET_SILENT_JOINERS).
 *
 * Порог и включение берутся из triggers.json (additionalRules), через Inspector.
 */
class SilentJoinerService {
    constructor(botService, db, adminId, inspector) {
        this.botService = botService;
        this.db = db;
        this.adminId = adminId;
        this.inspector = inspector;
        this.isRunning = false;
        this.thresholdMin = inspector?.silentJoinThresholdMin ?? 5;
        this.enabled = inspector?.silentJoinBanEnabled ?? true;
    }

    async runOnce() {
        if (!this.enabled || this.isRunning) {
            return { success: true, skipped: true };
        }
        this.isRunning = true;
        try {
            var cutoff = Date.now() - this.thresholdMin * 60000;
            var userIds = this.db.getSilentJoiners(cutoff);
            var banned = 0;
            for (var userId of userIds) {
                var ok = await this.#banSilentUser(userId);
                if (ok) banned++;
            }
            return { success: true, found: userIds.length, banned };
        } catch (error) {
            console.error(`${new Date().toLocaleString('ru-ru')} SilentJoinerService error:`, error);
            return { success: false, error: error.message };
        } finally {
            this.isRunning = false;
        }
    }

    async #banSilentUser(userId) {
        // лишение прав (restrict sendMessages), НЕ кик
        var banResult = await this.botService.banUser(this.botService.groupId, userId);
        if (!banResult.success) {
            console.error(`${new Date().toLocaleString('ru-ru')} SilentJoiner ban failed for ${userId}:`, banResult.error);
            return false;
        }

        // restrictedBy — только если админ есть в users (иначе FK-ошибка)
        var adminCheck = await this.db.getUser(this.adminId);
        var restrictedBy = adminCheck.data ? this.adminId : null;

        await this.db.upsertRestricted({
            userId,
            isBanned: 1,
            isKicked: 0,
            restrictedBy,
            restrictionDate: new Date().toLocaleString('ru-ru'),
            untilDate: 0,
        });

        await this.#notifyAdmin(userId);
        return true;
    }

    async #notifyAdmin(userId) {
        var displayName = userId;
        try {
            var userResult = await this.botService.getUserFromDB(userId);
            if (userResult.success) {
                var u = userResult.user;
                var name = [u.firstName, u.lastName].filter(Boolean).join(' ');
                if (u.username) name = name ? `${name} (@${u.username})` : `@${u.username}`;
                if (name) displayName = name;
            }
        } catch (e) {
            // не критично — оставляем id
        }

        const buttonUnban = new Api.KeyboardButtonCallback({
            text: 'Разбан',
            data: Buffer.from(`unban_${userId}`),
        });
        const buttonAllow = new Api.KeyboardButtonCallback({
            text: 'Доверять',
            data: Buffer.from(`allow_${userId}`),
        });
        const row = new Api.KeyboardButtonRow({ buttons: [buttonUnban, buttonAllow] });
        const replyMarkup = new Api.ReplyInlineMarkup({ rows: [row] });

        await this.botService.bot.sendMessage(this.adminId, {
            message: `Заблокировал ${displayName} (лишение прав) — не написал ни одного сообщения за ${this.thresholdMin} мин.`,
            buttons: replyMarkup
        });
    }
}

export default SilentJoinerService;
