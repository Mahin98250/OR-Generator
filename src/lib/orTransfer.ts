import { clearSession, countChunks, getChunkIndexes, getChunks, getSession, putChunk, putSession } from './sessionStore';

export const OR_TRANSFER_PREFIX = 'ORX1:';
export const OR_TRANSFER_CHUNK_CHARS = 1500;
// High-speed optical transfer: each displayed frame can carry multiple independent QR symbols.
// Keep optical payloads comfortably below QR version 40-L capacity so phone cameras have more decoding margin.
export const OR_TRANSFER_GRID_SIZE = 4;
export const OR_TRANSFER_MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_TRANSFER_FRAMES = 150000;
