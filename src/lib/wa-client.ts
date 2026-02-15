import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    WASocket,
    ConnectionState,
    Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { EventEmitter } from 'events';
import { useRedisAuthState, clearRedisAuthState } from './baileys-redis-auth';
import { redis } from './redis';

const logger = pino({ level: 'silent' });
const MAX_PROFILES_PER_USER = 10;
const SESSION_PREFIX = 'wa:sess:';

export class WAClient extends EventEmitter {
    private socket: WASocket | null = null;
    private connectionStatus: 'disconnected' | 'connecting' | 'qr' | 'pairing' | 'connected' = 'disconnected';
    private currentQR: string | null = null;
    private pairingCode: string | null = null;
    private phoneNumber: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private isPairingMode = false;
    public readonly profileId: string;
    public readonly userId: string;
    private redisPrefix: string;

    constructor(userId: string, profileId: string) {
        super();
        this.setMaxListeners(30);
        this.userId = userId;
        this.profileId = profileId;
        // Key: wa:sess:USER_ID:profile-ID:
        this.redisPrefix = `${SESSION_PREFIX}${userId}:profile-${profileId}:`;
    }

    getStatus() {
        return {
            userId: this.userId,
            profileId: this.profileId,
            status: this.connectionStatus,
            qr: this.currentQR,
            pairingCode: this.pairingCode,
            phoneNumber: this.phoneNumber,
        };
    }

    getSocket(): WASocket | null {
        return this.socket;
    }

    isConnected(): boolean {
        return this.connectionStatus === 'connected' && this.socket !== null;
    }

    async connect(): Promise<void> {
        if (this.connectionStatus === 'connected') {
            return;
        }

        this.connectionStatus = 'connecting';
        this.isPairingMode = false;
        this.emit('status', this.getStatus());

        try {
            const { state, saveCreds } = await useRedisAuthState(redis, this.redisPrefix);
            const { version } = await fetchLatestBaileysVersion();

            this.socket = makeWASocket({
                version,
                auth: state,
                logger,
                browser: Browsers.ubuntu('Chrome'),
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                connectTimeoutMs: 60000,
            });

            this.socket.ev.on('creds.update', saveCreds);
            this.setupConnectionListener();

            // Register as active session
            await redis.sadd('wa:active_sessions', `${this.userId}:${this.profileId}`);
        } catch (error) {
            console.error(`[WA-${this.userId}-${this.profileId}] Connection error:`, error);
            this.connectionStatus = 'disconnected';
            this.emit('status', this.getStatus());
            throw error;
        }
    }

    async connectWithCode(phone: string): Promise<string> {
        if (this.connectionStatus === 'connected') {
            return '';
        }

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        if (!cleanPhone || cleanPhone.length < 10) {
            throw new Error('Invalid phone number. Example: 628123456789');
        }

        if (this.socket) {
            try {
                this.socket.ev.removeAllListeners('connection.update');
                this.socket.ev.removeAllListeners('creds.update');
                this.socket.end(undefined);
            } catch { /* ignore */ }
            this.socket = null;
        }

        this.connectionStatus = 'connecting';
        this.pairingCode = null;
        this.isPairingMode = true;
        this.emit('status', this.getStatus());

        try {
            await clearRedisAuthState(redis, this.redisPrefix);

            const { state, saveCreds } = await useRedisAuthState(redis, this.redisPrefix);
            const { version } = await fetchLatestBaileysVersion();

            const sock = makeWASocket({
                version,
                auth: state,
                logger,
                browser: Browsers.ubuntu('Chrome'),
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                connectTimeoutMs: 60000,
            });

            this.socket = sock;
            sock.ev.on('creds.update', saveCreds);

            // Register as active session
            await redis.sadd('wa:active_sessions', `${this.userId}:${this.profileId}`);

            const code = await new Promise<string>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout: WhatsApp server tidak merespon dalam 20 detik'));
                }, 20000);

                let codeRequested = false;

                sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
                    const { connection, lastDisconnect, qr } = update;

                    console.log(`[WA-${this.userId}-${this.profileId}] connection.update:`, {
                        connection, hasQr: !!qr, codeRequested,
                    });

