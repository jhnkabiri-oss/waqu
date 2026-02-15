import { NextRequest, NextResponse } from 'next/server';
import { groupCreateQueue, broadcastQueue } from '@/lib/queue';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const queueName = searchParams.get('queue') || 'broadcast';

    try {
        const queue = queueName === 'group-create' ? groupCreateQueue : broadcastQueue;

        if (jobId) {
            const job = await queue.getJob(jobId);
            if (!job) {
                return NextResponse.json({ error: 'Job not found' }, { status: 404 });
            }

            const state = await job.getState();
            return NextResponse.json({
                id: job.id,
                name: job.name,
                data: job.data,
                progress: job.progress,
                status: state,
                failedReason: job.failedReason,
                timestamp: job.timestamp,
                finishedOn: job.finishedOn,
            });
        }

        // Return queue stats
        const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
        ]);

        return NextResponse.json({
            queue: queueName,
            waiting,
            active,
            completed,
            failed,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to get job status: ' + (error as Error).message },
            { status: 500 }
        );
    }
}
