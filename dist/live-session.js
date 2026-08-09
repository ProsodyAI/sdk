import { Conversation } from './conversation.js';
import { ProsodyRealtimeStream, } from './realtime.js';
import { transcriptionFromConversation, } from './transcription.js';
/**
 * Live analysis over the **Prosody WebSocket** (`WS /v1/stream/realtime`).
 *
 * Opens a direct API session, sends PCM or Opus bytes, and builds a
 * {@link Conversation} from wire events. LiveKit media uses
 * {@link ProsodyClient.livekit}.
 *
 * Apps (including the website demo) supply audio; this class owns start/stop,
 * frame pacing, and the conversation spine.
 */
export class LiveSession {
    _conversation = new Conversation();
    options;
    stream = null;
    _sessionId = null;
    _latestDirective = null;
    _speakerProfiles = [];
    _sessionEnd = null;
    _started = false;
    frameWaiters = [];
    sessionEndWaiters = [];
    constructor(options) {
        if (!options.apiKey)
            throw new Error('LiveSession requires apiKey');
        this.options = options;
    }
    get conversation() {
        return this._conversation;
    }
    get sessionId() {
        return this._sessionId;
    }
    get started() {
        return this._started;
    }
    get latestDirective() {
        return this._latestDirective;
    }
    get speakerProfiles() {
        return this._speakerProfiles;
    }
    get sessionEnd() {
        return this._sessionEnd;
    }
    get readyState() {
        return this.stream?.readyState ?? WebSocket.CLOSED;
    }
    /**
     * Open `WS /v1/stream/realtime` and send the config frame.
     * Resolves on `config_ack`.
     */
    async start(overrides = {}) {
        if (this._started) {
            await this.stop({ waitForSessionEndMs: 0 });
        }
        this._conversation = new Conversation();
        const conversation = this._conversation;
        const defaults = this.options.defaults ?? {};
        const startOpts = { ...defaults, ...overrides };
        this._sessionId = null;
        this._latestDirective = null;
        this._speakerProfiles = [];
        this._sessionEnd = null;
        this.clearFrameWaiters();
        const config = {
            apiKey: this.options.apiKey,
            baseUrl: this.options.baseUrl,
            sessionId: startOpts.sessionId,
            encoding: startOpts.encoding ?? 'pcm16',
            sampleRate: startOpts.sampleRate ?? 16_000,
            container: startOpts.container,
            analysisMode: startOpts.analysisMode,
            source: startOpts.source ?? 'sdk',
            sourceOffsetMs: startOpts.sourceOffsetMs,
            chunkSeconds: startOpts.chunkSeconds ?? 1,
            WebSocketImpl: this.options.WebSocketImpl,
        };
        const stream = new ProsodyRealtimeStream(config, {
            conversation,
            onConfigAck: (event) => {
                const id = typeof event.session_id === 'string' ? event.session_id : null;
                this._sessionId = id;
                this.emitUpdate();
            },
            onDirective: (event) => {
                this._latestDirective = event;
                this.releaseFrameWaiters();
                this.emitUpdate();
            },
            onFrameAck: () => {
                this.releaseFrameWaiters();
            },
            onTranscriptUpdate: () => this.emitUpdate(),
            onSpeakerUpdate: () => this.emitUpdate(),
            onSpeakerProfiles: (event) => {
                if (event.profiles?.length)
                    this._speakerProfiles = event.profiles;
                this.emitUpdate();
            },
            onSessionEnd: (event) => {
                this._sessionEnd = event;
                conversation.apply(event);
                this.resolveSessionEnd(event);
                this.emitUpdate();
            },
            onEvent: (event) => {
                this.options.onEvent?.(event);
            },
            onError: (error) => {
                this.options.onError?.(error);
            },
            onClose: (code, reason) => {
                this._started = false;
                this.releaseFrameWaiters();
                this.resolveSessionEnd(this._sessionEnd);
                this.options.onClose?.(code, reason);
                this.emitUpdate();
            },
            onServerError: (event) => {
                this.options.onError?.(new Error(event.message || 'Realtime stream error'));
            },
        });
        this.stream = stream;
        await stream.connect();
        this._started = true;
        this.emitUpdate();
    }
    /** Send one PCM (or Opus) audio chunk. */
    send(chunk) {
        if (!this.stream)
            throw new Error('LiveSession is not started');
        if (chunk instanceof Int16Array) {
            const view = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
            this.stream.sendAudio(view);
            return;
        }
        this.stream.sendAudio(chunk);
    }
    /**
     * Wait until the server acks the current analysis second (`directive` or
     * `frame_ack`). Used for paced file replay.
     */
    waitForFrame(timeoutMs = 10_000) {
        if (!this._started) {
            return Promise.reject(new Error('LiveSession is not started'));
        }
        return new Promise((resolve, reject) => {
            let timer = 0;
            const release = () => {
                if (timer)
                    clearTimeout(timer);
                resolve();
            };
            timer = setTimeout(() => {
                this.frameWaiters = this.frameWaiters.filter((item) => item !== release);
                reject(new Error('Live analysis timed out'));
            }, timeoutMs);
            this.frameWaiters.push(release);
        });
    }
    /**
     * Ask for `session_end`, wait for it (optional), then close the socket.
     */
    async stop(options = {}) {
        const waitMs = options.waitForSessionEndMs ?? 20_000;
        const stream = this.stream;
        if (!stream) {
            this._started = false;
            return this._sessionEnd;
        }
        let endEvent = this._sessionEnd;
        if (stream.readyState === WebSocket.OPEN) {
            const endPromise = new Promise((resolve) => {
                if (waitMs <= 0) {
                    resolve(this._sessionEnd);
                    return;
                }
                const timer = setTimeout(() => {
                    this.sessionEndWaiters = this.sessionEndWaiters.filter((w) => w !== onEnd);
                    resolve(this._sessionEnd);
                }, waitMs);
                const onEnd = (event) => {
                    clearTimeout(timer);
                    resolve(event);
                };
                this.sessionEndWaiters.push(onEnd);
            });
            stream.end();
            endEvent = await endPromise;
        }
        stream.close();
        this.stream = null;
        this._started = false;
        this.clearFrameWaiters();
        this.emitUpdate();
        return endEvent;
    }
    /** Immediate close without waiting for session_end. */
    close() {
        this.stream?.close();
        this.stream = null;
        this._started = false;
        this.clearFrameWaiters();
        this.resolveSessionEnd(this._sessionEnd);
        this.emitUpdate();
    }
    /** Current turns with the same optional prosody shape as batch transcription. */
    snapshot(options) {
        return transcriptionFromConversation(this._conversation, options);
    }
    emitUpdate() {
        this.options.onUpdate?.(this);
    }
    releaseFrameWaiters() {
        const waiters = this.frameWaiters;
        this.frameWaiters = [];
        for (const release of waiters)
            release();
    }
    clearFrameWaiters() {
        this.frameWaiters = [];
    }
    resolveSessionEnd(event) {
        const waiters = this.sessionEndWaiters;
        this.sessionEndWaiters = [];
        for (const resolve of waiters)
            resolve(event);
    }
}
