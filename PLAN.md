# План работ (v.1) — JangseungBot

> После аппрува: **Этап 0** выполняется сразу — план записывается в корень (`PLAN.md`), создаётся и заполняется `Version history.md`.

> **Статус:** ✅ Этапы 0–2 выполнены · 🔄 Этап 3 — следующий · ⏳ Этапы 4–10 — в очереди.

## Глоссарий

- **`banUser`** (существующая) — «лишение прав»: `ChatBannedRights({ sendMessages: true, untilDate: 0 })`. Используется для спама, молчунов, неактивных, бот-атаки, флуда. **Не исключает из группы.**
- **`kickUser`** (новая) — «убрать из группы»: `ChatBannedRights({ viewMessages: true })`. Используется для аккаунтов, удалённых/заблокированных самим Telegram.
- **«доверенный» (trusted)** — в белом списке; спам-проверка и автобаны его не касаются. Источник истины — резервная БД `profiles.db`.

## Процесс работы

1. Работа идёт по этапам; каждый этап заканчивается строкой коммита (в конце этапа).
2. После выполнения этапа я предлагаю коммит → ты проверяешь, пушишь в git и даёшь команду продолжать.
3. После пуша я дописываю запись `v.1.0.x` в `Version history.md` и перехожу к следующему этапу.

---

## ✅ Этап 0 — Базовые файлы (выполнено)

- Создать `PLAN.md` в корне с полным текстом этого плана.
- Создать `Version history.md` и заполнить ретроспективу `# v.0` + заголовок `# v.1` / `## v.1.0`.

**Коммит этапа 0:** `docs: PLAN.md и Version history.md (ретроспектива v.0)`

---

## ✅ Этап 1 — Команда /hi в личном чате админа (выполнено)

> **Итог:** ping-кнопку убрали — оставили только `/hi`. Работает и в супергруппе (для всех), и в личном чате админа (только от `ADMIN_ID`).

- `bot/core/Bot.js` — обработка `UpdateNewMessage` → `handlePrivateMessage`.
- `bot/core/EventHandler.js`:
  - `handlePrivateMessage` — личные сообщения только от админа; отправитель из `peerId.userId` (в личке `fromId = null`);
  - `handleHiCommand` — отвечает в личку, если сообщение из личного чата (`PeerUser`).
- Критерий: `/hi` работает из супергруппы для всех и из лички админа.

**Коммит этапа 1:** `feat: команда /hi в личном чате админа`

---

## ✅ Этап 2 — Схема БД + резервная profiles.db (выполнено)

> **Итог:** реализовано и проверено. `users` — `firstJoin` INTEGER, `trusted`, таблица `userFlags`. `profiles.db` — `userProfiles` (realName/gender/place/nationality/age/trusted + `firstJoin` TEXT + `birthday` TEXT + `updatedOn` TEXT `toLocaleString('ru-ru')`) и таблицы истории `usernames`/`firstNames`/`lastNames`/`phones`. Backfill из `users.db` выполнен (528/760/244/24). `birthday` — с `setHours(0,0,0,0)`. ⚠️ Перед запуском удалить старую `data/users.db`.

> **Коррекция после уточнения:** часть полей уже есть — `firstJoin` уже в `users` (сейчас TEXT, не заполняется). Новых колонок нужно только две по сути: `trusted` и `inactiveReported`; `lastMessageAt` **не нужен** (правило молчунов считаем через `firstJoin` + `msgCount == 0`). БД ты удалишь и создашь заново, поэтому меняем `CREATE TABLE` напрямую, миграция не нужна; `INSERT OR REPLACE` оставляем.

Файлы: `bot/utils/sqlQueries.js`, `bot/managers/DBManager.js`, новый `bot/managers/ProfileManager.js`.

