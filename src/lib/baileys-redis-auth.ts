import {
    AuthenticationCreds,
    AuthenticationState,
    SignalDataTypeMap,
    initAuthCreds,
    BufferJSON
} from '@whiskeysockets/baileys';
import { Redis } from '@upstash/redis';

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
            if (data === null || data === undefined) {
                return null;
            }
            // Upstash returns the object directly if it detects JSON, or string.
            // Better to force string or handle object.
            // Actually Upstash auto-parses JSON. But Baileys BufferJSON needs custom reviver.
            // So we should store as string (which JSON.stringify does) and parse manually.
            if (typeof data === 'object') {
                // If Upstash auto-parsed it, we might need to re-stringify to use BufferJSON.reviver
                // Or we just hope no Buffers are needed (but they are for keys).
                // Safer to let Upstash return string? No, Upstash SDK auto-parses.
                // We can use JSON.stringify(data) then JSON.parse(..., reviver) to restore Buffers.
                return JSON.parse(JSON.stringify(data), BufferJSON.reviver);
            }
            if (typeof data === 'string') {
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
                            // Upstash pipeline result: [result1, result2, ...]
                            // result can be the value or error?
                            // Upstash SDK throws on error usually?
                            // exec() returns an array of responses.
                            const val = result; // In Upstash, result is the value directly
                            if (val) {
                                const id = ids[index];
                                let value = val;
                                // Handle auto-parsing
                                if (typeof val === 'object') {
                                    value = JSON.parse(JSON.stringify(val), BufferJSON.reviver);
                                } else if (typeof val === 'string') {
                                    value = JSON.parse(val, BufferJSON.reviver);
                                }
                                data[id] = value as SignalDataTypeMap[typeof type];
                            }
                        });
                    }
                    return data;
                },
                set: async (data) => {
                    const pipeline = redis.pipeline();

                    for (const category in data) {
                        const cat = category as keyof typeof data;
                        const items = data[cat];

                        if (!items) continue;

                        for (const id in items) {
                            const value = items[id];
                            const key = `${keyPrefix}${cat}:${id}`;
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
        let cursor: number | string = 0;
        do {
            const [nextCursor, keys]: [string | number, string[]] = await redis.scan(cursor as number, {
                match: `${keyPrefix}*`,
                count: 100
            });

            // Upstash returns cursor as string or number depending on client version/response
            // We cast nextCursor to handle the loop condition
            cursor = nextCursor;

            if (keys && keys.length > 0) {
                await redis.del(...keys);
            }
        } while (String(cursor) !== '0');

    } catch (error) {
        console.error('Redis clear error:', error);
    }
}
