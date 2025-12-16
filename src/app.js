require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
app.use(express.json())
app.use(cors())

// Test endpoint
app.get('/', (req, res) => {
  res.send('Smart Campus Backend Running...')
})

// Auth Route Example
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body
  res.json({ message: 'Login working', email })
})

app.listen(4000, () => console.log('Backend running on port 4000'))
