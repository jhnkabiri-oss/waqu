import { Queue } from 'bullmq';

const connection = {
    host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname || 'localhost',
    port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
};

export const groupCreateQueue = new Queue('group-create', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
    },
});

export const broadcastQueue = new Queue('broadcast', {
    connection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 10000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
    },
});
