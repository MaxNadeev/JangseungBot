import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * Резервная БД ручных данных профилей (data/profiles.db).
 *
 * Хранит то, что вводится вручную и НЕ восстанавливается --client:
 * - в одной таблице userProfiles (снимок, без истории): realName, gender, place,
 *   nationality, age, trusted, firstJoin, birthday + updatedOn;
 * - в отдельных таблицах с историей (каждое изменение = новая строка с updatedOn):
 *   usernames, firstNames, lastNames, phones.
 *
 * История нужна, чтобы видеть, что один и тот же telegram ID менял имя/ник/
 * телефон/дату рождения с течением времени.
 */
class ProfileManager {
    #historyTables = {
        username: { table: 'usernames', column: 'username' },
        firstName: { table: 'firstNames', column: 'firstName' },
        lastName: { table: 'lastNames', column: 'lastName' },
        phone: { table: 'phones', column: 'phone' },
    };

    constructor(dbPath = './data/profiles.db') {
        var absolutePath = path.resolve(dbPath);
        var dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new Database(absolutePath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('busy_timeout = 5000');
        this.createTables();
    }

    createTables() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS userProfiles (
                userId TEXT PRIMARY KEY,
                realName TEXT,
                gender TEXT,
                place TEXT,
                nationality TEXT,
                age INTEGER,
                trusted INTEGER DEFAULT 0,
                firstJoin TEXT,
                birthday TEXT,
                updatedOn TEXT
            );

            CREATE TABLE IF NOT EXISTS usernames (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                username TEXT,
                updatedOn TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS firstNames (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                firstName TEXT,
                updatedOn TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS lastNames (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                lastName TEXT,
                updatedOn TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS phones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                phone TEXT,
                updatedOn TEXT NOT NULL
            );
        `);

        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_usernames_userId ON usernames(userId);
            CREATE INDEX IF NOT EXISTS idx_firstNames_userId ON firstNames(userId);
            CREATE INDEX IF NOT EXISTS idx_lastNames_userId ON lastNames(userId);
            CREATE INDEX IF NOT EXISTS idx_phones_userId ON phones(userId);
        `);
    }

    #latestHistory(table, userId) {
        return this.db.prepare(
            `SELECT * FROM ${table} WHERE userId = ? ORDER BY id DESC LIMIT 1`
        ).get([userId]) || null;
    }

    #parseRuDate(str) {
        if (!str) return null;
        if (typeof str === 'number') return str;
        var m = String(str).match(/^(\d{2})\.(\d{2})\.(\d{4}),\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (!m) return null;
        return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]).getTime();
    }

    /**
     * Возвращает текущий профиль: снимок userProfiles + последние значения
     * каждого исторического поля.
     */
    getProfile(userId) {
        var main = this.db.prepare('SELECT * FROM userProfiles WHERE userId = ?').get([userId]) || null;
        if (!main) return null;

        var username = this.#latestHistory('usernames', userId);
        var firstName = this.#latestHistory('firstNames', userId);
        var lastName = this.#latestHistory('lastNames', userId);
        var phone = this.#latestHistory('phones', userId);

        return {
            userId,
            realName: main.realName ?? null,
            gender: main.gender ?? null,
            place: main.place ?? null,
            nationality: main.nationality ?? null,
            age: main.age ?? null,
            trusted: main.trusted ?? 0,
            firstJoin: main.firstJoin ?? null,
            birthday: main.birthday ?? null,
            updatedOn: main.updatedOn ?? null,
            username: username?.username ?? null,
            firstName: firstName?.firstName ?? null,
            lastName: lastName?.lastName ?? null,
            phone: phone?.phone ?? null,
        };
    }

    getAllProfiles() {
        return this.db.prepare('SELECT * FROM userProfiles').all();
    }

    /**
     * Обновляет ручной профиль.
     * Поля из userProfiles (realName, gender, place, nationality, age, trusted,
     * firstJoin, birthday) пишутся в снимок с updatedOn. Исторические поля
     * (username, firstName, lastName, phone) — если значение отличается от последнего,
     * пишется новая строка в соответствующую таблицу истории с updatedOn.
     * @param {string} userId
     * @param {Object} fields
     */
    upsertProfile(userId, fields) {
        var now = new Date().toLocaleString('ru-ru');
        var changed = false;

        // нормализуем даты к строковому формату ru-ru
        if (fields.firstJoin !== undefined && fields.firstJoin !== null) {
            fields.firstJoin = new Date(fields.firstJoin).toLocaleString('ru-ru');
        }
        if (fields.birthday !== undefined && fields.birthday !== null) {
            var bd = new Date(fields.birthday);
            bd.setHours(0, 0, 0, 0);
            fields.birthday = bd.toLocaleString('ru-ru');
        }

        // --- снимок userProfiles ---
        var mainFields = ['realName', 'gender', 'place', 'nationality', 'age', 'trusted', 'firstJoin', 'birthday'];
        var current = this.db.prepare('SELECT * FROM userProfiles WHERE userId = ?').get([userId]) || null;

        var merged = {};
        for (var k of mainFields) {
            merged[k] = fields[k] !== undefined ? fields[k] : (current?.[k] ?? null);
        }
        if (merged.trusted !== undefined) merged.trusted = merged.trusted ? 1 : 0;

        var mainChanged = !current || mainFields.some(k =>
            fields[k] !== undefined && (fields[k] ?? null) !== (current[k] ?? null)
        );

        if (mainChanged) {
            this.db.prepare(`
                INSERT INTO userProfiles
                    (userId, realName, gender, place, nationality, age, trusted, firstJoin, birthday, updatedOn)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(userId) DO UPDATE SET
                    realName = excluded.realName,
                    gender = excluded.gender,
                    place = excluded.place,
                    nationality = excluded.nationality,
                    age = excluded.age,
                    trusted = excluded.trusted,
                    firstJoin = excluded.firstJoin,
                    birthday = excluded.birthday,
                    updatedOn = excluded.updatedOn
            `).run([
                userId,
                merged.realName ?? null,
                merged.gender ?? null,
                merged.place ?? null,
                merged.nationality ?? null,
                merged.age ?? null,
                merged.trusted,
                merged.firstJoin ?? null,
                merged.birthday ?? null,
                now
            ]);
            changed = true;
        }

        // --- история (по каждому полю отдельная таблица) ---
        for (var fieldName in this.#historyTables) {
            if (fields[fieldName] === undefined) continue;
            var info = this.#historyTables[fieldName];
            var latest = this.#latestHistory(info.table, userId);
            var latestValue = latest ? latest[info.column] : null;
            if (fields[fieldName] !== latestValue) {
                this.db.prepare(
                    `INSERT INTO ${info.table} (userId, ${info.column}, updatedOn) VALUES (?, ?, ?)`
                ).run([userId, fields[fieldName], now]);
                changed = true;
            }
        }

        return { success: true, changed };
    }

    /**
     * Переносит ручные поля из резервной БД в автособираемую users.
     * @param {DBManager} dbManager
     */
    syncProfilesToUsers(dbManager) {
        var profiles = this.getAllProfiles();
        var synced = 0;
        for (var p of profiles) {
            var result = dbManager.updateUserManualData(p.userId, {
                realName: p.realName,
                age: p.age,
                place: p.place,
                nationality: p.nationality,
                trusted: p.trusted,
                firstJoin: this.#parseRuDate(p.firstJoin),
            });
            if (result.success) synced++;
        }
        return { success: true, synced };
    }

    close() {
        this.db.close();
    }
}

export default ProfileManager;
