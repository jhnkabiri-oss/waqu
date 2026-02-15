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
                // Custom action if implemented or just re-use addParticipants
                await sock.groupParticipantsUpdate(groupId, data.participants, 'add');
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
