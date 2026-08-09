/** FormData builders for audio uploads. */
/**
 * Build the multipart body for one audio input: a local path, an HTTPS URL
 * (when allowed), or a Buffer.
 */
export async function audioFormData(audio, options = {}) {
    const { filename = 'audio.wav', allowUrl = true } = options;
    const formData = new FormData();
    if (typeof audio === 'string') {
        if (audio.startsWith('http')) {
            if (!allowUrl) {
                throw new Error('This endpoint requires an uploaded audio file');
            }
            formData.append('audio_url', audio);
            return formData;
        }
        const fs = await import('fs');
        const buffer = fs.readFileSync(audio);
        formData.append('file', new Blob([new Uint8Array(buffer)]), filename);
        return formData;
    }
    formData.append('file', new Blob([new Uint8Array(audio)]), filename);
    return formData;
}
