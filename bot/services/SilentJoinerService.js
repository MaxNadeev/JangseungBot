import { Api } from 'telegram';
import { formatIso } from '../utils/dates.js';
import { buildDisplayName } from '../utils/format.js';

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
        this.windowMin = inspector?.silentJoinWindowMin ?? 60;
        this.enabled = inspector?.silentJoinBanEnabled ?? true;
    }

    async runOnce() {
        if (!this.enabled || this.isRunning) {
            return { success: true, skipped: true };
        }
        this.isRunning = true;
        try {
            var cutoff = Date.now() - this.thresholdMin * 60000;
            var floor = Date.now() - this.windowMin * 60000;
            var userIds = this.db.getSilentJoiners(cutoff, floor);
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
            restrictionDate: formatIso(),
            untilDate: null,
        });

        await this.#notifyAdmin(userId);
        return true;
    }

    async #notifyAdmin(userId) {
        var displayName = buildDisplayName(userId, null);
        try {
            var userResult = await this.botService.getUserFromAPI(userId);
            if (userResult.success) {
                displayName = buildDisplayName(userId, userResult.user);
            }
        } catch (e) {
            // не критично — остаётся ID
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
            message: `Лишил прав ${displayName} — ни одного сообщения`,
            buttons: replyMarkup
        });
    }
}

export default SilentJoinerService;
