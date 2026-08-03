import { parseProsodyEvent } from './session.js';
import { AcousticWindow } from './step.js';
/**
 * Organization live analysis client for `WS /v1/stream/realtime`.
 *
 * Holds the org `psk_*` — use from a trusted server (or a Node worker), not
 * from an untrusted browser page. Browser LiveKit clients should mint a room
 * and consume republished events with `ProsodySession` instead.
 */
export class ProsodyRealtimeStream {
    config;
    handlers;
    socket = null;
    opened = false;
    closed = false;
    constructor(config, handlers = {}) {
        if (!config.apiKey) {
            throw new Error('ProsodyRealtimeStream requires apiKey');
        }
        this.config = config;
        this.handlers = handlers;
    }
    get sessionId() {
        return this.config.sessionId;
    }
    get readyState() {
        return this.socket?.readyState ?? WebSocket.CLOSED;
    }
    /** Open the socket and send the config frame. Resolves on `config_ack`. */
    connect() {
        if (this.socket) {
            return Promise.reject(new Error('ProsodyRealtimeStream already connected'));
        }
        const WS = this.config.WebSocketImpl ?? WebSocket;
        if (!WS) {
            return Promise.reject(new Error('WebSocket is not available in this runtime'));
        }
        const url = realtimeWsUrl(this.config.baseUrl ?? 'https://api.prosodyai.app');
        const socket = new WS(url);
        this.socket = socket;
        this.closed = false;
        return new Promise((resolve, reject) => {
            let settled = false;
            const fail = (error) => {
                if (settled)
                    return;
                settled = true;
                reject(error);
            };
            socket.onopen = () => {
                this.opened = true;
                try {
                    socket.send(JSON.stringify(this.buildConfig()));
                }
                catch (error) {
                    fail(toError(error));
                }
            };
            socket.onmessage = (event) => {
                try {
                    const payload = decodeSocketData(event.data);
                    if (!isRecord(payload) || typeof payload.type !== 'string') {
                        return;
                    }
                    this.handlers.onEvent?.(payload);
                    if (payload.type === 'config_ack') {
                        if (!settled) {
                            settled = true;
                            resolve(payload);
                        }
                        this.handlers.onConfigAck?.(payload);
                        return;
                    }
                    if (payload.type === 'frame_ack') {
                        return;
                    }
                    if (payload.type === 'error'
                        || payload.type === 'warning'
                        || payload.type === 'directive'
                        || payload.type === 'transcript_update'
                        || payload.type === 'speaker_update'
                        || payload.type === 'speaker_cluster_update'
                        || payload.type === 'speaker_profiles'
                        || payload.type === 'agent_steering'
                        || payload.type === 'insights_update'
                        || payload.type === 'session_end') {
                        // Wire events may omit generation/seq; parseProsodyEvent allows that.
                        const parsed = parseProsodyEvent(payload);
                        this.dispatch(parsed);
                        if (payload.type === 'error' && !settled) {
                            fail(new Error(String(payload.message ?? 'Realtime stream error')));
                        }
                    }
                }
                catch (error) {
                    const err = toError(error);
                    this.handlers.onError?.(err);
                    if (!settled)
                        fail(err);
                }
            };
            socket.onerror = () => {
                fail(new Error('ProsodyRealtimeStream WebSocket error'));
            };
            socket.onclose = (event) => {
                this.closed = true;
                this.opened = false;
                this.handlers.onClose?.(event.code, event.reason);
                if (!settled) {
                    fail(new Error(`ProsodyRealtimeStream closed before config_ack (${event.code})`));
                }
            };
        });
    }
    /** Send mono PCM16 (or Opus container) audio bytes. */
    sendAudio(chunk) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            throw new Error('ProsodyRealtimeStream is not open');
        }
        if (chunk instanceof Uint8Array) {
            this.socket.send(chunk);
            return;
        }
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(chunk)) {
            this.socket.send(chunk);
            return;
        }
        this.socket.send(chunk);
    }
    /** Ask the server for `session_end` and close after. */
    end() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN)
            return;
        this.socket.send(JSON.stringify({ type: 'end' }));
    }
    close(code = 1000, reason = 'client_close') {
        if (this.closed || !this.socket)
            return;
        this.closed = true;
        try {
            this.socket.close(code, reason);
        }
        catch {
            // ignore
        }
        this.socket = null;
    }
    buildConfig() {
        const encoding = (this.config.encoding ?? 'pcm16').toLowerCase();
        const sampleRate = this.config.sampleRate ?? 16_000;
        const config = {
            type: 'config',
            api_key: this.config.apiKey,
            encoding,
            sample_rate: sampleRate,
            max_speakers: this.config.maxSpeakers ?? 4,
            source: this.config.source ?? 'sdk',
        };
        if (this.config.sessionId)
            config.session_id = this.config.sessionId;
        if (this.config.analysisMode)
            config.analysis_mode = this.config.analysisMode;
        if (encoding === 'opus') {
            config.container = this.config.container ?? 'ogg';
        }
        return config;
    }
    dispatch(event) {
        switch (event.type) {
            case 'directive': {
                this.handlers.onDirective?.(event);
                const window = AcousticWindow.fromDirective(event);
                this.handlers.onAcousticWindow?.(window);
                this.handlers.onRecurrentStep?.(window);
                this.handlers.conversation?.apply(event);
                break;
            }
            case 'transcript_update':
                this.handlers.onTranscriptUpdate?.(event);
                this.handlers.conversation?.apply(event);
                break;
            case 'speaker_update':
                this.handlers.onSpeakerUpdate?.(event);
                break;
            case 'speaker_cluster_update':
                this.handlers.onSpeakerClusterUpdate?.(event);
                break;
            case 'speaker_profiles':
                this.handlers.onSpeakerProfiles?.(event);
                this.handlers.conversation?.apply(event);
                break;
            case 'agent_steering':
                this.handlers.onSteering?.(event);
                break;
            case 'insights_update':
                this.handlers.onInsightsUpdate?.(event);
                break;
            case 'session_end':
                this.handlers.onSessionEnd?.(event);
                break;
            case 'warning':
                this.handlers.onWarning?.(event);
                break;
            case 'error':
                this.handlers.onServerError?.(event);
                break;
        }
    }
}
export function realtimeWsUrl(baseUrl) {
    const trimmed = baseUrl.replace(/\/$/, '');
    if (trimmed.startsWith('wss://') || trimmed.startsWith('ws://')) {
        return `${trimmed}/v1/stream/realtime`;
    }
    if (trimmed.startsWith('https://')) {
        return `wss://${trimmed.slice('https://'.length)}/v1/stream/realtime`;
    }
    if (trimmed.startsWith('http://')) {
        return `ws://${trimmed.slice('http://'.length)}/v1/stream/realtime`;
    }
    return `wss://${trimmed}/v1/stream/realtime`;
}
function decodeSocketData(data) {
    if (typeof data === 'string')
        return JSON.parse(data);
    if (data instanceof ArrayBuffer) {
        return JSON.parse(new TextDecoder().decode(new Uint8Array(data)));
    }
    if (ArrayBuffer.isView(data)) {
        return JSON.parse(new TextDecoder().decode(data));
    }
    // Node ws may deliver Buffer
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
        return JSON.parse(data.toString('utf8'));
    }
    throw new Error('Unsupported WebSocket message type');
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function toError(error) {
    return error instanceof Error ? error : new Error(String(error));
}
