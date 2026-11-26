/** FormData builders for audio uploads. */

export interface AudioFormOptions {
  filename?: string;
}

/** Whether an audio input names a recording by URL. */
export function isAudioUrl(audio: string | Buffer): audio is string {
  return typeof audio === 'string' && /^https?:\/\//i.test(audio);
}

/**
 * Build the multipart body for one uploaded recording: a local path or a
 * Buffer. A URL is not an upload; the client sends it to the URL route.
 */
export async function audioFormData(
  audio: string | Buffer,
  options: AudioFormOptions = {},
): Promise<FormData> {
  const { filename = 'audio.wav' } = options;
  const formData = new FormData();
  if (typeof audio === 'string') {
    if (isAudioUrl(audio)) {
      throw new Error('This endpoint requires an uploaded audio file');
    }
    const fs = await import('fs');
    const buffer = fs.readFileSync(audio);
    formData.append('file', new Blob([new Uint8Array(buffer)]), filename);
    return formData;
  }
  formData.append('file', new Blob([new Uint8Array(audio)]), filename);
  return formData;
}