**2.1. Обновлённая схема `users.db` (автособираемая, можно удалять):**
```sql
CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    username TEXT, firstName TEXT, lastName TEXT,
    realName TEXT, phone TEXT,
    isBot INTEGER, isPremium INTEGER,
    age INTEGER,
    place INTEGER,           -- FK places
    nationality INTEGER,     -- FK nationalities
    msgCount INTEGER,
    firstJoin INTEGER,       -- epoch ms: дата входа в группу (было TEXT)
    updatedOn TEXT,
    isInGroup INTEGER,
    trusted INTEGER DEFAULT 0,   -- материализуется из profiles.db
    FOREIGN KEY (place) REFERENCES places(placeId),
    FOREIGN KEY (nationality) REFERENCES nationalities(nationalityId)
);

CREATE TABLE IF NOT EXISTS userFlags (
    userId TEXT PRIMARY KEY,
    inactiveReported INTEGER,     -- epoch ms времени последнего уведомления админу о неактивном
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);
```
- `userFlags` — отдельная таблица, чтобы `INSERT OR REPLACE` в `users` при скане не затирал `inactiveReported`.
- Обновить `INSERT_USER` и `upsertUser` под новые колонки (`firstJoin` как INTEGER, `trusted`).

**2.2. Резервная БД `data/profiles.db` (ручные данные, НЕ удаляется):**
```sql
CREATE TABLE IF NOT EXISTS userProfiles (
    userId TEXT PRIMARY KEY,
    realName TEXT,
    dateOfBirth TEXT,       -- 'YYYY-MM-DD'
    gender TEXT,            -- 'male'|'female'|NULL
    place TEXT,             -- название
    nationality TEXT,       -- название
    age INTEGER,
    trusted INTEGER DEFAULT 0,
    updatedOn INTEGER       -- epoch ms последнего изменения
);

CREATE TABLE IF NOT EXISTS userProfileHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    realName TEXT, dateOfBirth TEXT, gender TEXT,
    place TEXT, nationality TEXT, age INTEGER, trusted INTEGER,
    changedAt INTEGER NOT NULL    -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_history_userId ON userProfileHistory(userId);
```
- Смысл: тот же `userId`, но имя/ник/дата рождения/пол/место меняются → **новая строка** в `userProfileHistory` с `changedAt`; текущий снимок — в `userProfiles` с `updatedOn`. Это и есть «понимаем, что это один и тот же человек, хотя данные разные».

**2.3. `ProfileManager` (новый):**
- Открывает `data/profiles.db` (отдельный файл).
- `upsertProfile(userId, fields)` — если значения отличаются от текущего снимка → пишем строку в `userProfileHistory` + обновляем `userProfiles`.
- `getProfile(userId)`.
- `syncProfilesToUsers(dbManager)` — после пересоздания/скана `users`: для каждой записи `userProfiles` обновить `users` (`realName`, `age`, `place`, `nationality`, `trusted`), маппя имена места/национальности на `placeId`/`nationalityId`.

**2.4. `DBManager`:** `journal_mode = WAL`, `busy_timeout = 5000`; новые методы `setTrusted`, `getSilentJoiners`, `getDormantUsers`, `setInactiveReported`.

**2.5. `upsertUser` не затирает `trusted`:** перед `INSERT OR REPLACE` прочитать текущий `trusted` (и/или `firstJoin`) и подставить, если не пришли во входных данных.

**Критерий:** БД пересоздаётся с новой схемой; `profiles.db` создаётся; синк восстанавливает ручные поля и `trusted`; история пишется при изменении данных.

**Коммит этапа 2:** `feat(db): схема users (firstJoin/trusted) + резервная profiles.db с историей`

---

## 🔄 Этап 3 — Инкрементальный подсчёт сообщений + корректная обработка входов (следующий)

Файлы: `bot/core/EventHandler.js`, `bot/core/Bot.js`, `index.js`.

- **Инкремент ПОСЛЕ проверки** — считаем только сохранённые (не удалённые) сообщения:
  - команда (`/hi`) → считаем;
  - свои сообщения бота (`message.out`) → считаем, но не проверяем на спам;
  - пустые/медиа и ответы на приветствие (`!message.message` / `message.replyTo`) → считаем, не проверяем;
  - админ → считаем, пропускаем проверку;
  - сообщение прошло проверку (`!hasProblem`) → считаем;
  - триггер (сообщение удаляется) → **не считаем**.
- Переработать входы:
  - `MessageActionChatJoinedByRequest` / `MessageActionChatJoinedByLink` → `handleUserJoined(fromId.userId, message.date)`;
  - `MessageActionChatAddUser` → `handleUserJoined` для каждого `message.action.users` (был баг: брался `fromId` = админ).
