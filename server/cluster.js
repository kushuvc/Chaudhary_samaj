import cluster from 'node:cluster'
import { availableParallelism } from 'node:os'

const WORKERS = process.env.WEB_CONCURRENCY
  ? Number(process.env.WEB_CONCURRENCY)
  : Math.min(availableParallelism(), 4) // cap at 4 to avoid DB connection explosion

if (cluster.isPrimary) {
  console.log(`[Cluster] Primary ${process.pid} starting ${WORKERS} workers`)

  for (let i = 0; i < WORKERS; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`[Cluster] Worker ${worker.process.pid} died (code=${code} signal=${signal}), restarting...`)
    cluster.fork()
  })
} else {
  // Each worker runs the full Express app
  await import('./index.js')
  console.log(`[Cluster] Worker ${process.pid} started`)
}
