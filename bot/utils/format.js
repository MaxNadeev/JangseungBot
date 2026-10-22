/**
 * Собирает читаемое имя пользователя для отчётов админу:
 * «Имя Фамилия (@nick)», «@nick» или «ID: <id>».
 * @param {string} userId
 * @param {Object|null} u - объект пользователя (username/firstName/lastName)
 * @returns {string}
 */
export function buildDisplayName(userId, u) {
    var name = [u?.firstName, u?.lastName].filter(Boolean).join(' ');
    var username = u?.username ? String(u.username).replace(/^@/, '') : null;
    if (username) {
        return name ? `${name} (@${username})` : `@${username}`;
    }
    return name || `ID: ${userId}`;
}