- Новый `handleUserJoined(userId, joinDate)`: `db.setUserJoined(userId, epochMs)` + `profileManager.upsertProfile(userId, { firstJoin: epochMs })` (backup) → `sayHello(userId)`.
- Пробросить `profileManager` в `Bot`/`EventHandler` (`index.js` → `Bot` → `EventHandler`).
- Поправить `sayHello`: в ветке «уже в БД» читать `dbResult.user.*` вместо `apiResult.user.*`.

**Критерий:** `msgCount` растёт только у сохранённых сообщений (удалённые не засчитываются); приветствие адресовано вошедшему; `firstJoin` пишется в `users` (epoch ms) и в `profiles` (строка).

**Коммит этапа 3:** `feat: инкрементальный подсчёт сообщений и корректная обработка входов`

---

## ⏳ Этап 4 — Белый список (доверенные)

Файлы: `bot/core/EventHandler.js`, `bot/services/ServiceBot.js`, `bot/managers/ProfileManager.js`.

- Реализовать `else if (action === 'allow')`: `profileManager.upsertProfile(userId, { trusted: 1 })` + `db.setTrusted(userId, 1)` + `sendMessage(adminId, 'Пользователь <id> добавлен в белый список')`.
- В `ServiceBot.getUserFromDB` добавить `trusted: Boolean(rawData.trusted)` в возвращаемый `user`.
- В `handleNewMessage` пропускать спам-проверку: `if (userData.user.adminRights || userData.user.trusted) return;`.
- Критерий: после «Доверять» сообщения пользователя не проверяются/не удаляются; он исключён из правил этапов 5 и 8.

**Коммит этапа 4:** `feat: белый список (доверенные) через кнопку "Доверять"`

---

## ⏳ Этап 5 — Автобан «молчащих» новичков (лишение прав)

Файлы: `bot/utils/Scheduler.js` (реализовать заглушку), новый `bot/services/SilentJoinerService.js`, `bot/core/Bot.js`.

- `Scheduler`: `addTask(name, cb, intervalMs)`, `stopTask`, `setInterval`.
- `SilentJoinerService`: порог `SILENT_JOIN_THRESHOLD_MIN` (по умолчанию `5`), флаг `SILENT_JOIN_BAN_ENABLED` (по умолчанию `true`); каждые 30–60 сек (guard `isRunning`):
  ```sql
  SELECT u.userId FROM users u
  LEFT JOIN restricted r ON u.userId = r.userId
  LEFT JOIN admins a ON u.userId = a.userId
  WHERE u.firstJoin IS NOT NULL AND u.firstJoin <= ?
    AND COALESCE(u.msgCount,0) = 0
    AND COALESCE(u.isInGroup,0) = 1 AND COALESCE(u.isBot,0) = 0
    AND COALESCE(u.trusted,0) = 0
    AND a.userId IS NULL
    AND (r.userId IS NULL OR COALESCE(r.isBanned,0) = 0)
  ```
  (порог = `Date.now() - SILENT_JOIN_THRESHOLD_MIN*60000`; «не написал первое сообщение» = `msgCount == 0` от `firstJoin`).
- Для каждого: `banUser` (**лишение прав**, НЕ кик) → `db.upsertRestricted({ isBanned:1, isKicked:0, restrictedBy: ADMIN_ID, ... })` → уведомление `ADMIN_ID`.
- Запуск задачи в `Bot.start()`.
- Критерий: молчун через N минут получает ограничение; админ и доверенный — не трогаются; написавший — не трогается.

**Коммит этапа 5:** `feat: автобан молчащих новичков (ограничение прав)`

---

## ⏳ Этап 6 — `--client`: кик удалённых аккаунтов и заполнение `firstJoin`

Файлы: `bot/services/ServiceClient.js`, `bot/services/ServiceBot.js` (`kickUser`), `index.js`.

- `ServiceBot.kickUser(chatId, userId)` — `channels.EditBanned` с `ChatBannedRights({ viewMessages: true, untilDate: now+60 })`.
- В `getRecentParticipants`/`getAllParticipants` детектить `user.deleted === true` → `kickUser` + лог.
- Читать `result.participants`, записывать `firstJoin = participant.date * 1000` (epoch ms) в `users`.
- (Опция) `getAllParticipants()` с пагинацией через `ChannelParticipantsSearch({q:''})`, чтобы покрывать всех, а не только 300 «recent».
- Критерий: `node index.js --client` кикает удалённые аккаунты и заполняет `firstJoin`.

