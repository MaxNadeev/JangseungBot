import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { SQL } from '../utils/sqlQueries.js';

class DBManager {
    constructor(dbPath) {
        if (!dbPath) {
            throw new Error('Database path is required');
        }
        
        var absolutePath = path.resolve(dbPath);
        
        var dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        this.dbPath = absolutePath;
        this.db = new Database(absolutePath, {
            fileMustExist: false
        });
        this.db.pragma('foreign_keys = ON');
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('busy_timeout = 5000');
    }

    async init() {
        try {
            var needsInit = !this.isDatabaseInitialized();
            
            if (needsInit) {
                console.log('Initializing new database...');
                await this.createTables();
                console.log('Database initialized successfully');
            } else {
                console.log('Database already exists, skipping initialization');
            }
            
            return { success: true, initialized: needsInit };
        } catch (error) {
            console.error('Database initialization failed:', error);
            return { success: false, error: error.message };
        }
    }

    isDatabaseInitialized() {
        try {
            var result = this.db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='users'
            `).get();
            
            return !!result;
        } catch (error) {
            return false;
        }
    }

    async createTables() {
        try {
            this.db.exec('BEGIN TRANSACTION');
            
            this.db.prepare(SQL.CREATE_PLACES_TABLE).run();
            this.db.prepare(SQL.CREATE_NATIONALITIES_TABLE).run();
            this.db.prepare(SQL.CREATE_USERS_TABLE).run();
            this.db.prepare(SQL.CREATE_USER_FLAGS_TABLE).run();
            this.db.prepare(SQL.CREATE_RESTRICTED_TABLE).run();
            this.db.prepare(SQL.CREATE_ADMINS_TABLE).run();
            this.db.prepare(SQL.CREATE_ADMIN_RIGHTS_TABLE).run();
            this.db.prepare(SQL.CREATE_RESTRICTED_RIGHTS_TABLE).run();
            this.db.prepare(SQL.CREATE_LAST_UPDATED_TABLE).run();
            
            //indexes
            this.db.prepare(SQL.CREATE_INDEX_USERS_USERNAME).run();
            this.db.prepare(SQL.CREATE_INDEX_USERS_INGROUP).run();
            this.db.prepare(SQL.CREATE_INDEX_USERS_PLACE).run();
            this.db.prepare(SQL.CREATE_INDEX_USERS_NATIONALITY).run();
            this.db.prepare(SQL.CREATE_INDEX_RESTRICTED_USERID).run();
            this.db.prepare(SQL.CREATE_INDEX_RESTRICTED_BANNED).run();
            this.db.prepare(SQL.CREATE_INDEX_RESTRICTED_KICKED).run();
            this.db.prepare(SQL.CREATE_INDEX_ADMINS_USERID).run();
            this.db.prepare(SQL.CREATE_INDEX_ADMINS_CREATOR).run();
            
            this.db.exec('COMMIT');
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
    }

    async upsertRestricted(restrictedData) {
        try {
            var stmt = this.db.prepare(SQL.INSERT_RESTRICTED);
            var result = stmt.run([
                restrictedData.userId,
                restrictedData.isBanned ? 1 : 0,
                restrictedData.isKicked ? 1 : 0,
                restrictedData.restrictedBy,
                restrictedData.restrictionDate,
                restrictedData.untilDate,
                new Date().toLocaleString('ru-ru'),
            ]);
            return { success: true, changes: result.changes };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async upsertRestrictedRights(rightsData) {
        try {
            var stmt = this.db.prepare(SQL.INSERT_RESTRICTED_RIGHTS);
            var result = stmt.run([
                rightsData.userId,
                rightsData.viewMessages ? 1 : 0,
                rightsData.sendMessages ? 1 : 0,
                rightsData.sendMedia ? 1 : 0,
                rightsData.sendStickers ? 1 : 0,
                rightsData.sendGifs ? 1 : 0,
                rightsData.sendGames ? 1 : 0,
                rightsData.sendInline ? 1 : 0,
                rightsData.embedLinks ? 1 : 0,
                rightsData.sendPolls ? 1 : 0,
                rightsData.changeInfo ? 1 : 0,
                rightsData.inviteUsers ? 1 : 0,
                rightsData.pinMessages ? 1 : 0,
                rightsData.manageTopics ? 1 : 0,
                rightsData.sendPhotos ? 1 : 0,
                rightsData.sendVideos ? 1 : 0,
                rightsData.sendRoundvideos ? 1 : 0,
                rightsData.sendAudios ? 1 : 0,
                rightsData.sendVoices ? 1 : 0,
                rightsData.sendDocs ? 1 : 0,
                rightsData.sendPlain ? 1 : 0
            ]);
            return { success: true, changes: result.changes };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async upsertAdmin(adminData) {
        try {
            var stmt = this.db.prepare(SQL.INSERT_ADMIN);
            var result = stmt.run([
                adminData.userId,
                adminData.isCreator ? 1 : 0,
                adminData.updatedOn
            ]);
            return { success: true, changes: result.changes };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async upsertAdminRights(rightsData) {
        try {
            var stmt = this.db.prepare(SQL.INSERT_ADMIN_RIGHTS);
            var result = stmt.run([
                rightsData.userId,
                rightsData.changeInfo ? 1 : 0,
                rightsData.postMessages ? 1 : 0,
                rightsData.editMessages ? 1 : 0,
                rightsData.deleteMessages ? 1 : 0,
                rightsData.banUsers ? 1 : 0,
                rightsData.inviteUsers ? 1 : 0,
                rightsData.pinMessages ? 1 : 0,
                rightsData.addAdmins ? 1 : 0,
                rightsData.anonymous ? 1 : 0,
                rightsData.manageCall ? 1 : 0,
                rightsData.other ? 1 : 0,
                rightsData.manageTopics ? 1 : 0
            ]);
            return { success: true, changes: result.changes };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async upsertUser(userData) {
        try {
            this.db.exec('BEGIN TRANSACTION');
            

            if (userData.place) {
                this.db.prepare(SQL.INSERT_PLACE).run([userData.place]);
                var placeId = this.db.prepare(SQL.GET_PLACE_ID).get([userData.place]).placeId;
            }
            

            if (userData.nationality) {
                this.db.prepare(SQL.INSERT_NATIONALITY).run([userData.nationality]);
                var nationalityId = this.db.prepare(SQL.GET_NATIONALITY_ID).get([userData.nationality]).nationalityId;
            }
            

            // Сохраняем trusted и firstJoin, если они не переданы явно (чтобы INSERT OR REPLACE не затирал)
            var existingUser = this.db.prepare('SELECT trusted, firstJoin FROM users WHERE userId = ?').get([userData.id]);
            if (userData.trusted === undefined) userData.trusted = existingUser?.trusted ?? 0;
            if (userData.firstJoin === undefined || userData.firstJoin === null) {
                userData.firstJoin = existingUser?.firstJoin ?? null;
            }

            var userStmt = this.db.prepare(SQL.INSERT_USER);
            userStmt.run([
                userData.id,
                userData.username,
                userData.firstName,
                userData.lastName,
                userData.realName || null,
                userData.phone || null,
                userData.isBot ? 1 : 0,
                userData.isPremium ? 1 : 0,
                userData.age || null,
                placeId || null,
                nationalityId || null,
                userData.msgCount === 0 ? 0 : userData.msgCount || null,
                userData.firstJoin ?? null,
                userData.updatedOn,
                userData.isInGroup,
                userData.trusted ? 1 : 0
            ]);

            
            if (userData.isAdmin) {
                var adminStmt = this.db.prepare(SQL.INSERT_ADMIN);
                adminStmt.run([
                    userData.id,
                    userData.isCreator ? 1 : 0,
                    userData.updatedOn
                ]);
                
                if (userData.adminRights) {
                    var adminRightsStmt = this.db.prepare(SQL.INSERT_ADMIN_RIGHTS);
                    adminRightsStmt.run([
                        userData.id,
                        userData.adminRights.changeInfo ? 1 : 0,
                        userData.adminRights.postMessages ? 1 : 0,
                        userData.adminRights.editMessages ? 1 : 0,
                        userData.adminRights.deleteMessages ? 1 : 0,
                        userData.adminRights.banUsers ? 1 : 0,
                        userData.adminRights.inviteUsers ? 1 : 0,
                        userData.adminRights.pinMessages ? 1 : 0,
                        userData.adminRights.addAdmins ? 1 : 0,
                        userData.adminRights.anonymous ? 1 : 0,
                        userData.adminRights.manageCall ? 1 : 0,
                        userData.adminRights.other ? 1 : 0,
                        userData.adminRights.manageTopics ? 1 : 0
                    ]);
                }
            }
            

            if (userData.isBanned || userData.isKicked) {
                var restrictedStmt = this.db.prepare(SQL.INSERT_RESTRICTED);
                restrictedStmt.run([
                    userData.id,
                    userData.isBanned ? 1 : 0,
                    userData.isKicked ? 1 : 0,
                    userData.restrictedBy || null,
                    new Date(+userData.restrictionDate).toLocaleString('ru-ru') || new Date().toLocaleString('ru-ru'),
                    new Date(+userData.untilDate).toLocaleString('ru-ru') || null,
                    userData.updatedOn,
                ]);
                
                if (userData.restrictedRights) {
                    var restrictedRightsStmt = this.db.prepare(SQL.INSERT_RESTRICTED_RIGHTS);
                    restrictedRightsStmt.run([
                        userData.id,
                        userData.restrictedRights.viewMessages ? 1 : 0,
                        userData.restrictedRights.sendMessages ? 1 : 0,
                        userData.restrictedRights.sendMedia ? 1 : 0,
                        userData.restrictedRights.sendStickers ? 1 : 0,
                        userData.restrictedRights.sendGifs ? 1 : 0,
                        userData.restrictedRights.sendGames ? 1 : 0,
                        userData.restrictedRights.sendInline ? 1 : 0,
                        userData.restrictedRights.embedLinks ? 1 : 0,
                        userData.restrictedRights.sendPolls ? 1 : 0,
                        userData.restrictedRights.changeInfo ? 1 : 0,
                        userData.restrictedRights.inviteUsers ? 1 : 0,
                        userData.restrictedRights.pinMessages ? 1 : 0,
                        userData.restrictedRights.manageTopics ? 1 : 0,
                        userData.restrictedRights.sendPhotos ? 1 : 0,
                        userData.restrictedRights.sendVideos ? 1 : 0,
                        userData.restrictedRights.sendRoundvideos ? 1 : 0,
                        userData.restrictedRights.sendAudios ? 1 : 0,
                        userData.restrictedRights.sendVoices ? 1 : 0,
                        userData.restrictedRights.sendDocs ? 1 : 0,
                        userData.restrictedRights.sendPlain ? 1 : 0
                    ]);
                }
            }
            
            this.db.exec('COMMIT');
            return { success: true };
        } catch (error) {
            this.db.exec('ROLLBACK');
            console.error('Error in upsertUser:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Метод получения пользователя по ID из БД
     * @param {string | number} userId  
     * @returns {object} 
     */
    async getUser(userId) {
        try {
            var stmt = this.db.prepare(SQL.GET_USER_DATA);
            var result = stmt.get([userId.toString()]);
            return { success: true, data: result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }


    async updateUserStats(userId, stats) {
        try {
            var stmt = this.db.prepare(SQL.UPDATE_USER_STATS);
            var result = stmt.run([
                stats.msgCount || 0,
                stats.isInGroup ? 1 : 0,
                userId
            ]);
            return { success: true, changes: result.changes };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    setTrusted(userId, trusted = 1) {
        this.db.prepare(SQL.SET_TRUSTED).run([trusted ? 1 : 0, userId]);
        return { success: true };
    }

    setUserJoined(userId, firstJoin = Date.now()) {
        var updatedOn = new Date().toLocaleString('ru-ru');
        var result = this.db.prepare(SQL.SET_USER_JOINED).run([firstJoin, updatedOn, userId]);
        if (result.changes === 0) {
            this.db.prepare(SQL.INSERT_USER_JOINED).run([userId, firstJoin, updatedOn]);
        }
        return { success: true };
    }

    incrementUserMessage(userId) {
        var updatedOn = new Date().toLocaleString('ru-ru');
        var result = this.db.prepare(SQL.INCREMENT_USER_MSG).run([updatedOn, userId]);
        if (result.changes === 0) {
            this.db.prepare(SQL.INSERT_USER_MINIMAL).run([userId, updatedOn]);
        }
        return { success: true };
    }

    setInactiveReported(userId, reportedAt = Date.now()) {
        this.db.prepare(SQL.SET_INACTIVE_REPORTED).run([userId, reportedAt]);
        return { success: true };
    }

    getSilentJoiners(cutoffMs) {
        var rows = this.db.prepare(SQL.GET_SILENT_JOINERS).all([cutoffMs]);
        return rows.map(row => row.userId);
    }

    getDormantUsers(cutoffMs, maxMessages, limit) {
        var rows = this.db.prepare(SQL.GET_DORMANT_USERS).all([cutoffMs, maxMessages, limit]);
        return rows.map(row => row.userId);
    }

    updateUserManualData(userId, data) {
        var placeId = null;
        if (data.place) {
            this.db.prepare(SQL.INSERT_PLACE).run([data.place]);
            placeId = this.db.prepare(SQL.GET_PLACE_ID).get([data.place]).placeId;
        }
        var nationalityId = null;
        if (data.nationality) {
            this.db.prepare(SQL.INSERT_NATIONALITY).run([data.nationality]);
            nationalityId = this.db.prepare(SQL.GET_NATIONALITY_ID).get([data.nationality]).nationalityId;
        }
        this.db.prepare(SQL.UPDATE_USER_MANUAL_DATA).run([
            data.realName ?? null,
            data.age ?? null,
            placeId,
            nationalityId,
            data.trusted ? 1 : 0,
            data.firstJoin ?? null,
            userId
        ]);
        return { success: true };
    }

    async updateLastUpdated(tableName) {
        try {
            var stmt = this.db.prepare(SQL.UPDATE_LAST_UPDATED);
            var result = stmt.run([
                tableName,
                new Date().toLocaleString('ru-ru'),
                Math.random().toString(36).substring(2)
            ]);
            return { success: true, changes: result.changes };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getLastUpdated(tableName) {
        try {
            var stmt = this.db.prepare(SQL.GET_LAST_UPDATED);
            var result = stmt.get([tableName]);
            return { success: true, lastUpdated: result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    close() {
        this.db.close();
    }
}

export default DBManager;