                    if (qr && !codeRequested) {
                        codeRequested = true;
                        try {
                            console.log(`[WA-${this.userId}-${this.profileId}] Requesting pairing code for:`, cleanPhone);
                            const pCode = await sock.requestPairingCode(cleanPhone);
                            clearTimeout(timeout);

                            this.pairingCode = pCode;
                            this.connectionStatus = 'pairing';
                            this.emit('pairing-code', pCode);
                            this.emit('status', this.getStatus());
                            console.log(`[WA-${this.userId}-${this.profileId}] ✅ Code:`, pCode);
                            resolve(pCode);
                        } catch (err) {
                            clearTimeout(timeout);
                            reject(err);
                        }
                    }

                    if (connection === 'open') {
                        clearTimeout(timeout);
                        this.connectionStatus = 'connected';
                        this.currentQR = null;
                        this.pairingCode = null;
                        this.reconnectAttempts = 0;
                        this.isPairingMode = false;
                        this.phoneNumber = sock.user?.id?.split(':')[0] || null;
                        this.emit('status', this.getStatus());
                        this.emit('connected');
                        console.log(`[WA-${this.userId}-${this.profileId}] ✅ Connected as:`, this.phoneNumber);
                    }

                    if (connection === 'close' && codeRequested) {
                        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                        console.log(`[WA-${this.userId}-${this.profileId}] Connection closed after code sent, status:`, statusCode);

                        if (statusCode !== DisconnectReason.loggedOut) {
                            console.log(`[WA-${this.userId}-${this.profileId}] Reconnecting with new credentials...`);
                            this.isPairingMode = false;
                            setTimeout(() => this.connect(), 2000);
                        }
                    }

                    if (connection === 'close' && !codeRequested) {
                        clearTimeout(timeout);
                        reject(new Error('Connection closed before pairing code could be generated'));
                    }
                });
            });

            return code;
        } catch (error) {
            console.error(`[WA-${this.userId}-${this.profileId}] Error:`, error);
            this.connectionStatus = 'disconnected';
            this.pairingCode = null;
            this.isPairingMode = false;
            this.emit('status', this.getStatus());
            throw error;
        }
    }

    private setupConnectionListener() {
        if (!this.socket) return;

        this.socket.ev.on('connection.update', (update: Partial<ConnectionState>) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && !this.isPairingMode) {
                this.currentQR = qr;
                this.connectionStatus = 'qr';
                this.emit('qr', qr);
                this.emit('status', this.getStatus());
            }

            if (connection === 'close') {
                this.currentQR = null;
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const error = lastDisconnect?.error;

                console.error(`[WA-${this.userId}-${this.profileId}] ❌ Disconnected! Status: ${statusCode}`, error);

                if (this.isPairingMode) return;

                if (statusCode === DisconnectReason.loggedOut) {
                    this.connectionStatus = 'disconnected';
                    this.phoneNumber = null;
                    this.socket = null;
                    this.reconnectAttempts = 0;
                    this.emit('status', this.getStatus());
                    this.emit('logged-out');
                    redis.srem('wa:active_sessions', `${this.userId}:${this.profileId}`);
                    clearRedisAuthState(redis, this.redisPrefix);
                } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    this.connectionStatus = 'connecting';
                    this.emit('status', this.getStatus());
                    setTimeout(() => this.connect(), 3000);
                } else {
                    this.connectionStatus = 'disconnected';
                    this.emit('status', this.getStatus());
                }
            }

            if (connection === 'open') {
                this.connectionStatus = 'connected';
                this.currentQR = null;
                this.pairingCode = null;
                this.reconnectAttempts = 0;
                this.isPairingMode = false;
                this.phoneNumber = this.socket?.user?.id?.split(':')[0] || null;
                this.emit('status', this.getStatus());
                this.emit('connected');
                console.log(`[WA-${this.userId}-${this.profileId}] Connected as:`, this.phoneNumber);
            }
        });
    }

    async cancelConnection(): Promise<void> {
        if (this.socket) {
            try {
                this.socket.ev.removeAllListeners('connection.update');
                this.socket.ev.removeAllListeners('creds.update');
                this.socket.end(undefined);
            } catch { /* ignore */ }
            this.socket = null;
        }
        await clearRedisAuthState(redis, this.redisPrefix);
        await redis.srem('wa:active_sessions', `${this.userId}:${this.profileId}`);

        this.connectionStatus = 'disconnected';
        this.currentQR = null;
        this.pairingCode = null;
        this.phoneNumber = null;
        this.reconnectAttempts = 0;
        this.isPairingMode = false;
        this.emit('status', this.getStatus());
    }

    async disconnect(): Promise<void> {
        if (this.socket) {
            try {
                await this.socket.logout();
            } catch {
                try { this.socket.end(undefined); } catch { /* ignore */ }
            }
            this.socket = null;
        }

        this.connectionStatus = 'disconnected';
        this.currentQR = null;
        this.pairingCode = null;
        this.phoneNumber = null;
        this.reconnectAttempts = 0;
        this.isPairingMode = false;
        this.emit('status', this.getStatus());
    }
}

