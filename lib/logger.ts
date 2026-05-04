import pino from "pino"

const isServer = typeof window === "undefined"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(isServer && process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
})

/** Create a child logger scoped to a module */
export function createLogger(module: string) {
  return logger.child({ module })
}
