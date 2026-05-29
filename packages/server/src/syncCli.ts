import { syncSource } from './sync.js'
import { prisma } from './db.js'
import { logger } from './logger.js'

const r = await syncSource()
logger.info({ result: r }, 'sync cli finished')
await prisma.$disconnect()
