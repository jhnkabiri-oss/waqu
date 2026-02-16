import { supabaseAdmin } from './supabase-admin';

export interface Job<T = any> {
    id: string;
    queue_name: string;
    data: T;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: any;
    error?: string;
    created_at: string;
    updated_at: string;
}

export class SupabaseQueue<T = any> {
    private queueName: string;

    constructor(queueName: string) {
        this.queueName = queueName;
    }

    async add(name: string, data: T): Promise<Job<T>> {
        const { data: job, error } = await (supabaseAdmin
            .from('jobs') as any)
            .insert({
                queue_name: this.queueName,
                data: data,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to add job: ${error.message}`);
        return job;
    }

    // Worker function to process jobs
    // In a serverless environment, this is tricky. Usually we trigger an API route.
    // For now, we'll keep the "add" part. The processing part needs a runner.
    // Since we are moving away from long-running Node processes (worker.ts),
    // we might need to change how broadcast works:
    // Option A: Vercel/Netlify Background Functions (if available) -> Not standard.
    // Option B: Cron job pinging an API endpoint to process pending jobs.
    // Option C: Just process immediately if small batch (risk of timeout).

    // For this migration, we will focus on the enqueue part appearing correct, 
    // and I'll create a simple processor function that can be called via CRON or manually.
}

export const broadcastQueue = new SupabaseQueue('broadcast');
export const groupCreateQueue = new SupabaseQueue('group-create');

// Function to process next pending job (can be called by a cron route)
export async function processNextJob(queueName: string, processor: (job: Job) => Promise<any>) {
    // 1. Lock a pending job
    const { data: job, error } = await (supabaseAdmin
        .from('jobs') as any)
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('queue_name', queueName)
        .eq('status', 'pending')
        .limit(1)
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error locking job:', error);
        return null;
    }

    if (!job) return null; // No jobs

    try {
        console.log(`[Queue] Processing job ${job.id}...`);
        const result = await processor(job);

        await (supabaseAdmin
            .from('jobs') as any)
            .update({
                status: 'completed',
                result,
                updated_at: new Date().toISOString()
            })
            .eq('id', job.id);

        return job;
    } catch (err) {
        console.error(`[Queue] Job ${job.id} failed:`, err);
        await (supabaseAdmin
            .from('jobs') as any)
            .update({
                status: 'failed',
                error: (err as Error).message,
                updated_at: new Date().toISOString()
            })
            .eq('id', job.id);
        return job;
    }
}
