import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import AuthManager from '../managers/AuthManager.js';
import ServiceClient from '../services/ServiceClient.js';
import AdminLogService from '../services/AdminLogService.js';

class Client {
    #client = null;
    #ServiceClient = null;

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

        this.#ServiceClient = new ServiceClient(this.#client, dbManager, groupId);
    }

    async start() {
        var authManager = new AuthManager(this.#client);
        await authManager.authenticate();
        console.log('Client started successfully');
    }

    async getRecentParticipants(limit = 300) {
        try {
            var participants = await this.#ServiceClient.getRecentParticipants(limit);
            console.log(`Found ${participants.length} recent participants`);
            return participants;
        } catch (error) {
            console.error('Error getting recent participants:', error);
            return [];
        }
    }


    /** 
    ** ### Получить пользователей с ограничениями (по умолчанию banned и 300 лимит)
        var bannedUsers = await client.getRestrictedParticipants();

    ** ### Получить выгнанных пользователей (300 лимит)
        var kickedUsers = await client.getRestrictedParticipants('kicked');

    ** ### Получить с другим лимитом
        var bannedUsers = await client.getRestrictedParticipants('banned', 200);
    */
    async getRestrictedParticipants(filterType = 'banned', limit = 300) {
        try {
            var restrictedUsers = await this.#ServiceClient.getRestrictedParticipants(filterType, limit);
            console.log(`Found ${filterType} participants: `, restrictedUsers.length);
            return restrictedUsers;
        } catch (error) {
            console.error(`Error getting ${filterType} participants:`, error);
            return [];
        }
    }

    /** 
    ** ### Получить всех админов включая создателя
        var allAdmins = await client.getChatAdmins();

    ** ### Получить только обычных админов (без создателя)
        var regularAdmins = await client.getChatAdmins(false);

    ** ### Получить создателя чата (первый элемент массива)
        var creator = (await client.getChatAdmins(true, 1))[0];
    */
    async getChatAdmins(includeCreator = true, limit = 30) {
        try {
            var admins = await this.#ServiceClient.getChatAdmins(includeCreator = true, limit = 30);
            console.log('Found admins: ', admins.length);
            return admins;
        } catch (error) {
            console.error('Error getting chat admins:', error);
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
            var count = await this.#ServiceClient.getUserMessageCount(userId);
            console.log(`User ${userId} has ${count} messages`);
            return count;
        } catch (error) {
            console.error('Error in getUserMessageCount:', error);
            return 0;
        }
    }

    async isUserMember(userId) {
        try {
            var isMember = await this.#ServiceClient.isUserInGroup(userId);
            console.log(isMember ? 'User is member' : 'User not member');
            return isMember;
        } catch (error) {
            console.error('Error checking user membership:', error);
            return false;
        }
    }

    async stop() {
        await this.#client.disconnect();
        console.log('Client stopped');
    }
}

export default Client;