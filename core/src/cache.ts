import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getSnapshotsDir } from './storage.ts';
import { logger } from './logger.ts';

const log = logger.child('cache');

interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

function getCacheDir(): string {
	const dir = path.join(getSnapshotsDir(), 'cache');
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	return dir;
}

function getCachePath(key: string): string {
	const hash = crypto.createHash('sha256').update(key).digest('hex');
	return path.join(getCacheDir(), `${hash}.json`);
}

/**
 * Retrieves a value from the file-based cache if it exists and hasn't expired.
 * @param key The unique key for the cache entry.
 * @param ttlMs Time-to-live in milliseconds. If 0, cache is ignored.
 */
export function getCache<T>(key: string, ttlMs: number): T | null {
	if (ttlMs <= 0) return null;

	const filePath = getCachePath(key);
	if (!fs.existsSync(filePath)) return null;

	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		const entry = JSON.parse(content) as CacheEntry<T>;

		const age = Date.now() - entry.timestamp;
		if (age > ttlMs) {
			// Expired, we could delete it here but keeping it simple.
			return null;
		}

		return entry.data;
	} catch (err) {
		log.warn(`Failed to read cache for key ${key}`, { error: err });
		return null;
	}
}

/**
 * Stores a value in the file-based cache.
 * @param key The unique key for the cache entry.
 * @param data The data to store.
 */
export function setCache<T>(key: string, data: T): void {
	const filePath = getCachePath(key);
	const entry: CacheEntry<T> = {
		data,
		timestamp: Date.now(),
	};

	try {
		fs.writeFileSync(filePath, JSON.stringify(entry, null, 2));
	} catch (err) {
		log.error(`Failed to write cache for key ${key}`, { error: err });
	}
}

/**
 * Removes a specific entry from the cache.
 */
export function clearCache(key: string): void {
	const filePath = getCachePath(key);
	if (fs.existsSync(filePath)) {
		try {
			fs.unlinkSync(filePath);
		} catch (err) {
			log.error(`Failed to clear cache for key ${key}`, { error: err });
		}
	}
}
