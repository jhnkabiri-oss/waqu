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
// import { useSupabaseAuthState, clearSupabaseAuthState } from './baileys-supabase-auth';
// import { supabaseAdmin } from './supabase-admin';

const logger = pino({ level: 'silent' });
const MAX_PROFILES_PER_USER = 10;
const SESSION_PREFIX = 'wa:sess:';

export class WAClient extends EventEmitter {
    private socket: WASocket | null = null;
    public connectionStatus: 'disconnected' | 'connecting' | 'qr' | 'pairing' | 'connected' = 'disconnected';
    private currentQR: string | null = null;
    private pairingCode: string | null = null;
    private phoneNumber: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private isPairingMode = false;
    public readonly profileId: string;
    public readonly userId: string;
    private sessionPrefix: string;
    // Cache for groups
    public groupCache: Map<string, any> = new Map();

    constructor(userId: string, profileId: string) {
        super();
        this.setMaxListeners(30);
        this.userId = userId;
        this.profileId = profileId;
        // Key: wa:sess:USER_ID:profile-ID:
        this.sessionPrefix = `${SESSION_PREFIX}${userId}:profile-${profileId}:`;
    }

    getStatus() {
        return {
            userId: this.userId,
            profileId: this.profileId,
            status: this.connectionStatus,
            qr: this.currentQR,
            pairingCode: this.pairingCode,
            phoneNumber: this.phoneNumber,
            groupsCount: this.groupCache.size // Expose count
        };
    }

    getSocket(): WASocket | null {
        return this.socket;
    }

    isConnected(): boolean {
        return this.connectionStatus === 'connected' && this.socket !== null;
    }

    async connect(): Promise<void> {
        if (this.connectionStatus === 'connected' && this.socket) {
            return;
        }

        // Check if we are already connecting to avoid multiple attempts
        if (this.connectionStatus === 'connecting' && this.socket) {
            return;
        }

        this.connectionStatus = 'connecting';
        this.isPairingMode = false;
        this.emit('status', this.getStatus());

        try {
            const { state, saveCreds } = await useRedisAuthState(this.sessionPrefix);
            const { version } = await fetchLatestBaileysVersion();

            this.socket = makeWASocket({
                version,
                auth: state,
                logger,
                browser: Browsers.ubuntu('Chrome'),
                generateHighQualityLinkPreview: true,
                syncFullHistory: true, // Enable full history to ensure groups are synced
                connectTimeoutMs: 60000,
            });

            this.socket.ev.on('creds.update', saveCreds);
            this.setupConnectionListener();

            // Group Listeners
            this.socket.ev.on('groups.upsert', (newGroups) => {
                console.log(`[WA-${this.userId}-${this.profileId}] Groups upsert: ${newGroups.length}`);
                newGroups.forEach(g => {
                    if (g.id) {
                        this.groupCache.set(g.id, { ...this.groupCache.get(g.id), ...g });
                    }
                });
            });

            this.socket.ev.on('groups.update', (updatedGroups) => {
                console.log(`[WA-${this.userId}-${this.profileId}] Groups update: ${updatedGroups.length}`);
                updatedGroups.forEach(g => {
                    if (g.id && this.groupCache.has(g.id)) {
                        this.groupCache.set(g.id, { ...this.groupCache.get(g.id), ...g });
                    }
                });
            });

            // We no longer need to explicitly register active sessions in a separate list
            // Existence of 'wa:sess:...:creds' in Supabase is enough source of truth.
        } catch (error) {
            console.error(`[WA-${this.userId}-${this.profileId}] Connection error:`, error);
            this.connectionStatus = 'disconnected';
            this.emit('status', this.getStatus());
            throw error;
        }
    }

    /**
     * Waits for the connection to be established.
     * Useful for serverless environments where we need to ensure connection before doing work.
     */
    async waitForConnection(timeoutMs = 15000): Promise<boolean> {
        if (this.connectionStatus === 'connected') return true;

        // If not connecting, start it
        if (this.connectionStatus !== 'connecting') {
            await this.connect();
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                cleanup();
                resolve(this.connectionStatus === 'connected');
            }, timeoutMs);

            const onStatus = (status: any) => {
                if (status.status === 'connected') {
                    cleanup();
                    resolve(true);
                } else if (status.status === 'disconnected' && !this.isPairingMode) {
                    // If it specifically failed and isn't waiting for a code
                    cleanup();
                    resolve(false);
                }
            };

