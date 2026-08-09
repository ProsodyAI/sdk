export function normalizeSpeakerId(id) {
    const value = (id ?? '').trim();
    return value || 'unknown';
}
export function isKnownSpeaker(id) {
    return normalizeSpeakerId(id) !== 'unknown';
}
export function overlapMs(startA, endA, startB, endB) {
    return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}
