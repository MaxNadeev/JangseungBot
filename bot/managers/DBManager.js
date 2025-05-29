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
        console.log('Database path:', absolutePath);
        
        var dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        this.dbPath = absolutePath;
        this.db = new Database(absolutePath, {
            fileMustExist: false
        });
        this.db.pragma('foreign_keys = ON');
    }

    async init() {
        try {
            var needsInit = !this.#isDatabaseInitialized();
            
            if (needsInit) {
                console.log('Initializing new database...');
                await this.#createDatabase();
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

    #isDatabaseInitialized() {
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

    async #createDatabase() {
        try {
            var initScriptPath = path.join(process.cwd(), 'data', 'init.sql');
            var sqlScript = fs.readFileSync(initScriptPath, 'utf8');
            
            this.db.exec('BEGIN TRANSACTION');
            
            var queries = sqlScript.split(';').filter(q => q.trim());
            
            queries.forEach(query => {
                if (query.trim()) {
                    this.db.prepare(query).run();
                }
            });
            
            this.db.exec('COMMIT');
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
    }

    async upsertUsers(users) {
        try {
            if (!Array.isArray(users)) {
                users = [users];
            }

            var tableExists = this.db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='users'
            `).get();
            
            if (!tableExists) {
                throw new Error('Table users does not exist');
            }
            
            this.db.exec('BEGIN TRANSACTION');
            var userStmt = this.db.prepare(SQL.INSERT_USER);
            
            for (var user of users) {
                userStmt.run([
                    user.id,
                    user.username,
                    user.firstName,
                    user.lastName,
                    user.phone,
                    user.isBot ? 1 : 0,
                    user.isPremium ? 1 : 0
                ]);
            }
            
            this.db.exec('COMMIT');
            return { success: true, count: users.length };
        } catch (error) {
            this.db.exec('ROLLBACK');
            console.error('Error in upsertUsers:', error);
            return { success: false, error: error.message };
        }
    }

    async getUsersFromDB(userId = null) {
        try {
            var query = SQL.GET_USERS_FROM_DB;
            var params = [];
            
            if (userId) {
                query += ' WHERE u.id = ?';
                params.push(String(userId));
            }

            var stmt = this.db.prepare(query);
            var result = userId ? stmt.get(...params) : stmt.all(...params);
            
            return { 
                success: true, 
                users: userId ? (result ? [result] : []) : result 
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateUserRights(userId, rights) {
        try {
            var stmt = this.db.prepare(SQL.INSERT_RIGHTS);
            var result = stmt.run([
                userId,
                rights.viewMessages,
                rights.sendMessages,
                rights.sendMedia,
                rights.sendStickers,
                rights.sendGifs,
                rights.sendGames,
                rights.sendInline,
                rights.embedLinks,
                rights.sendPolls,
                rights.changeInfo,
                rights.inviteUsers,
                rights.pinMessages,
                rights.manageTopics,
                rights.sendPhotos,
                rights.sendVideos,
                rights.sendRoundvideos,
                rights.sendAudios,
                rights.sendVoices,
                rights.sendDocs,
                rights.sendPlain,
                rights.untilDate
            ]);
            
            return { success: true, changes: result.changes };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateUserStats(userId, stats) {
        try {
            var stmt = this.db.prepare(SQL.UPDATE_USER_STATS);
            var result = stmt.run([
                stats.msgCount,
                stats.isBanned,
                stats.warnFlag,
                stats.inGroup,
                userId
            ]);
            
            return { success: true, changes: result.changes };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateLastUpdated() {
        try {
            var stmt = this.db.prepare(SQL.UPDATE_LAST_UPDATED);
            var result = stmt.run(Math.floor(Date.now() / 1000));
            return { success: true, changes: result.changes };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getLastUpdated() {
        try {
            var stmt = this.db.prepare(SQL.GET_LAST_UPDATED);
            var result = stmt.get();
            return { success: true, timestamp: result?.lastUpdateTime };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateUserStatus(userId, status) {
        try {
            var stmt = this.db.prepare(SQL.UPDATE_USER_STATUS);
            var result = stmt.run([
                status.inGroup ? 1 : 0,
                status.isBanned ? 1 : 0,
                userId
            ]);
            
            return { success: true, changes: result.changes };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    close() {
        this.db.close();
    }
}

export default DBManager;