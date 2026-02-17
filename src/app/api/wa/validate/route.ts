import { NextRequest, NextResponse } from 'next/server';
import { waManager } from '@/lib/wa-client';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { numbers, profileId, delay = 2 } = await req.json();

        if (!profileId) {
            return NextResponse.json({ error: 'Profile ID Required' }, { status: 400 });
        }

        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return NextResponse.json({ error: 'No numbers provided' }, { status: 400 });
        }

        if (numbers.length > 500) {
            return NextResponse.json({ error: 'Maximum 500 numbers per request' }, { status: 400 });
        }

        const client = waManager.getOrCreateClient(user.id, profileId);
        const isConnected = await client.waitForConnection(30000);
        const sock = client.getSocket();

        if (!sock || !isConnected) {
            return NextResponse.json(
                { error: 'WhatsApp not connected' },
                { status: 400 }
            );
        }

        const results: Array<{
            phone: string;
            exists: boolean;
            jid?: string;
        }> = [];

        // Process in batches of 25 to avoid rate limits
        const batchSize = 25;
        const delayMs = Math.max(1, Math.min(10, delay)) * 1000;

        console.log(`[Validator] Checking ${numbers.length} numbers (batch: ${batchSize}, delay: ${delayMs / 1000}s)`);

        for (let i = 0; i < numbers.length; i += batchSize) {
            const batch = numbers.slice(i, i + batchSize);

            // Clean numbers and format for WhatsApp check
            const cleanNumbers = batch.map((n: string) => {
                const clean = n.replace(/[^0-9]/g, '');
                return clean.includes('@') ? clean : `${clean}@s.whatsapp.net`;
            });

            try {
                const waResults = await sock.onWhatsApp(...cleanNumbers) || [];

                // Map results back — onWhatsApp returns only existing numbers
                const existingJids = new Set(waResults.map(r => r.jid));
                const existingMap = new Map(waResults.map(r => [r.jid, r]));

                for (const num of batch) {
                    const clean = num.replace(/[^0-9]/g, '');
                    const jid = `${clean}@s.whatsapp.net`;

                    if (existingJids.has(jid)) {
                        const waResult = existingMap.get(jid);
                        results.push({
                            phone: clean,
                            exists: true,
                            jid: waResult?.jid || jid,
                        });
                    } else {
                        results.push({
                            phone: clean,
                            exists: false,
                        });
                    }
                }

                console.log(`[Validator] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(numbers.length / batchSize)}: ${waResults.length}/${batch.length} active`);
            } catch (err) {
                console.error(`[Validator] Batch error:`, err);
                // Mark all in batch as unknown on error
                for (const num of batch) {
                    const clean = num.replace(/[^0-9]/g, '');
                    results.push({
                        phone: clean,
                        exists: false,
                    });
                }
            }

            // Delay between batches
            if (i + batchSize < numbers.length) {
                await sleep(delayMs);
            }
        }

        const active = results.filter(r => r.exists).length;
        const inactive = results.filter(r => !r.exists).length;

        console.log(`[Validator] Done! Active: ${active}, Inactive: ${inactive}`);

        return NextResponse.json({
            message: `Validation complete: ${active} active, ${inactive} inactive`,
            total: results.length,
            active,
            inactive,
            results,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Validation failed: ' + (error as Error).message },
            { status: 500 }
        );
    }
}
