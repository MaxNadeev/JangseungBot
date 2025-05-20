import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import AuthManager from '../managers/AuthManager.js';
import UserService from '../services/UserService.js';
import DBManager from '../managers/DBManager.js';
import AdminLogService from '../services/AdminLogService.js';
import MessageStatsService from '../services/MessageStatsService.js';
import GroupMembershipService from '../services/GroupMembershipService.js';

class Client {
    #client = null;
    #userService = null;

    constructor() {
        var apiId = parseInt(process.env.API_ID);
        var apiHash = process.env.API_HASH;
        var sessionString = process.env.CLIENT_SESSION || '';
        var groupId = process.env.GROUP_ID;

        this.#client = new TelegramClient(
            new StringSession(sessionString),
            apiId,
            apiHash,
            { connectionRetries: 5 }
        );

        var dbManager = new DBManager();
        this.#userService = new UserService(this.#client, dbManager);
    }

    async start() {
        var authManager = new AuthManager(this.#client);
        await authManager.authenticate();
        console.log('Client started successfully');
    }

    async getMembers(fromCache = true) {
        try {
            var members = await this.#userService.fetchMembers(process.env.GROUP_ID, fromCache);
            return members;
        } catch (error) {
            console.error('Error getting members:', error);
            return [];
        }
    }

    async getAdminLog(limit = 50, eventType = 'all') {
        try {
            var adminLogService = new AdminLogService(this.#client, process.env.GROUP_ID);
            var events = await adminLogService.fetchEvents(limit, eventType);
            return events;
        } catch (error) {
            console.error('Error getting admin log:', error);
            return [];
        }
    }

    async getUserMessageCount(userId) {
        try {
            var messageStatsService = new MessageStatsService(this.#client, process.env.GROUP_ID);
            var count = await messageStatsService.getUserMessageCount(userId);
            return count;
        } catch (error) {
            console.error('Error getting user message count:', error);
            return 0;
        }
    }

    async isUserMember(userId) {
        try {
            // Преобразуем ID в число и валидируем
            var numericUserId = Number(userId);
            if (isNaN(numericUserId) || numericUserId <= 0) {
                console.error('Invalid user ID format');
                return false;
            }

            var membershipService = new GroupMembershipService(
                this.#client, 
                process.env.GROUP_ID
            );
            
            var result = await membershipService.isUserInGroup(numericUserId);
            console.log(`User ${numericUserId} membership status: ${result}`);
            return result;
        } catch (error) {
            console.error('Error in isUserMember:', error);
            return false;
        }
    }
}

export default Client;