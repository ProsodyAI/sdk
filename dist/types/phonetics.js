/**
 * Acoustic IPA transcription (`POST /v1/phonetics/ipa`). The phoneme head
 * reads frozen Mimi latents — one 80ms frame, roughly one phoneme — and
 * emits timed IPA segments. Nothing reads a transcript: "nope" versus
 * "mope" is decided by the word-initial nasal's spectrum.
 */
export {};
