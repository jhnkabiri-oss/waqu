export interface WaConnectionStatus {
    status: 'disconnected' | 'connecting' | 'qr' | 'connected';
    qr?: string;
    phoneNumber?: string;
}

export interface GroupCreateInput {
    name: string;
    members: string[];
}

export interface BroadcastInput {
    recipients: string[];
    message: string;
    mediaUrl?: string;
    minDelay?: number;
    maxDelay?: number;
}

export interface ContactInput {
    name: string;
    phone: string;
}

export interface JobStatus {
    id: string;
    name: string;
    progress: number;
    status: 'waiting' | 'active' | 'completed' | 'failed';
    data?: Record<string, unknown>;
    failedReason?: string;
}

export interface GroupInfo {
    id: string;
    subject: string;
    desc?: string;
    participants: Array<{
        id: string;
        admin?: string | null;
    }>;
    size: number;
    creation?: number;
}
