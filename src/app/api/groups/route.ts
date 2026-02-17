import { NextRequest, NextResponse } from 'next/server';
import { waManager } from '@/lib/wa-client';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const profileId = searchParams.get('profileId');

        if (!profileId) {
            return NextResponse.json({ error: 'Profile ID Required' }, { status: 400 });
        }

        const client = waManager.getOrCreateClient(user.id, profileId);

        // Wait for connection (lazy reconnect for serverless)
        const isConnected = await client.waitForConnection(30000);
        const sock = client.getSocket();

        if (!sock || !isConnected) {
            return NextResponse.json(
                { error: 'WhatsApp not connected or failed to reconnect' },
                { status: 400 }
            );
        }

        console.log(`[API-Groups] Fetching groups for profile ${profileId}...`);
        const start = Date.now();

        // 1. Try to get from local cache first if available
        let groups = {};
        if (client.groupCache.size > 0) {
            console.log(`[API-Groups] Using cached groups (${client.groupCache.size})`);
            groups = Object.fromEntries(client.groupCache);
        }

        // 2. If empty, try to fetch
        if (Object.keys(groups).length === 0) {
            // Retry logic for group fetch
            let fetchRetries = 3;
            while (fetchRetries > 0) {
                try {
                    console.log(`[API-Groups] Cache empty, fetching from socket...`);
                    groups = await sock.groupFetchAllParticipating();

                    // Update cache
                    if (groups) {
                        Object.values(groups).forEach((g: any) => client.groupCache.set(g.id, g));
                    }
                    break;
                } catch (err) {
                    console.warn(`[API-Groups] Fetch failed, retrying... (${fetchRetries} left)`, err);
                    fetchRetries--;
                    if (fetchRetries === 0) {
                        // Don't throw, just return empty list to avoid crashing UI
                        console.error('Final group fetch failed:', err);
                    }
                    await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
                }
            }
        }

        console.log(`[API-Groups] Fetched ${Object.keys(groups || {}).length} groups in ${Date.now() - start}ms`);

        const groupList = Object.values(groups || {}).map((g: any) => ({
            id: g.id,
            subject: g.subject,
            desc: g.desc,
            participants: g.participants,
            size: g.size || g.participants?.length || 0,
            creation: g.creation,
        }));

        return NextResponse.json({ groups: groupList });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch groups: ' + (error as Error).message },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { groupId, action, data, profileId } = body;

        if (!profileId) {
            return NextResponse.json({ error: 'Profile ID Required' }, { status: 400 });
        }

        const client = waManager.getOrCreateClient(user.id, profileId);
        const isConnected = await client.waitForConnection(30000);

        if (!isConnected) {
            return NextResponse.json(
                { error: 'WhatsApp not connected or failed to reconnect' },
                { status: 400 }
            );
        }

        // Helper: get a live socket, waiting for reconnection if needed
        const getLiveSocket = async () => {
            let sock = client.getSocket();
            if (!sock || client.getStatus().status !== 'connected') {
                console.log(`[API-Groups] Socket stale, waiting for reconnection...`);
                const reconnected = await client.waitForConnection(30000);
                if (!reconnected) throw new Error('WhatsApp disconnected and failed to reconnect');
                sock = client.getSocket();
            }
            if (!sock) throw new Error('No active WhatsApp socket');
            return sock;
        };

        switch (action) {
            case 'updateDescription': {
                const sock = await getLiveSocket();
                await sock.groupUpdateDescription(groupId, data.description);
                break;
            }
            case 'updateSubject': {
                const sock = await getLiveSocket();
                await sock.groupUpdateSubject(groupId, data.subject);
                break;
            }
            case 'removeParticipants': {
                const sock = await getLiveSocket();
                await sock.groupParticipantsUpdate(groupId, data.participants, 'remove');
                break;
            }
            case 'addParticipants': {
                try {
                    const sock = await getLiveSocket();
                    const result = await sock.groupParticipantsUpdate(groupId, data.participants, 'add');
                    return NextResponse.json({
                        message: 'Participants add attempted',
                        result: result,
                    });
                } catch (addErr) {
                    console.error(`[API-Groups] addParticipants error:`, addErr);
                    return NextResponse.json({
                        error: 'Failed to add some participants: ' + (addErr as Error).message,
                        details: 'Some numbers may have privacy settings that prevent being added to groups.',
                    }, { status: 400 });
                }
            }
            case 'promoteParticipants': {
                const sock = await getLiveSocket();
                await sock.groupParticipantsUpdate(groupId, data.participants, 'promote');
                break;
            }
            case 'demoteParticipants': {
                const sock = await getLiveSocket();
                await sock.groupParticipantsUpdate(groupId, data.participants, 'demote');
                break;
            }
            case 'bulkAddMembers':
                // Implement safe bulk add with configurable delays
                if (Array.isArray(data.participants) && data.participants.length > 0) {
                    const participants = data.participants;
                    const memberDelay = Math.max(3, Math.min(30, data.delay || 5)) * 1000;
                    let addedCount = 0;
                    let failedCount = 0;

                    console.log(`[Groups] Bulk adding ${participants.length} members to group ${groupId} (delay: ${memberDelay / 1000}s)`);

                    for (let i = 0; i < participants.length; i++) {
                        const member = participants[i];
                        try {
                            const sock = await getLiveSocket();
                            await sock.groupParticipantsUpdate(groupId, [member], 'add');
                            addedCount++;
                            console.log(`[Groups]   ✅ Added ${i + 1}/${participants.length}: ${member}`);
                        } catch (err) {
                            const errMsg = (err as Error).message || '';
                            if (errMsg.includes('rate') || errMsg.includes('429') || errMsg.includes('Connection Closed') || errMsg.includes('close')) {
                                const waitTime = errMsg.includes('Connection') || errMsg.includes('close') ? 10000 : 30000;
                                console.log(`[Groups]   ⚠️ ${errMsg.includes('Connection') ? 'Connection lost' : 'Rate limited'} on ${member}, waiting ${waitTime / 1000}s...`);
                                await new Promise(resolve => setTimeout(resolve, waitTime));

                                // Retry once with fresh socket
                                try {
                                    const sock = await getLiveSocket();
                                    await sock.groupParticipantsUpdate(groupId, [member], 'add');
                                    addedCount++;
                                    console.log(`[Groups]   ✅ Retry success: ${member}`);
                                } catch (retryErr) {
                                    failedCount++;
                                    console.log(`[Groups]   ❌ Retry failed: ${member}`);
                                }
                            } else {
                                failedCount++;
                                console.log(`[Groups]   ❌ Failed: ${member}: ${errMsg}`);
                            }
                        }

                        // Configurable delay between adds
                        if (i < participants.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, memberDelay));
                        }
                    }
                    return NextResponse.json({
                        message: `Bulk add completed: ${addedCount} added, ${failedCount} failed`,
                        added: addedCount,
                        failed: failedCount
                    });
                } else {
                    return NextResponse.json({ error: 'Invalid participants list' }, { status: 400 });
                }
                break;
            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }

        return NextResponse.json({ message: 'Action completed successfully' });
    } catch (error) {
        return NextResponse.json(
            { error: 'Action failed: ' + (error as Error).message },
            { status: 500 }
        );
    }
}


