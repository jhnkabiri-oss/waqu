import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // Ensure all logic is inside handler
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    try {
        // Query job from Supabase using the imported client
        // The client itself is initialized at module level, but we can't change that easily without refactoring lib/supabase-admin
        // However, let's try to query.
        const { data: job, error } = await supabaseAdmin
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error || !job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const jobData = job as any;

        // Map Supabase job status to API response
        let state = jobData.status;
        let progress = 0;
        let result = jobData.result;
        let errorMsg = jobData.error;

        // If completed, progress is 100
        if (state === 'completed') progress = 100;

        return NextResponse.json({
            id: jobData.id,
            state,
            progress,
            result,
            failedReason: errorMsg,
            finishedOn: jobData.updated_at,
        });

    } catch (error) {
        return NextResponse.json({ error: 'Failed to check job status' }, { status: 500 });
    }
}
