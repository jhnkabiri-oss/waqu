import { NextRequest, NextResponse } from 'next/server';
import { waManager } from '@/lib/wa-client';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minSec: number, maxSec: number): number {
    return (Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000;
}

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const json = await req.json();
        const { groups, delay = 5, profileId } = json;

        if (!profileId) {
            return NextResponse.json({ error: 'Profile ID Required' }, { status: 400 });
        }

        if (!groups || !Array.isArray(groups) || groups.length === 0) {
            return NextResponse.json(
                { error: 'Invalid input. Expected array of { name, description?, members[] }' },
                { status: 400 }
            );
        }

        const client = waManager.getOrCreateClient(user.id, profileId);
        const isConnected = await client.waitForConnection(30000);

        if (!isConnected) {
            return NextResponse.json(
                { error: `WhatsApp Profile ${profileId} not connected or failed to reconnect.` },
                { status: 400 }
            );
        }

        // Helper: get a live socket, waiting for reconnection if needed
        const getLiveSocket = async () => {
            let sock = client.getSocket();
            if (!sock || client.getStatus().status !== 'connected') {
                console.log(`[Groups] Socket stale, waiting for reconnection...`);
                const reconnected = await client.waitForConnection(30000);
                if (!reconnected) throw new Error('WhatsApp disconnected and failed to reconnect');
                sock = client.getSocket();
            }
            if (!sock) throw new Error('No active WhatsApp socket');
            return sock;
        };

        const results: Array<{ name: string; status: string; id?: string; error?: string; added?: number; failed?: number }> = [];

        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];

            try {
                // Clean member phone numbers
                const allMembers: string[] = group.members
                    .map((m: string) => {
                        const clean = m.replace(/[^0-9]/g, '');
                        return clean.includes('@s.whatsapp.net') ? clean : `${clean}@s.whatsapp.net`;
                    })
                    .filter((m: string) => m.replace('@s.whatsapp.net', '').length >= 8);

                console.log(`[Groups] Creating group ${i + 1}/${groups.length}: "${group.name}" with ${allMembers.length} members`);

                // Step 1: Create group with first 3 members (like a human would)
                const initialMembers = allMembers.slice(0, 3);
                const remainingMembers = allMembers.slice(3);

                let retries = 3;
                let result;
                while (retries > 0) {
                    try {
                        const socket = await getLiveSocket();
                        result = await socket.groupCreate(group.name, initialMembers);
                        break;
                    } catch (err) {
                        const errMsg = (err as Error).message || '';
                        if ((errMsg.includes('rate') || errMsg.includes('429') || errMsg.includes('Connection Closed') || errMsg.includes('close')) && retries > 1) {
                            retries--;
                            const waitTime = errMsg.includes('Connection Closed') || errMsg.includes('close') ? 10 : 30;
                            console.log(`[Groups] ${errMsg.includes('Connection') ? 'Connection lost' : 'Rate limited'} on create, waiting ${waitTime}s... (${retries} retries left)`);
                            await sleep(waitTime * 1000);
                        } else {
                            throw err;
                        }
                    }
                }

                if (!result) throw new Error('Failed to create group after retries');

                console.log(`[Groups] ✅ Group created: "${group.name}" -> ${result.id}`);

                // Step 2: Set description if provided
                if (group.description && result.id) {
                    try {
                        await sleep(2000);
                        const socket = await getLiveSocket();
                        await socket.groupUpdateDescription(result.id, group.description);
                        console.log(`[Groups]   Description set.`);
                    } catch (descErr) {
                        console.warn(`[Groups]   Failed to set description:`, descErr);
                    }
                }

                // Step 3: Wait 10-15 seconds (human-like pause after creating)
                let addedCount = initialMembers.length;
                let failedCount = 0;

                if (remainingMembers.length > 0) {
                    const initialWait = randomDelay(10, 15);
                    console.log(`[Groups]   Waiting ${Math.round(initialWait / 1000)}s before adding remaining ${remainingMembers.length} members...`);
                    await sleep(initialWait);

                    // Step 4: Add remaining members ONE BY ONE, every 5 seconds
                    for (let m = 0; m < remainingMembers.length; m++) {
                        const member = remainingMembers[m];
                        const memberNum = member.replace('@s.whatsapp.net', '');

                        try {
                            const socket = await getLiveSocket();
                            await socket.groupParticipantsUpdate(result.id, [member], 'add');
                            addedCount++;
                            console.log(`[Groups]   ✅ Added ${m + 1}/${remainingMembers.length}: ${memberNum}`);
                        } catch (err) {
                            const errMsg = (err as Error).message || '';

                            if (errMsg.includes('rate') || errMsg.includes('429')) {
                                // Rate limited — wait 30s and retry once
                                console.log(`[Groups]   ⚠️ Rate limited on ${memberNum}, waiting 30s...`);
                                await sleep(30000);

                                try {
                                    const socket = await getLiveSocket();
                                    await socket.groupParticipantsUpdate(result.id, [member], 'add');
                                    addedCount++;
                                    console.log(`[Groups]   ✅ Retry success: ${memberNum}`);
                                } catch {
                                    failedCount++;
                                    console.log(`[Groups]   ❌ Retry failed: ${memberNum}`);
                                }
                            } else {
                                failedCount++;
                                console.log(`[Groups]   ❌ Failed: ${memberNum} — ${errMsg}`);
                            }
                        }

                        // Wait 5 seconds between each member (human pace)
                        if (m < remainingMembers.length - 1) {
                            await sleep(5000);
                        }
                    }
                }

                console.log(`[Groups] ✅ Done: "${group.name}" — ${addedCount} added, ${failedCount} failed`);
                results.push({
                    name: group.name,
                    status: 'created',
                    id: result.id,
                    added: addedCount,
                    failed: failedCount,
                });
            } catch (err) {
                console.error(`[Groups] ❌ Failed: "${group.name}":`, err);
                results.push({ name: group.name, status: 'failed', error: (err as Error).message });
            }

            // Delay between groups
            if (i < groups.length - 1) {
                const groupDelay = delay * 1000;
                console.log(`[Groups] Waiting ${delay}s before next group...`);
                await sleep(groupDelay);
            }
        }

        const created = results.filter((r) => r.status === 'created').length;
        const failed = results.filter((r) => r.status === 'failed').length;

        return NextResponse.json({
            message: `${created} group(s) created, ${failed} failed`,
            results,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to create groups: ' + (error as Error).message },
            { status: 500 }
        );
    }
}
