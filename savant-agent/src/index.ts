import { startBot } from './bot'
import { log, logError } from './utils/log'

log('savant agent starting...')

startBot()
  .then(() => log('bot login complete'))
  .catch((err) => {
    logError('fatal: bot failed to start', err)
    process.exit(1)
  })

process.on('unhandledRejection', (err) => {
  logError('unhandled rejection', err)
})

process.on('SIGINT', () => {
  log('shutting down...')
  process.exit(0)
})