// ============================================================
// WAClientManager — manages clients for multiple users
// ============================================================

class WAClientManager {
    // Key: "userId:profileId"
    private clients: Map<string, WAClient> = new Map();

    getClient(userId: string, profileId: string): WAClient | null {
        return this.clients.get(`${userId}:${profileId}`) || null;
    }

    getOrCreateClient(userId: string, profileId: string): WAClient {
        const key = `${userId}:${profileId}`;
        let client = this.clients.get(key);

        if (!client) {
            // Check count for this specific user
            const userProfileCount = [...this.clients.entries()]
                .filter(([k]) => k.startsWith(`${userId}:`)).length;

            if (userProfileCount >= MAX_PROFILES_PER_USER) {
                throw new Error(`Maximum ${MAX_PROFILES_PER_USER} profiles allowed for this user`);
            }

            client = new WAClient(userId, profileId);
            this.clients.set(key, client);
        }
        return client;
    }

    // Get all statuses for a specific user
    getUserStatuses(userId: string): Array<ReturnType<WAClient['getStatus']>> {
        const statuses: Array<ReturnType<WAClient['getStatus']>> = [];

        // Get key-values for this user
        const userEntries = [...this.clients.entries()]
            .filter(([k]) => k.startsWith(`${userId}:`))
            .sort((a, b) => {
                const [, pA] = a[0].split(':');
                const [, pB] = b[0].split(':');
                return parseInt(pA) - parseInt(pB);
            });

        if (userEntries.length === 0) {
            return [{ userId, profileId: '1', status: 'disconnected', qr: null, pairingCode: null, phoneNumber: null }];
        }

        for (const [, client] of userEntries) {
            statuses.push(client.getStatus());
        }

        return statuses;
    }

    async removeClient(userId: string, profileId: string): Promise<void> {
        const key = `${userId}:${profileId}`;
        const client = this.clients.get(key);
        if (client) {
            await client.disconnect();
            this.clients.delete(key);
        }
    }

    // Auto-connect profiles that have saved sessions in Redis
    async autoReconnect(): Promise<void> {
        try {
            // Get all active sessions from Redis Set
            const activeSessions = await redis.smembers('wa:active_sessions');

            console.log(`[WAManager] Found ${activeSessions.length} active sessions to reconnect`);

            for (const sessionKey of activeSessions) {
                // key is "userId:profileId"
                const [userId, profileId] = sessionKey.split(':');
                if (!userId || !profileId) continue;

                console.log(`[WAManager] Auto-reconnecting User ${userId} Profile ${profileId}...`);
                try {
                    const client = this.getOrCreateClient(userId, profileId);
                    // Check if creds exist
                    const credsKey = `${SESSION_PREFIX}${userId}:profile-${profileId}:creds`;
                    const hasCreds = await redis.exists(credsKey);

                    if (hasCreds) {
                        await client.connect();
                    } else {
                        // Cleanup invalid session
                        await redis.srem('wa:active_sessions', sessionKey);
                    }
                } catch (err) {
                    console.error(`[WAManager] Failed to reconnect User ${userId} Profile ${profileId}:`, err);
                }
            }
        } catch (error) {
            console.error('[WAManager] Auto-reconnect failed:', error);
        }
    }
}

// Singleton manager
const globalForWA = globalThis as unknown as { waManager: WAClientManager | undefined };
export const waManager = globalForWA.waManager ?? new WAClientManager();
if (process.env.NODE_ENV !== 'production') globalForWA.waManager = waManager;

// Auto-reconnect saved sessions on startup
waManager.autoReconnect().catch(console.error);
