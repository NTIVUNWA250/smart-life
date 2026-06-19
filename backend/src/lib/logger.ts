/* Minimal structured logger. Swap for pino/winston in production if needed. */
type Level = 'info' | 'warn' | 'error' | 'debug';

function log(level: Level, msg: string, meta?: Record<string, unknown>): void {
  const line = { level, msg, time: new Date().toISOString(), ...meta };
  const out = level === 'error' ? console.error : console.log;
  out(JSON.stringify(line));
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
};
