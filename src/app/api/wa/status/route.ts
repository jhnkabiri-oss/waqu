import { NextRequest, NextResponse } from 'next/server';
import { waManager } from '@/lib/wa-client';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { hasRedisSession } from '@/lib/baileys-redis-auth';

export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For specific profile query
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');

    if (profileId) {
        // Return single profile status
        const client = waManager.getClient(user.id, profileId);
        return NextResponse.json(
            client?.getStatus() ?? {
                userId: user.id,
                profileId,
                status: 'disconnected',
                qr: null,
                pairingCode: null,
                phoneNumber: null
            }
        );
    }

    // Return all profiles for this user
    const profiles = waManager.getUserStatuses(user.id);

    // AUTO-WAKE: If Default Profile 1 is disconnected (meaning likely not in memory due to server restart),
    // trigger a connection attempt so it restores from Redis.
    const p1 = profiles.find(p => p.profileId === '1');
    if (p1 && p1.status === 'disconnected') {
        const client = waManager.getOrCreateClient(user.id, '1');

        // CHECK REDIS FIRST: Only wake up if there is an actual session saved.
        // This prevents infinite loops if the user meant to disconnect/cancel.
        const sessionExists = await hasRedisSession(client.sessionPrefix);

        if (sessionExists && client.connectionStatus === 'disconnected') {
            console.log(`[API-Status] Auto-waking up Profile 1 for user ${user.id} (Session found in Redis)`);
            client.connect().catch(e => console.error(`[API-Status] Auto-wake failed:`, e));
            // Show connecting immediately to user
            p1.status = 'connecting';
        } else if (!sessionExists) {
            // No session in Redis, so it's truly disconnected. Do nothing.
        } else {
            // It might be connecting or in other state
            p1.status = client.connectionStatus;
        }
    }

    return NextResponse.json({ profiles });
}