**Коммит этапа 6:** `feat(client): кик удалённых аккаунтов и запись firstJoin`

---

## ⏳ Этап 7 — Пересчёт по расписанию и по кнопке

Файлы: новый `bot/services/ReconcileService.js`, `bot/core/Bot.js`, `bot/core/EventHandler.js`, `.env.example`.

- `ReconcileService.recount(client, db, groupId)` — дедуплицированный проход: участники в `Map` (флаги banned/kicked/admin + права), `messages.Search` (`count`) для каждого уникального **один раз**, запись разом. Оптимизации: `getInputEntity(groupId)` один раз; access-hash из `result.users`; `floodSleepThreshold`; ловить `FloodWaitError` → ждать → повтор.
- `recountWithUserSession(db, groupId)` — `TelegramClient(StringSession(CLIENT_SESSION))`; если `!checkAuthorization()` → `{success:false, error:'нет сессии клиента'}`; иначе recount + `disconnect`; guard `isRecountRunning`, try/catch.
- После recount вызвать `profileManager.syncProfilesToUsers(db)` (восстановить ручные поля/trusted).
- Расписание: задача в `Scheduler`, интервал `RECOUNT_INTERVAL_HOURS` (по умолчанию `24`).
- Кнопка: `/recount` (только `ADMIN_ID`) → inline-кнопка «▶️ Запустить пересчёт» (`data: 'recount_start'`) → «Пересчёт запущён…» → результат «N пользователей, X сек» (или ошибка).
- `--client` остаётся для первичной заливки на деплое; счёт дальше ведёт бот, пересчёт корректирует (в т.ч. расхождения из-за удалённых сообщений).
- Критерий: пересчёт по кнопке и по расписанию; не роняет бота; корректирует `msgCount` после удалений.

**Коммит этапа 7:** `feat: пересчёт сообщений по расписанию и по кнопке`

---

## ⏳ Этап 8 — Неактивные «старожилы»: предложение админу (батчами)

Файлы: `data/triggers.json` (+ `Inspector.loadTriggers`), `bot/utils/Scheduler.js`, `bot/core/Bot.js`.

- В `triggers.json → additionalRules` добавить `"inactiveDays": 365`, `"inactiveMaxMessages": 1`, `"inactiveBatchSize": 10`; загрузить в `Inspector`.
- Ежедневная задача: `db.getDormantUsers(inactiveDays, inactiveMaxMessages, limit = inactiveBatchSize)` — `firstJoin <= now - inactiveDays*86400000 AND msgCount <= inactiveMaxMessages AND isInGroup=1 AND isBot=0 AND trusted=0 AND не админ AND не забанен AND inactiveReported IS NULL`; отсортировать по `firstJoin` (старейшие раньше), взять не более `inactiveBatchSize`.
- Отправить админу **ОДНО** сообщение со списком (не более N строк) и inline-кнопками «Ограничить N» (`data: 'ban_<userId>'`), по одной кнопке на пользователя — чтобы не заваливать админа десятками сообщений.
- Для каждого отправленного → `db.setInactiveReported(userId, now)`, чтобы в следующем проходе взялся следующий батч.
- Кнопки повторно используют callback `ban` → `banUser` (лишение прав).
- Критерий: за один проход админ получает максимум `inactiveBatchSize` записей одним сообщением; следующие проходы (раз в сутки) выдают следующие батчи, пока не разгребёт; один и тот же пользователь повторно не шлётся. (Опционально: повторное уведомление, если админ не отреагировал за K дней — настраиваемая «протухшая» метка `inactiveReported`.)

**Коммит этапа 8:** `feat: предложение админу ограничивать неактивных "старожилов" (батчами)`

---

## ⏳ Этап 9 — Отложенные сообщения (автоудаление)

Файл: `bot/core/EventHandler.js` (+ `ServiceBot.deleteMessage`).

- При `UpdateNewChannelMessage` (ветка `Message`) проверять отправителя:
  - если `fromId` есть, но пользователь **не в группе** (`db.getUser(userId).isInGroup == 0` или `isUserInGroup() === false`), а сообщение доставлено → это отложенное сообщение от ушедшего аккаунта → `deleteMessage` + отчёт админу;
  - если в сообщении есть прямой признак «отложенное» (маркер) → тоже удалять. **Нужен пример/маркер от тебя.**
