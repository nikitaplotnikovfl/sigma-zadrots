import { pino } from 'pino'
import { env } from './env.js'

/**
 * Единый логгер приложения. Используется и Fastify (HTTP-логи), и сборщиком/FACEIT-клиентом.
 * - Уровень управляется LOG_LEVEL (default info).
 * - В dev — человекочитаемый вывод через pino-pretty; в проде — сырой JSON (его собирает Railway).
 */
export const logger = pino({
  level: env.logLevel,
  ...(env.isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
})
