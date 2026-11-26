/** FormData builders for audio uploads. */
export interface AudioFormOptions {
    filename?: string;
}
/** Whether an audio input names a recording by URL. */
export declare function isAudioUrl(audio: string | Buffer): audio is string;
/**
 * Build the multipart body for one uploaded recording: a local path or a
 * Buffer. A URL is not an upload; the client sends it to the URL route.
 */
export declare function audioFormData(audio: string | Buffer, options?: AudioFormOptions): Promise<FormData>;
