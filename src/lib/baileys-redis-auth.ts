
import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, SignalDataTypeMap } from '@whiskeysockets/baileys';
import Redis from 'ioredis';

// Singleton Redis client
let redisClient: Redis | null = null;

const getRedisClient = () => {
    if (!redisClient) {
        // Use REDIS_URL from environment or fallback
        const url = process.env.REDIS_URL || process.env.KV_URL || 'redis://localhost:6379';
        console.log('[RedisAuth] Connecting to Redis at:', url.replace(/:[^:@]+@/, ':****@')); // Mask password
        redisClient = new Redis(url, {
            // Options for robust connection
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: null,
        });

        redisClient.on('error', (err) => console.error('[RedisAuth] Redis Client Error', err));
        redisClient.on('connect', () => console.log('[RedisAuth] Redis Client Connected'));
    }
    return redisClient;
};


export const useRedisAuthState = async (keyPrefix: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {
    const redis = getRedisClient();

    // 1. Load credentials
    const readData = async (key: string) => {
        try {
            const data = await redis.get(key);
            if (data) {
                return JSON.parse(data, BufferJSON.reviver);
            }
            return null;
        } catch (error) {
            console.error('Redis read error:', error);
            return null;
        }
    };

    const writeData = async (data: any, key: string) => {
        try {
            await redis.set(key, JSON.stringify(data, BufferJSON.replacer));
        } catch (error) {
            console.error('Redis write error:', error);
        }
    };

    const removeData = async (key: string) => {
        try {
            await redis.del(key);
        } catch (error) {
            console.error('Redis delete error:', error);
        }
    };

    const credsKey = `${keyPrefix}creds`;
    const creds: AuthenticationCreds = (await readData(credsKey)) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            const value = await readData(`${keyPrefix}${type}:${id}`);
                            if (value) {
                                data[id] = value;
                            }
                        })
                    );
                    return data;
                },
                set: async (data: any) => {
                    const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = (data as any)[category][id];
                            const key = `${keyPrefix}${category}:${id}`;
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData(creds, credsKey);
        }
    };
};

export const clearRedisAuthState = async (keyPrefix: string) => {
    const redis = getRedisClient();
    try {
        // Pattern deletion requires scanning
        const stream = redis.scanStream({
            match: `${keyPrefix}*`,
            count: 100
        });

        stream.on('data', (keys) => {
            if (keys.length > 0) {
                redis.del(...keys);
            }
        });

        stream.on('end', () => {
            // Done
        });

    } catch (error) {
        console.error('Redis clear error:', error);
    }
};
