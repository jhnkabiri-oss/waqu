import { NextRequest, NextResponse } from 'next/server';
import { waManager } from '@/lib/wa-client';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { profileId = '1' } = body;

        const client = waManager.getClient(profileId);
        if (client) {
            await client.cancelConnection();
        }

        return NextResponse.json({ message: `Profile ${profileId} connection cancelled` });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to cancel: ' + (error as Error).message },
            { status: 500 }
        );
    }
}
