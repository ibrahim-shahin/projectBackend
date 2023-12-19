const express = require('express')
const multer= require('multer')
const path = require('path')
const ffmpeg = require('fluent-ffmpeg');
//get controllers
const {
  createProject,
  getProjects,
  getProject,
  deleteProject,
  updateProject,
  burnProject
} = require('../controllers/projectController')

//middleware
const requireAuth = require('../middleware/requireAuth')
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
})
const upload = multer({ storage: storage })


const Conv = (req, res ,next) => {
  //get the video from the client
  const video = req.file.filename

  const videoPath = `./uploads/${video}`
  const baseName = path.basename(video, path.extname(video));

  // Concatenate the base name with the new extension
  const outputFileName = baseName + '.wav';
  const audioPath = `./uploads/${outputFileName}`
try {
  ffmpeg()
  .input(videoPath)
  .audioCodec('pcm_s16le')
  .toFormat('wav').save(audioPath)
  .on('error', (err) => {
    console.error('Error:', err);
  })
  .on('end', () => {
    console.log('Conversion finished!');
  }).run()
  next()
} catch (error) {
  console.log('error');
}
 
}

const router = express.Router()

// require auth for all project routes
router.use(requireAuth)

// GET all project
router.get('/', getProjects)

//GET a single project
router.get('/:id', getProject)

// POST a new project
router.post('/', upload.single("thumbnail"),Conv, createProject)

// DELETE a project
router.delete('/:id', deleteProject)

// Edit a project
router.patch('/:id', updateProject)

router.get('/burn/:id', burnProject)
module.exports = router