            const cleanup = () => {
                this.removeListener('status', onStatus);
                clearTimeout(timeout);
            };

            this.on('status', onStatus);
        });
    }

    async connectWithCode(phone: string): Promise<string> {
        if (this.connectionStatus === 'connected') {
            return '';
        }

        const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
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
            await clearRedisAuthState(this.sessionPrefix);

            const { state, saveCreds } = await useRedisAuthState(this.sessionPrefix);
            const { version } = await fetchLatestBaileysVersion();

            const sock = makeWASocket({
                version,
                auth: state,
                logger,
                browser: Browsers.ubuntu('Chrome'),
                generateHighQualityLinkPreview: true,
                syncFullHistory: false, // Revert to false to prevent conflict
                connectTimeoutMs: 60000,
            });

            this.socket = sock;
            sock.ev.on('creds.update', saveCreds);

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
                            const pCode = await sock.requestPairingCode(cleanPhone || '');
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

                // CRITICAL FIX: Only delete session if explicitly logged out (401)
                // Do NOT delete on 500, 408, 515 or undefined errors.
                // ALSO: Check if it's a "Stream Errored (conflict)" (which is also 401 but NOT a logout)
                const isConflict = (lastDisconnect?.error as any)?.output?.payload?.message === 'Stream Errored (conflict)' ||
                    (lastDisconnect?.error as any)?.message?.includes('conflict');

                if (statusCode === DisconnectReason.loggedOut && !isConflict) {
                    console.warn(`[WA-${this.userId}-${this.profileId}] ⚠️ Session expired/logged out. Cleaning up.`);
                    this.connectionStatus = 'disconnected';
                    this.phoneNumber = null;
                    this.socket = null;
                    this.reconnectAttempts = 0;
                    this.emit('status', this.getStatus());
                    this.emit('logged-out');

                    // Remove from Redis
                    clearRedisAuthState(this.sessionPrefix);
                } else if (this.reconnectAttempts < this.maxReconnectAttempts || isConflict) {
                    // If conflict, retry indefinitely or with backoff, but don't wipe.
                    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
                    const delay = isConflict ? 5000 : Math.pow(2, this.reconnectAttempts) * 1000;
                    console.log(`[WA-${this.userId}-${this.profileId}] 🔄 Reconnecting in ${delay}ms... (Reason: ${isConflict ? 'Conflict' : 'Error'}, Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

                    if (!isConflict) this.reconnectAttempts++;
                    this.connectionStatus = 'connecting';
                    this.emit('status', this.getStatus());

                    setTimeout(() => {
                        this.connect().catch(err => console.error(`[WA-${this.userId}-${this.profileId}] Reconnect failed:`, err));
                    }, delay);
                } else {
                    console.error(`[WA-${this.userId}-${this.profileId}] ❌ Max reconnect attempts reached.`);
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
        await clearRedisAuthState(this.sessionPrefix);

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

        // Debug log
        if (userEntries.length === 0) {
            // console.log(`[WAManager] No clients found for user ${userId} in memory map of size ${this.clients.size}`);
        } else {
            // console.log(`[WAManager] Found ${userEntries.length} clients for user ${userId}`);
        }

        if (userEntries.length === 0) {
            return [{
                userId,
                profileId: '1',
                status: 'disconnected',
                qr: null,
                pairingCode: null,
                phoneNumber: null,
                groupsCount: 0
            }];
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

    // Auto-connect profiles that have saved sessions in Supabase
    // Auto-connect profiles (Lazy load strategy for Redis)
    async autoReconnect() {
        try {
            console.log('[WAManager] Auto-reconnect started (Lazy loading strategy for Redis)');
            // For Redis/Vercel KV, we don't scan all keys.
            // Expected behavior: Client connects when user visits page or via explicit call.
        } catch (error) {
            console.error('[WAManager] Auto-reconnect error:', error);
        }
    }
}

// Singleton manager
const globalForWA = globalThis as unknown as { waManager: WAClientManager | undefined };

if (!globalForWA.waManager) {
    console.log('[WAManager] 🟢 Creating new WAClientManager instance (Singleton)');
    globalForWA.waManager = new WAClientManager();
} else {
    console.log('[WAManager] ♻️ Reusing existing WAClientManager instance');
}

export const waManager = globalForWA.waManager;

// Auto-reconnect saved sessions on startup (only if not already running/connected)
// We use a small delay to ensure DB connection is ready
setTimeout(() => {
    waManager.autoReconnect().catch(console.error);
}, 1000);
