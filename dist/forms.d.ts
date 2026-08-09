/** FormData builders for audio uploads. */
export interface AudioFormOptions {
    filename?: string;
    /** When true, an `http(s)` string becomes an `audio_url` field. */
    allowUrl?: boolean;
}
/**
 * Build the multipart body for one audio input: a local path, an HTTPS URL
 * (when allowed), or a Buffer.
 */
export declare function audioFormData(audio: string | Buffer, options?: AudioFormOptions): Promise<FormData>;
