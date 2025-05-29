PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT,
    firstName       TEXT,
    lastName        TEXT,
    phone           TEXT,
    isBot           INTEGER,
    isPremium       INTEGER,
    msgCount        INTEGER,
    firstJoin       INTEGER,
    inGroup         INTEGER,
    isBanned        INTEGER,
    warnFlag        INTEGER
);

CREATE TABLE IF NOT EXISTS rights (
    userId          TEXT PRIMARY KEY,
    viewMessages    INTEGER,
    sendMessages    INTEGER,
    sendMedia       INTEGER,
    sendStickers    INTEGER,
    sendGifs        INTEGER,
    sendGames       INTEGER,
    sendInline      INTEGER,
    embedLinks      INTEGER,
    sendPolls       INTEGER,
    changeInfo      INTEGER,
    inviteUsers     INTEGER,
    pinMessages     INTEGER,
    manageTopics    INTEGER,
    sendPhotos      INTEGER,
    sendVideos      INTEGER,
    sendRoundvideos INTEGER,
    sendAudios      INTEGER,
    sendVoices      INTEGER,
    sendDocs        INTEGER,
    sendPlain       INTEGER,
    untilDate       INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lastUpdated (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    lastUpdateTime  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_isBanned ON users(isBanned);
CREATE INDEX IF NOT EXISTS idx_rights_userId ON rights(userId);

INSERT OR IGNORE INTO lastUpdated (lastUpdateTime) VALUES 
    (strftime('%s', 'now'));