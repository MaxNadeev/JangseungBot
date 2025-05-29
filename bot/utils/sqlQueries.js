export var SQL = {
    INSERT_USER: `
        INSERT OR REPLACE INTO users (
            id, username, firstName, lastName, phone, 
            isBot, isPremium
        ) VALUES (
            ?, ?, ?, ?, ?, 
            ?, ?
        )
    `,
    
    INSERT_RIGHTS: `
        INSERT OR REPLACE INTO rights (
            userId, viewMessages, sendMessages, sendMedia, sendStickers,
            sendGifs, sendGames, sendInline, embedLinks, sendPolls,
            changeInfo, inviteUsers, pinMessages, manageTopics, sendPhotos,
            sendVideos, sendRoundvideos, sendAudios, sendVoices, sendDocs,
            sendPlain, untilDate
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?
        )
    `,
    
    UPDATE_USER_STATS: `
        UPDATE users SET
            msgCount = ?,
            isBanned = ?,
            warnFlag = ?,
            inGroup = ?
        WHERE id = ?
    `,
    
    GET_USERS_FROM_DB: `
        SELECT u.*, r.* 
        FROM users u
        LEFT JOIN rights r ON u.id = r.userId
    `,
    
    UPDATE_LAST_UPDATED: `
        INSERT OR REPLACE INTO lastUpdated (id, lastUpdateTime) 
        VALUES (1, ?)
    `,
    
    GET_LAST_UPDATED: `
        SELECT lastUpdateTime FROM lastUpdated LIMIT 1
    `,
    
    GET_USER_RIGHTS: `
        SELECT * FROM rights WHERE userId = ?
    `,
    
    DELETE_USER: `
        DELETE FROM users WHERE id = ?
    `,

    UPDATE_USER_STATUS: `
        UPDATE users SET
            inGroup = ?,
            isBanned = ?
        WHERE id = ?
    `,
};