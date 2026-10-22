export var SQL = {
    CREATE_PLACES_TABLE: `
        CREATE TABLE IF NOT EXISTS places (
            placeId INTEGER PRIMARY KEY AUTOINCREMENT,
            placeName TEXT NOT NULL UNIQUE
        )
    `,
    
    CREATE_NATIONALITIES_TABLE: `
        CREATE TABLE IF NOT EXISTS nationalities (
            nationalityId INTEGER PRIMARY KEY AUTOINCREMENT,
            nationality TEXT NOT NULL UNIQUE
        )
    `,
    
    CREATE_USERS_TABLE: `
        CREATE TABLE IF NOT EXISTS users (
            userId TEXT PRIMARY KEY,
            username TEXT,
            firstName TEXT,
            lastName TEXT,
            realName TEXT,
            phone TEXT,
            isBot INTEGER,
            isPremium INTEGER,
            age INTEGER,
            place INTEGER,
            nationality INTEGER,
            msgCount INTEGER,
            firstJoin TEXT,
            updatedOn TEXT,
            isInGroup INTEGER,
            trusted INTEGER DEFAULT 0,
            FOREIGN KEY (place) REFERENCES places(placeId),
            FOREIGN KEY (nationality) REFERENCES nationalities(nationalityId)
        )
    `,

    CREATE_USER_FLAGS_TABLE: `
        CREATE TABLE IF NOT EXISTS userFlags (
            userId TEXT PRIMARY KEY,
            inactiveReported INTEGER,
            FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
        )
    `,

    CREATE_RESTRICTED_TABLE: `
        CREATE TABLE IF NOT EXISTS restricted (
            userId TEXT PRIMARY KEY,
            isBanned INTEGER,
            isKicked INTEGER,
            restrictedBy TEXT,
            restrictionDate TEXT,
            untilDate TEXT,
            updatedOn TEXT,
            FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
            FOREIGN KEY (restrictedBy) REFERENCES users(userId)
        )
    `,
    
    CREATE_ADMINS_TABLE: `
        CREATE TABLE IF NOT EXISTS admins (
            userId TEXT PRIMARY KEY,
            isCreator INTEGER,
            updatedOn TEXT,
            FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
        )
    `,
    
    CREATE_ADMIN_RIGHTS_TABLE: `
        CREATE TABLE IF NOT EXISTS adminRights (
            userId TEXT PRIMARY KEY,
            changeInfo INTEGER,
            postMessages INTEGER,
            editMessages INTEGER,
            deleteMessages INTEGER,
            banUsers INTEGER,
            inviteUsers INTEGER,
            pinMessages INTEGER,
            addAdmins INTEGER,
            canAnonymous INTEGER,
            manageCall INTEGER,
            other INTEGER,
            manageTopics INTEGER,
            FOREIGN KEY (userId) REFERENCES admins(userId) ON DELETE CASCADE
        )
    `,
    
    CREATE_RESTRICTED_RIGHTS_TABLE: `
        CREATE TABLE IF NOT EXISTS restrictedRights (
            userId TEXT PRIMARY KEY,
            viewMessages INTEGER,
            sendMessages INTEGER,
            sendMedia INTEGER,
            sendStickers INTEGER,
            sendGifs INTEGER,
            sendGames INTEGER,
            sendInline INTEGER,
            embedLinks INTEGER,
            sendPolls INTEGER,
            changeInfo INTEGER,
            inviteUsers INTEGER,
            pinMessages INTEGER,
            manageTopics INTEGER,
            sendPhotos INTEGER,
            sendVideos INTEGER,
            sendRoundvideos INTEGER,
            sendAudios INTEGER,
            sendVoices INTEGER,
            sendDocs INTEGER,
            sendPlain INTEGER,
            FOREIGN KEY (userId) REFERENCES restricted(userId) ON DELETE CASCADE
        )
    `,
    
    CREATE_LAST_UPDATED_TABLE: `
        CREATE TABLE IF NOT EXISTS lastUpdated (
            tableName TEXT PRIMARY KEY,
            updatedOn TEXT,
            tableHash TEXT
        )
    `,
    
    CREATE_INDEX_USERS_USERNAME: `
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
    `,
    
    CREATE_INDEX_USERS_INGROUP: `
        CREATE INDEX IF NOT EXISTS idx_users_inGroup ON users(isInGroup)
    `,
    
    CREATE_INDEX_USERS_PLACE: `
        CREATE INDEX IF NOT EXISTS idx_users_place ON users(place)
    `,
    
    CREATE_INDEX_USERS_NATIONALITY: `
        CREATE INDEX IF NOT EXISTS idx_users_nationality ON users(nationality)
    `,
    
    CREATE_INDEX_RESTRICTED_USERID: `
        CREATE INDEX IF NOT EXISTS idx_restricted_userId ON restricted(userId)
    `,
    
    CREATE_INDEX_RESTRICTED_BANNED: `
        CREATE INDEX IF NOT EXISTS idx_restricted_isBanned ON restricted(isBanned)
    `,
    
    CREATE_INDEX_RESTRICTED_KICKED: `
        CREATE INDEX IF NOT EXISTS idx_restricted_isKicked ON restricted(isKicked)
    `,
    
    CREATE_INDEX_ADMINS_USERID: `
        CREATE INDEX IF NOT EXISTS idx_admins_userId ON admins(userId)
    `,
    
    CREATE_INDEX_ADMINS_CREATOR: `
        CREATE INDEX IF NOT EXISTS idx_admins_isCreator ON admins(isCreator)
    `,
    
    INSERT_USER: `
        INSERT OR REPLACE INTO users (
            userId, username, firstName, lastName, realName, phone, 
            isBot, isPremium, age, place, nationality,
            msgCount, firstJoin, updatedOn, isInGroup, trusted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    
    INSERT_PLACE: `
        INSERT OR IGNORE INTO places (placeName) VALUES (?)
    `,
    
    INSERT_NATIONALITY: `
        INSERT OR IGNORE INTO nationalities (nationality) VALUES (?)
    `,
    
    GET_PLACE_ID: `
        SELECT placeId FROM places WHERE placeName = ?
    `,
    
    GET_NATIONALITY_ID: `
        SELECT nationalityId FROM nationalities WHERE nationality = ?
    `,
    
    INSERT_RESTRICTED: `
        INSERT OR REPLACE INTO restricted (
            userId, isBanned, isKicked, restrictedBy, restrictionDate, untilDate, updatedOn
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    
    INSERT_RESTRICTED_RIGHTS: `
        INSERT OR REPLACE INTO restrictedRights (
            userId, viewMessages, sendMessages, sendMedia, sendStickers,
            sendGifs, sendGames, sendInline, embedLinks, sendPolls,
            changeInfo, inviteUsers, pinMessages, manageTopics, sendPhotos,
            sendVideos, sendRoundvideos, sendAudios, sendVoices, sendDocs,
            sendPlain
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    
    INSERT_ADMIN: `
        INSERT OR REPLACE INTO admins (
            userId, isCreator, updatedOn
        ) VALUES (?, ?, ?)
    `,
    
    INSERT_ADMIN_RIGHTS: `
        INSERT OR REPLACE INTO adminRights (
            userId, changeInfo, postMessages, editMessages, deleteMessages,
            banUsers, inviteUsers, pinMessages, addAdmins, canAnonymous,
            manageCall, other, manageTopics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    
    UPDATE_USER_STATS: `
        UPDATE users SET
            msgCount = ?,
            isInGroup = ?
        WHERE userId = ?
    `,

    SET_TRUSTED: `
        UPDATE users SET trusted = ? WHERE userId = ?
    `,

    SET_USER_JOINED: `
        UPDATE users SET firstJoin = ?, isInGroup = 1, updatedOn = ? WHERE userId = ?
    `,

    INSERT_USER_JOINED: `
        INSERT INTO users (userId, firstJoin, isInGroup, updatedOn) VALUES (?, ?, 1, ?)
    `,

    INCREMENT_USER_MSG: `
        UPDATE users SET msgCount = COALESCE(msgCount, 0) + 1, isInGroup = 1, updatedOn = ? WHERE userId = ?
    `,

    INSERT_USER_MINIMAL: `
        INSERT INTO users (userId, msgCount, isInGroup, updatedOn) VALUES (?, 1, 1, ?)
    `,

    SET_INACTIVE_REPORTED: `
        INSERT OR REPLACE INTO userFlags (userId, inactiveReported) VALUES (?, ?)
    `,

    CLEAR_RESTRICTION: `
        UPDATE restricted SET isBanned = 0, isKicked = 0, updatedOn = ? WHERE userId = ?
    `,

    SET_USER_KICKED: `
        UPDATE users SET isInGroup = 0, updatedOn = ? WHERE userId = ?
    `,

    GET_SILENT_JOINERS: `
        SELECT u.userId FROM users u
        LEFT JOIN restricted r ON u.userId = r.userId
        LEFT JOIN admins a ON u.userId = a.userId
        WHERE u.firstJoin IS NOT NULL AND u.firstJoin <= ? AND u.firstJoin >= ?
            AND COALESCE(u.msgCount, 0) = 0
            AND COALESCE(u.isInGroup, 0) = 1
            AND COALESCE(u.isBot, 0) = 0
            AND COALESCE(u.trusted, 0) = 0
            AND a.userId IS NULL
            AND (r.userId IS NULL OR COALESCE(r.isBanned, 0) = 0)
    `,

    GET_DORMANT_USERS: `
        SELECT u.userId FROM users u
        LEFT JOIN restricted r ON u.userId = r.userId
        LEFT JOIN admins a ON u.userId = a.userId
        LEFT JOIN userFlags f ON u.userId = f.userId
        WHERE u.firstJoin IS NOT NULL AND u.firstJoin <= ?
            AND COALESCE(u.msgCount, 0) <= ?
            AND COALESCE(u.isInGroup, 0) = 1
            AND COALESCE(u.isBot, 0) = 0
            AND COALESCE(u.trusted, 0) = 0
            AND a.userId IS NULL
            AND (r.userId IS NULL OR COALESCE(r.isBanned, 0) = 0)
            AND (f.userId IS NULL OR f.inactiveReported IS NULL)
        ORDER BY u.firstJoin ASC
        LIMIT ?
    `,

    UPDATE_USER_MANUAL_DATA: `
        UPDATE users SET realName = ?, age = ?, place = ?, nationality = ?, trusted = ?, firstJoin = ? WHERE userId = ?
    `,
    
    GET_USER_DATA: `
        SELECT 
            u.*,
            p.placeName,
            n.nationality,
            r.isBanned, r.isKicked, r.restrictedBy, r.restrictionDate, r.untilDate,
            rr.viewMessages, rr.sendMessages, rr.sendMedia, rr.sendStickers, rr.sendGifs,
            rr.sendGames, rr.sendInline, rr.embedLinks, rr.sendPolls, rr.changeInfo,
            rr.inviteUsers, rr.pinMessages, rr.manageTopics, rr.sendPhotos, rr.sendVideos,
            rr.sendRoundvideos, rr.sendAudios, rr.sendVoices, rr.sendDocs, rr.sendPlain,
            a.isCreator, a.updatedOn,
            ar.changeInfo AS adminChangeInfo, ar.postMessages, ar.editMessages, ar.deleteMessages,
            ar.banUsers, ar.inviteUsers, ar.pinMessages AS adminPinMessages, ar.addAdmins, ar.canAnonymous,
            ar.manageCall, ar.other, ar.manageTopics AS adminManageTopics
        FROM users u
        LEFT JOIN places p ON u.place = p.placeId
        LEFT JOIN nationalities n ON u.nationality = n.nationalityId
        LEFT JOIN restricted r ON u.userId = r.userId
        LEFT JOIN restrictedRights rr ON r.userId = rr.userId
        LEFT JOIN admins a ON u.userId = a.userId
        LEFT JOIN adminRights ar ON a.userId = ar.userId
        WHERE u.userId = ?
    `,
    
    UPDATE_LAST_UPDATED: `
        INSERT OR REPLACE INTO lastUpdated (tableName, updatedOn, tableHash) 
        VALUES (?, ?, ?)
    `,
    
    GET_LAST_UPDATED: `
        SELECT * FROM lastUpdated WHERE tableName = ?
    `,
    
    DELETE_USER: `
        DELETE FROM users WHERE userId = ?
    `
};