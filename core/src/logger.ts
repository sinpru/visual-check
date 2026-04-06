import fs from 'node:fs';
import path from 'node:path';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVELS: Record<LogLevel, number> = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
};

const COLORS = {
	reset: '\x1b[0m',
	debug: '\x1b[36m', // cyan
	info: '\x1b[32m', // green
	warn: '\x1b[33m', // yellow
	error: '\x1b[31m', // red
};

class Logger {
	private level: number;
	private logFile: string | null = null;

	constructor() {
		const envLevel =
			(process.env.LOG_LEVEL?.toUpperCase() as LogLevel) || 'INFO';
		this.level = LOG_LEVELS[envLevel] ?? LOG_LEVELS.INFO;

		// Ensure snapshots/logs directory exists if we have a SNAPSHOTS_DIR
		const snapshotsDir = process.env.SNAPSHOTS_DIR;
		if (snapshotsDir) {
			const logsDir = path.resolve(snapshotsDir, 'logs');
			try {
				if (!fs.existsSync(logsDir)) {
					fs.mkdirSync(logsDir, { recursive: true });
				}
				// Use BUILD_ID for the log filename if available, otherwise 'latest.log'
				const buildId = process.env.BUILD_ID || 'latest';
				this.logFile = path.join(logsDir, `${buildId}.log`);
			} catch (err) {
				console.error(
					`[logger] Failed to initialize logs directory: ${err}`,
				);
			}
		}
	}

	private formatMessage(
		level: LogLevel,
		namespace: string,
		message: string,
	): string {
		const timestamp = new Date().toISOString();
		return `[${timestamp}] ${level.padEnd(5)} [${namespace}] ${message}`;
	}

	private writeToConsole(
		level: LogLevel,
		formatted: string,
		...args: any[]
	): void {
		const color =
			COLORS[level.toLowerCase() as keyof typeof COLORS] || COLORS.reset;
		console.log(`${color}${formatted}${COLORS.reset}`, ...args);
	}

	private writeToFile(formatted: string, ...args: any[]): void {
		if (!this.logFile) return;
		const extra =
			args.length > 0
				? ' ' +
					args
						.map((a) =>
							typeof a === 'object'
								? JSON.stringify(a, null, 2)
								: String(a),
						)
						.join(' ')
				: '';
		try {
			fs.appendFileSync(this.logFile, formatted + extra + '\n');
		} catch (err) {
			// Silent fail on file write error to avoid infinite loops
		}
	}

	debug(namespace: string, message: string, ...args: any[]): void {
		if (this.level > LOG_LEVELS.DEBUG) return;
		const formatted = this.formatMessage('DEBUG', namespace, message);
		this.writeToConsole('DEBUG', formatted, ...args);
		this.writeToFile(formatted, ...args);
	}

	info(namespace: string, message: string, ...args: any[]): void {
		if (this.level > LOG_LEVELS.INFO) return;
		const formatted = this.formatMessage('INFO', namespace, message);
		this.writeToConsole('INFO', formatted, ...args);
		this.writeToFile(formatted, ...args);
	}

	warn(namespace: string, message: string, ...args: any[]): void {
		if (this.level > LOG_LEVELS.WARN) return;
		const formatted = this.formatMessage('WARN', namespace, message);
		this.writeToConsole('WARN', formatted, ...args);
		this.writeToFile(formatted, ...args);
	}

	error(namespace: string, message: string, ...args: any[]): void {
		if (this.level > LOG_LEVELS.ERROR) return;
		const formatted = this.formatMessage('ERROR', namespace, message);
		this.writeToConsole('ERROR', formatted, ...args);
		this.writeToFile(formatted, ...args);
	}

	/**
	 * Creates a namespaced logger instance.
	 */
	child(namespace: string) {
		return {
			debug: (msg: string, ...args: any[]) =>
				this.debug(namespace, msg, ...args),
			info: (msg: string, ...args: any[]) =>
				this.info(namespace, msg, ...args),
			warn: (msg: string, ...args: any[]) =>
				this.warn(namespace, msg, ...args),
			error: (msg: string, ...args: any[]) =>
				this.error(namespace, msg, ...args),
		};
	}
}

export const logger = new Logger();
