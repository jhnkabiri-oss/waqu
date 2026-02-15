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

        const client = waManager.getClient(user.id, profileId);
        const sock = client?.getSocket();

        if (!sock || !client?.isConnected()) {
            return NextResponse.json(
                { error: 'WhatsApp not connected' },
                { status: 400 }
            );
        }

        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.values(groups).map((g) => ({
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

        const client = waManager.getClient(user.id, profileId);
        const sock = client?.getSocket();

        if (!sock || !client?.isConnected()) {
            return NextResponse.json(
                { error: 'WhatsApp not connected' },
                { status: 400 }
            );
        }

        switch (action) {
            case 'updateDescription':
                await sock.groupUpdateDescription(groupId, data.description);
                break;
            case 'updateSubject':
                await sock.groupUpdateSubject(groupId, data.subject);
                break;
            case 'removeParticipants':
                await sock.groupParticipantsUpdate(groupId, data.participants, 'remove');
                break;
            case 'addParticipants':
                await sock.groupParticipantsUpdate(groupId, data.participants, 'add');
                break;
            case 'promoteParticipants':
                await sock.groupParticipantsUpdate(groupId, data.participants, 'promote');
                break;
            case 'demoteParticipants':
                await sock.groupParticipantsUpdate(groupId, data.participants, 'demote');
                break;
            case 'bulkAddMembers':
                // Implement safe bulk add with delays
                if (Array.isArray(data.participants) && data.participants.length > 0) {
                    const participants = data.participants;
                    let addedCount = 0;
                    let failedCount = 0;

                    console.log(`[Groups] Bulk adding ${participants.length} members to group ${groupId}`);

                    for (let i = 0; i < participants.length; i++) {
                        const member = participants[i];
                        try {
                            // Add member
                            await sock.groupParticipantsUpdate(groupId, [member], 'add');
                            addedCount++;
                            console.log(`[Groups]   ✅ Added ${i + 1}/${participants.length}: ${member}`);
                        } catch (err) {
                            const errMsg = (err as Error).message || '';
                            if (errMsg.includes('rate') || errMsg.includes('429')) {
                                console.log(`[Groups]   ⚠️ Rate limited on ${member}, waiting 30s...`);
                                await new Promise(resolve => setTimeout(resolve, 30000));

                                // Retry once
                                try {
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

                        // Delay between adds (3-5 seconds to be safe)
                        if (i < participants.length - 1) {
                            const delay = Math.floor(Math.random() * (5000 - 3000 + 1) + 3000);
                            await new Promise(resolve => setTimeout(resolve, delay));
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
