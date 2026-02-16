import {
    AuthenticationCreds,
    AuthenticationState,
    SignalDataTypeMap,
    initAuthCreds,
    BufferJSON
} from '@whiskeysockets/baileys';
import { supabaseAdmin } from './supabase-admin';

export const useSupabaseAuthState = async (
    keyPrefix: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> => {
    const credsKey = `${keyPrefix}creds`;

    const writeData = async (data: any, key: string) => {
        try {
            const { error } = await (supabaseAdmin
                .from('wa_sessions') as any)
                .upsert({
                    key,
                    value: JSON.stringify(data, BufferJSON.replacer)
                }, { onConflict: 'key' });

            if (error) throw error;
        } catch (error) {
            console.error('Supabase write error:', error);
        }
    }

    const readData = async (key: string) => {
        try {
            const { data, error } = await (supabaseAdmin
                .from('wa_sessions') as any)
                .select('value')
                .eq('key', key)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
                console.error('Supabase read error:', error);
                return null;
            }

            if (!data || !data.value) {
                return null;
            }

            return JSON.parse(data.value, BufferJSON.reviver);
        } catch (error) {
            console.error('Supabase read error:', error);
            return null;
        }
    }

    const removeData = async (key: string) => {
        try {
            const { error } = await (supabaseAdmin
                .from('wa_sessions') as any)
                .delete()
                .eq('key', key);

            if (error) throw error;
        } catch (error) {
            console.error('Supabase delete error:', error);
        }
    }

    const creds: AuthenticationCreds = (await readData(credsKey)) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};

                    // Supabase doesn't support pipeline like Redis, so we have to do multiple requests or a single "IN" query.
                    // "IN" query is better.
                    const keys = ids.map(id => `${keyPrefix}${type}:${id}`);

                    try {
                        const { data: results, error } = await (supabaseAdmin
                            .from('wa_sessions') as any)
                            .select('key, value')
                            .in('key', keys);

                        if (error) throw error;

                        if (results) {
                            results.forEach((row: any) => {
                                // Extract ID from key
                                // key format: prefix:type:id
                                // We need to be careful with splitting if ID contains ':'
                                // But here we know the precise suffix is what we want? 
                                // Actually, we have the map of expected keys.
                                // Let's just iterate over our requested IDs and check if we have data for them.
                                const idStart = `${keyPrefix}${type}:`.length;
                                const originalId = row.key.substring(idStart);
                                // The originalId should match one of the requested ids.

                                let value = row.value;
                                if (typeof value === 'string') {
                                    value = JSON.parse(value, BufferJSON.reviver);
                                }
                                data[originalId] = value;
                            });
                        }
                    } catch (error) {
                        console.error('Supabase keys.get error:', error);
                    }

                    return data;
                },
                set: async (data) => {
                    const upsertData: { key: string, value: string }[] = [];
                    const deleteKeys: string[] = [];

                    for (const category in data) {
                        const cat = category as keyof typeof data;
                        const items = data[cat];

                        if (!items) continue;

                        for (const id in items) {
                            const value = items[id];
                            const key = `${keyPrefix}${cat}:${id}`;
                            if (value) {
                                upsertData.push({
                                    key,
                                    value: JSON.stringify(value, BufferJSON.replacer)
                                });
                            } else {
                                deleteKeys.push(key);
                            }
                        }
                    }

                    try {
                        if (upsertData.length > 0) {
                            const { error } = await (supabaseAdmin
                                .from('wa_sessions') as any)
                                .upsert(upsertData, { onConflict: 'key' });
                            if (error) throw error;
                        }

                        if (deleteKeys.length > 0) {
                            const { error } = await (supabaseAdmin
                                .from('wa_sessions') as any)
                                .delete()
                                .in('key', deleteKeys);
                            if (error) throw error;
                        }
                    } catch (error) {
                        console.error('Supabase keys.set error:', error);
                    }
                }
            }
        },
        saveCreds: async () => {
            await writeData(creds, credsKey);
        }
    };
}

export const clearSupabaseAuthState = async (keyPrefix: string) => {
    try {
        const { error } = await (supabaseAdmin
            .from('wa_sessions') as any)
            .delete()
            .like('key', `${keyPrefix}%`);

        if (error) throw error;
    } catch (error) {
        console.error('Supabase clear error:', error);
    }
}
