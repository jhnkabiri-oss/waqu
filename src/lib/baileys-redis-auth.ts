import {
    AuthenticationCreds,
    AuthenticationState,
    SignalDataTypeMap,
    initAuthCreds,
    BufferJSON
} from '@whiskeysockets/baileys';
import Redis from 'ioredis';

export const useRedisAuthState = async (
    redis: Redis,
    keyPrefix: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> => {
    const credsKey = `${keyPrefix}creds`;

    const writeData = async (data: any, key: string) => {
        try {
            return await redis.set(key, JSON.stringify(data, BufferJSON.replacer));
        } catch (error) {
            console.error('Redis write error:', error);
        }
    }

    const readData = async (key: string) => {
        try {
            const data = await redis.get(key);
            if (data) {
                return JSON.parse(data, BufferJSON.reviver);
            }
        } catch (error) {
            console.error('Redis read error:', error);
        }
        return null;
    }

    const creds: AuthenticationCreds = (await readData(credsKey)) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};
                    const pipeline = redis.pipeline();

                    ids.forEach(id => {
                        const key = `${keyPrefix}${type}:${id}`;
                        pipeline.get(key);
                    });

                    const results = await pipeline.exec();

                    if (results) {
                        results.forEach((result, index) => {
                            const [err, val] = result;
                            if (!err && val && typeof val === 'string') {
                                const id = ids[index];
                                const value = JSON.parse(val, BufferJSON.reviver);
                                data[id] = value;
                            }
                        });
                    }
                    return data;
                },
                set: async (data) => {
                    const pipeline = redis.pipeline();

                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${keyPrefix}${category}:${id}`;
                            if (value) {
                                pipeline.set(key, JSON.stringify(value, BufferJSON.replacer));
                            } else {
                                pipeline.del(key);
                            }
                        }
                    }
                    await pipeline.exec();
                }
            }
        },
        saveCreds: async () => {
            await writeData(creds, credsKey);
        }
    };
}

export const clearRedisAuthState = async (redis: Redis, keyPrefix: string) => {
    try {
        const stream = redis.scanStream({
            match: `${keyPrefix}*`,
            count: 100
        });

        stream.on('data', async (keys) => {
            if (keys.length) {
                await redis.del(...keys);
            }
        });

        return new Promise<void>((resolve, reject) => {
            stream.on('end', () => resolve());
            stream.on('error', (err) => reject(err));
        });
    } catch (error) {
        console.error('Redis clear error:', error);
    }
}
