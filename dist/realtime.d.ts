import type { StreamingOptions } from '@/types';
import type { ProsodyClient } from '@/client';
export declare class ProsodyRealtimeStream {
    private ws;
    private apiKey;
    private baseUrl;
    private options;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private _resolveEnd;
    constructor(client: ProsodyClient, options?: StreamingOptions);
    connect(): Promise<void>;
    send(samples: Float32Array | Int16Array | ArrayBuffer): void;
    end(): Promise<void>;
    close(): void;
    get isConnected(): boolean;
}