- Критерий: отложенное сообщение от не-участника удаляется автоматически; обычные сообщения участников не трогаются.

**Коммит этапа 9:** `feat: автоудаление отложенных сообщений`

---

## ⏳ Этап 10 — Спам-атака через ботов (ждёт паттерн)

- **Нужен от тебя** пример сообщения (текст/структура), чтобы вписать точное правило.
- Ожидаемое поведение: при обнаружении паттерна — `banUser` отправителя и превентивно `banUser` всех ботов, вызванных в сообщении (лишение прав, не кик), + отчёт админу.

**Коммит этапа 10:** `feat: детект спам-атаки через ботов` (уточнится после паттерна)

---

## Отложено (в этот план не входит)

- **Борьба с флудом:** N сообщений в секунду (порог в `triggers.json`, напр. 20) → автоматический `banUser` + отчёт админу. (следующая итерация)
- **Реклама от полезных ботов:** убирать только рекламные сообщения полезных ботов, не трогая самих ботов. (на подумать — возможно, не делать)
- isInGroup поле базы данных users показывает неверные значения. Это поле должно показывать есть участник в группе, или нет, а там много лишних, это значит, что при апдейте данных не проверяется или некорректно проверяется

## Краевые случаи и отказы

- Молчун пишет на 4:59 → `msgCount` становится >0 до проверки → бан не сработает.
- Повторный вход: `firstJoin` перезаписывается, `msgCount` сохраняется → вернувшийся со старым `msgCount>0` не попадёт под молчунов (приемлемо: правило нацелено на новых спам-аккаунтов).
- Существующие «молчуны» (вступили до деплоя): `firstJoin IS NULL` → не трогаются.
- Удаление сообщений инкремент не видит → `msgCount` завышается до ближайшего пересчёта (этап 7).
- Гонка пересчёта и инкремента → расхождение ≤1, следующая корректировка сойдётся.
- Нет `CLIENT_SESSION` → кнопка/расписание отвечают «нет сессии клиента», бот живёт.
- `INSERT OR REPLACE` скана: не затирает `trusted` (п.2.5) и не трогает `userFlags.inactiveReported` (отдельная таблица).
- Двойные баны/уведомления → исключены флагами в SQL (`trusted`, `isBanned`, `inactiveReported`) и guard `isRunning`.
- Ложный бан обратим админом; пороги — в env/`triggers.json`.

## Тестирование и приёмка (по этапам)

- Э1: кнопка «ты тут?» → «я тут».
- Э2: БД пересоздаётся с новой схемой; `profiles.db` создаётся; синк восстанавливает ручные поля/`trusted`; история пишется при изменении.
- Э3: 2–3 сообщения → `msgCount` растёт сразу (в т.ч. приветствие бота); приветствие адресовано вошедшему.
- Э4: «Доверять» → сообщения не проверяются.
- Э5: `SILENT_JOIN_THRESHOLD_MIN=1` → молчун ограничен через ~1 мин; админ/доверенный/написавший не тронуты.
- Э6: `--client` кикает `user.deleted` и заполняет `firstJoin`.
- Э7: `/recount` завершается отчётом; удалил сообщение → пересчёт уменьшил `msgCount`.
- Э8: при тестовых `inactiveDays`/`inactiveMaxMessages` админ получает максимум `inactiveBatchSize` записей одним сообщением; следующие проходы выдают следующие батчи; повторного уведомления нет.
- Э9: отложенное сообщение от не-участника удалено.

## Допущения

- `GROUP_ID` — супергруппа; бот — админ и видит все сообщения (иначе инкремент невозможен).
- «бан/блокировка» = лишение прав (`banUser`), «убрать из группы» = кик (`kickUser`).
- Пересчёт использует юзер-сессию (`CLIENT_SESSION`) — у неё полный доступ к истории и access-hash.
- `firstJoin` хранится как epoch ms (INTEGER); ручные поля и `trusted` живут в `profiles.db` и синхронизируются в `users`.
- Ручной ввод DOB/пола/места админом (UI/команды) — отдельный будущий этап; здесь только схема и синк.
