import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { flowsRouter } from './routes/flows.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 3001)
const app = express()

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '20mb' }))
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

// API routes
app.use('/api/flows', flowsRouter)

// Serve built React app in production
const clientDist = path.resolve(__dirname, '../../client/dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => res.json({ status: 'ok', mode: 'api-only (no client build)' }))
}

app.listen(PORT, () => {
  console.log(`[scf-server] running on http://localhost:${PORT}`)
})
