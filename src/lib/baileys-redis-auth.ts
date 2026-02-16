
import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { kv } from '@vercel/kv';

export const useRedisAuthState = async (keyPrefix: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {
    // 1. Load credentials
    const readData = async (key: string) => {
        try {
            const data = await kv.get(key);
            if (data) {
                return JSON.parse(JSON.stringify(data), BufferJSON.reviver);
            }
            return null;
        } catch (error) {
            console.error('Redis read error:', error);
            return null;
        }
    };

    const writeData = async (data: any, key: string) => {
        try {
            await kv.set(key, JSON.stringify(data, BufferJSON.replacer));
        } catch (error) {
            console.error('Redis write error:', error);
        }
    };

    const removeData = async (key: string) => {
        try {
            await kv.del(key);
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
                            const value = data[category][id];
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
    try {
        // Pattern deletion is tricky in KV without keys command which is expensive/blocked
        // We might need to iterate or rely on good key management
        // For now, at least clear creds
        const keys = await kv.keys(`${keyPrefix}*`);
        if (keys.length > 0) {
            await kv.del(...keys);
        }
    } catch (error) {
        console.error('Redis clear error:', error);
    }
};
