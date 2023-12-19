require('dotenv').config()
const cors = require('cors')
const express = require('express')
const mongoose = require('mongoose')
const projectsRoutes = require('./routes/projects')
const userRoutes = require('./routes/user')

// express app
const app = express()

// middleware
app.use(express.json())
app.use(cors());
app.use((req, res, next) => {
  console.log(req.path, req.method)
  next()
})
app.use("/uploads",express.static("uploads"))
// routes
app.use('/api/projects', projectsRoutes)
app.use('/api/user', userRoutes)

// connect to db
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    // listen for requests
    app.listen(process.env.PORT, () => {
      console.log('connected to db & listening')
    })
  })
  .catch((error) => {
    console.log(error)
  })