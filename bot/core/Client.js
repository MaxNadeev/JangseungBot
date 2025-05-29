import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import AuthManager from '../managers/AuthManager.js';
import UserService from '../services/UserService.js';
import AdminLogService from '../services/AdminLogService.js';

class Client {
    #client = null;
    #userService = null;

    constructor(dbManager) {
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

        this.#userService = new UserService(this.#client, dbManager, groupId);
    }

    async start() {
        var authManager = new AuthManager(this.#client);
        await authManager.authenticate();
        console.log('Client started successfully');
    }

    async getRecentParticipants(limit = 200) {
        try {
            var participants = await this.#userService.getRecentParticipants(limit);
            console.log(`Found ${participants.length} recent participants`);
            return participants;
        } catch (error) {
            console.error('Error getting recent participants:', error);
            return [];
        }
    }

    async getBannedParticipants(limit = 200) {
        try {
            var bannedUsers = await this.#userService.getBannedParticipants(limit);
            console.log(`Found ${bannedUsers.length} banned participants`);
            return bannedUsers;
        } catch (error) {
            console.error('Error getting banned participants:', error);
            return [];
        }
    }

    async getKickedParticipants(limit = 200) {
        try {
            var kickedUsers = await this.#userService.getKickedParticipants(limit);
            console.log(`Found ${kickedUsers.length} kicked participants`);
            return kickedUsers;
        } catch (error) {
            console.error('Error getting kicked participants:', error);
            return [];
        }
    }

    async getChatAdmins(limit = 100) {
        try {
            var admins = await this.#userService.getChatAdmins(limit);
            console.log(`Found ${admins.length} chat admins`);
            return admins;
        } catch (error) {
            console.error('Error getting chat admins:', error);
            return [];
        }
    }

    async getChatCreator() {
        try {
            var creator = await this.#userService.getChatCreator();
            if (creator) {
                console.log('Chat creator found:', creator.username || creator.id);
            }
            return creator;
        } catch (error) {
            console.error('Error getting chat creator:', error);
            return null;
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
            var count = await this.#userService.getUserMessageCount(userId);
            console.log(`User ${userId} has ${count} messages`);
            return count;
        } catch (error) {
            console.error('Error in getUserMessageCount:', error);
            return 0;
        }
    }

    async isUserMember(userId) {
        try {
            var isMember = await this.#userService.isUserInGroup(userId);
            console.log(isMember ? 'User is member' : 'User not member');
            return isMember;
        } catch (error) {
            console.error('Error checking user membership:', error);
            return false;
        }
    }
}

export default Client;