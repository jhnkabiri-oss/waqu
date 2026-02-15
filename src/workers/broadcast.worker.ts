import { Worker, Job } from 'bullmq';
import { waManager } from '../lib/wa-client';

// This worker runs as a separate process
// Start with: npx tsx src/workers/broadcast.worker.ts

const connection = {
    host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname || 'localhost',
    port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
};

function randomDelay(min: number, max: number): Promise<void> {
    const ms = (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
    console.log(`[Worker] Waiting ${ms / 1000}s before next message...`);
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const worker = new Worker(
    'broadcast',
    async (job: Job) => {
        const { recipients, message, minDelay, maxDelay, userId, profileId, totalRecipients } = job.data;
        console.log(`[Worker] Broadcasting to ${recipients.length} recipients (User: ${userId}, Profile: ${profileId})`);

        if (!userId || !profileId) {
            throw new Error('Missing userId or profileId in job data');
        }

        const waClient = waManager.getOrCreateClient(userId, profileId);

        // Ensure connected
        if (!waClient.isConnected()) {
            console.log(`[Worker] Profile not connected, attempting to connect...`);
            await waClient.connect();
            // Wait a bit for connection
            await new Promise(r => setTimeout(r, 5000));
            if (!waClient.isConnected()) {
                throw new Error('WhatsApp not connected after attempt');
            }
        }

        const sock = waClient.getSocket();
        if (!sock) throw new Error('No socket available');

        let sent = 0;
        let failed = 0;

        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];

            try {
                await sock.sendMessage(recipient, { text: message });
                sent++;
                console.log(`[Worker] Sent to ${recipient} (${sent}/${totalRecipients})`);
            } catch (error) {
                failed++;
                console.error(`[Worker] Failed to send to ${recipient}:`, (error as Error).message);
            }

            // Update progress
            const progress = Math.round(((i + 1) / recipients.length) * 100);
            await job.updateProgress(progress);

            // Random delay between messages (except for the last one)
            if (i < recipients.length - 1) {
                await randomDelay(minDelay || 10, maxDelay || 30);
            }
        }

        console.log(`[Worker] Broadcast complete. Sent: ${sent}, Failed: ${failed}`);
        return { sent, failed, total: recipients.length };
    },
    {
        connection,
        concurrency: 1,
    }
);

worker.on('completed', (job) => {
    console.log(`[Worker] Broadcast job ${job.id} completed:`, job.returnvalue);
});

worker.on('failed', (job, err) => {
    console.error(`[Worker] Broadcast job ${job?.id} failed:`, err.message);
});

console.log('[Worker] Broadcast worker started');
