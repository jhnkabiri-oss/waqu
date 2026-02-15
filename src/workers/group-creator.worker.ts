import { Worker, Job } from 'bullmq';

// This worker runs as a separate process
// Start with: npx tsx src/workers/group-creator.worker.ts

const connection = {
    host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname || 'localhost',
    port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
};

const worker = new Worker(
    'group-create',
    async (job: Job) => {
        const { name, members } = job.data;
        console.log(`[Worker] Creating group: ${name} with ${members.length} members`);

        try {
            // Dynamic import to avoid bundling issues
            const { waClient } = await import('../lib/wa-client');

            if (!waClient.isConnected()) {
                throw new Error('WhatsApp not connected');
            }

            const sock = waClient.getSocket();
            if (!sock) throw new Error('No socket available');

            const result = await sock.groupCreate(name, members);
            console.log(`[Worker] Group created: ${result.id}`);

            await job.updateProgress(100);
            return { groupId: result.id, name };
        } catch (error) {
            console.error(`[Worker] Failed to create group ${name}:`, error);
            throw error;
        }
    },
    {
        connection,
        concurrency: 1,
        limiter: {
            max: 1,
            duration: 5000,
        },
    }
);

worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed for group: ${job.data.name}`);
});

worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

console.log('[Worker] Group creator worker started');
