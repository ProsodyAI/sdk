export class ProsodyRealtimeStream {
    ws = null;
    apiKey;
    baseUrl;
    options;
    reconnectAttempts = 0;
    maxReconnectAttempts = 3;
    _resolveEnd = null;
    constructor(client, options) {
        this.apiKey = client.apiKey;
        this.baseUrl = client.baseUrl;
        this.options = options || {};
    }
    async connect() {
        return new Promise((resolve, reject) => {
            const wsUrl = this.baseUrl
                .replace('https://', 'wss://')
                .replace('http://', 'ws://');
            this.ws = new WebSocket(`${wsUrl}/v1/stream/realtime`);
            this.ws.binaryType = 'arraybuffer';
            this.ws.onopen = () => {
                this.ws?.send(JSON.stringify({
                    type: 'config',
                    api_key: this.apiKey,
                    language: this.options.language || 'en',
                    vertical: this.options.vertical,
                    session_id: this.options.sessionId,
                    sample_rate: this.options.sampleRate || 16000,
                    encoding: this.options.encoding || 'pcm16',
                    chunk_duration_ms: (this.options.chunkDuration || 3) * 1000,
                }));
                this.reconnectAttempts = 0;
                resolve();
            };
            this.ws.onerror = () => {
                reject(new Error('WebSocket connection failed'));
            };
            this.ws.onclose = (event) => {
                if (event.code === 4001) {
                    this.options.onError?.(new Error('Invalid API key'));
                }
            };
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'directive' || message.type === 'result') {
                        const prosody = message.prosody ?? {};
                        const result = {
                            prediction_id: message.prediction_id || '',
                            session_id: message.session_id,
                            text: message.text ?? '',
                            emotion: {
                                primary: message.emotion ?? 'neutral',
                                confidence: message.confidence ?? 0,
                                probabilities: message.emotion_probabilities || {},
                            },
                            valence: prosody.valence ?? message.valence ?? 0,
                            arousal: prosody.arousal ?? message.arousal ?? 0.5,
                            dominance: prosody.dominance ?? message.dominance ?? 0.5,
                            speaker_id: message.speaker_id,
                            duration: message.duration || 0,
                            word_count: message.text?.split(' ').length || 0,
                            format: 'json',
                            signals: message.signals,
                            kpi_predictions: message.kpi_predictions,
                            alerts: message.alerts,
                            forward_predictions: message.forward_predictions,
                        };
                        this.options.onResult?.(result);
                    }
                    else if (message.type === 'session_end') {
                        if (message.transcript) {
                            const transcript = {
                                session_id: message.session_id ?? message.transcript.session_id,
                                duration_seconds: message.transcript.duration_seconds ?? 0,
                                turns: message.transcript.turns ?? [],
                                segments: message.transcript.segments,
                            };
                            this.options.onTranscript?.(transcript);
                        }
                        this._resolveEnd?.();
                    }
                    else if (message.type === 'escalation_alert') {
                        this.options.onEscalationAlert?.({
                            onset_probability: message.onset_probability,
                            recommended_tone: message.recommended_tone,
                            segment_id: message.segment_id,
                        });
                    }
                    else if (message.type === 'error') {
                        this.options.onError?.(new Error(message.message));
                    }
                }
                catch (e) {
                    this.options.onError?.(e);
                }
            };
        });
    }
    send(samples) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected. Call connect() first.');
        }
        let int16Samples;
        if (samples instanceof Float32Array) {
            int16Samples = new Int16Array(samples.length);
            for (let i = 0; i < samples.length; i++) {
                int16Samples[i] = Math.max(-32768, Math.min(32767, samples[i] * 32768));
            }
        }
        else if (samples instanceof ArrayBuffer) {
            int16Samples = new Int16Array(samples);
        }
        else {
            int16Samples = samples;
        }
        const buf = int16Samples.buffer.slice(int16Samples.byteOffset, int16Samples.byteOffset + int16Samples.byteLength);
        this.ws.send(buf);
    }
    async end() {
        return new Promise((resolve) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                resolve();
                return;
            }
            this._resolveEnd = () => {
                this._resolveEnd = null;
                this.ws?.close();
                resolve();
            };
            this.ws.send(JSON.stringify({ type: 'end' }));
        });
    }
    close() {
        this.ws?.close();
        this.ws = null;
    }
    get isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}
