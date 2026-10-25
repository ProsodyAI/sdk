import type { ProsodyEvent } from './types.js';
type EventInput = string | Uint8Array | ArrayBuffer | Record<string, unknown>;
export declare function parseProsodyEvent(input: EventInput): ProsodyEvent;
export {};
