export class ProsodyRealtimeStream {
    ws = null;
    apiKey;
    baseUrl;
    options;
    reconnectAttempts = 0;
    maxReconnectAttempts = 3;
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
            this.ws = new WebSocket(`${wsUrl}/v1/stream/realtime?api_key=${this.apiKey}`);
            this.ws.onopen = () => {
                this.ws?.send(JSON.stringify({
                    type: 'config',
                    language: this.options.language || 'en',
                    vertical: this.options.vertical,
                    session_id: this.options.sessionId,
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
                        // API sends "directive" with VAD nested under `prosody`;
                        // accept both shapes for forward compat.
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
        const bytes = new Uint8Array(int16Samples.buffer);
        const base64 = btoa(String.fromCharCode(...bytes));
        this.ws.send(JSON.stringify({
            type: 'audio',
            data: base64,
        }));
    }
    async end() {
        return new Promise((resolve) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                resolve();
                return;
            }
            const ws = this.ws;
            const originalOnMessage = ws.onmessage;
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'end_ack') {
                    ws.close();
                    resolve();
                }
                else {
                    originalOnMessage?.call(ws, event);
                }
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
