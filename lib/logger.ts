import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

// No pino transport/worker threads — they break under Next.js webpack bundling.
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  formatters: {
    level(label) {
      return { level: label }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
})

export function createChildLogger(name: string, extra?: Record<string, unknown>) {
  return logger.child({ module: name, ...extra })
}
