/**
 * Acoustic IPA transcription (`POST /v1/phonetics/ipa`). The phoneme head
 * reads frozen Mimi latents — one 80ms frame, roughly one phoneme — and
 * emits timed IPA segments. Nothing reads a transcript: "nope" versus
 * "mope" is decided by the word-initial nasal's spectrum.
 */

/** One emitted symbol's run on the 80ms grid. */
export interface PhonemeSegment {
  /** The IPA symbol (or a space for a word boundary). */
  ipa: string;
  start_s: number;
  end_s: number;
  /** Mean posterior over the symbol's run. */
  confidence: number;
}

/** The transcription: the IPA string and its timed segments. */
export interface IpaTranscription {
  /** Symbols concatenated within a word, words spaced. */
  ipa: string;
  segments: PhonemeSegment[];
  duration_s: number;
}
