import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req: Request, res: Response) => {
  res.send('Smart Campus Backend (TypeScript) running...')
})

app.listen(4000, () => {
  console.log('Backend running on port 4000')
})
