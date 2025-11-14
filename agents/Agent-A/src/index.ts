import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

app.get('/', (c) => c.text('Hello from Yaki!'))

const port = Number(process.env.PORT) || 3000
console.log(`🚀 Server running at http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})

