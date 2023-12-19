const Projects = require('../models/ProjectModel')
const mongoose = require('mongoose')
const { getVideoDurationInSeconds } = require('get-video-duration')
const path = require('path')
const { Translate } = require('@google-cloud/translate').v2;
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { exec } = require('child_process');
const fs = require('fs');


const generateSRT = (transcript) => {
  let counter = 1; // SRT subtitle index counter
  if (transcript && Array.isArray(transcript)) {
    return transcript.map((entry) => {
      const startTime = formatTime(entry.timestamp[0]);
      const endTime = formatTime(entry.timestamp[1]);
      const text = entry.text;

      const subtitleText = `${counter}\n${startTime} --> ${endTime}\n${text}\n\n`;
      counter++;

      return subtitleText;
    }).join('').trim(); // Remove trailing newline
  }
};
const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600
  const minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;
  seconds = seconds.toFixed(3)

  const parts = seconds.toString().split('.')

  if (parts.length == 2) {
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(parts[0])},${parts[1].padEnd(3, '0')}`;
  }

  else
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(parts[0])},000`;

};
const padZero = (num) => {
  return num.toString().padStart(2, '0');
};


// get all projects
const getProjects = async (req, res) => {
  const user_id = req.user._id
  const projects = await Projects.find({ user_id }).sort({ createdAt: -1 })
  res.json(projects)
}

// get a single project
const getProject = async (req, res) => {
  const id = req.params.id

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.json({ error: 'No such id' })
  }

  const project = await Projects.findById(id)

  if (!project) {
    return res.json({
      error: 'No such project'
    })
  }
  res.json(project)
}

// create new project
const createProject = async (req, res) => {
  //get the data needed from the client
  const { link, translang, model } = req.body
  const video = req.file.filename

  // add doc to db
  try {
    //get the user ID to add to the DB
    const user_id = req.user._id

    //video is included not a link
    if (video) {
      //get the video path
      const videoPath = `./uploads/${video}`

      //get the duration of the video in seconds
      var duration = 0
      await getVideoDurationInSeconds(videoPath).then((dur) => {
        duration = dur
      })
      duration = formatTime(duration)
      //first create 
      const currentproject = await Projects.create({
        title: video,
        link: videoPath,
        duration: duration,
        Language: translang,
        user_id: user_id
      })

      //convert the video to wav file and save it
      const baseName = path.basename(video, path.extname(video));
      const outputFileName = baseName + '.wav';
      const audioPath = `./uploads/${outputFileName}`

      //start whisper
      const { initWhisper } = await import('whisper-onnx-speech-to-text');
      const whisper = await initWhisper(model);
      const transcript = await whisper.transcribe(audioPath)
      //delete the audio file
      fs.unlinkSync(audioPath);

      //translate the text
      const translate = new Translate({ key: process.env.apiKey });
      await Promise.all(
        transcript.chunks.map(async (chunk) => {
          chunk.text = await translate.translate(chunk.text, translang)
          chunk.text = chunk.text[0]
        })
      );

      let subs = transcript.chunks
      subs = generateSRT(subs)

      //add the translated text to the database
      await Projects.findById({ _id: currentproject._id }).updateOne({
        title: video,
        link: videoPath,
        subtitle: subs,
        duration: duration,
        Language: translang,
        status: "finished",
        user_id: user_id
      })

      res.status(200).json("project added")
    } else { //if link is prvided not a video
      await project.create({ title, path, subtitle, duration, transLanguage, status, user_id })
      res.status(200).json("project added")
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Error Details:', error);
  }
}

// delete a project
const deleteProject = async (req, res) => {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.json({
      error: 'No such project'
    })
  }

  // Get the project
  const project = await Projects.findById({ _id: id });

  if (!project) {
    return res.json({ error: 'No such project' })
  }

  //delete the video
  if (fs.existsSync(`./uploads/burned${project.title}`)) {
    fs.unlinkSync(`./uploads/burned${project.title}`)
  }
  if (fs.existsSync(`./uploads/${project.title}`)) {
    fs.unlinkSync(`./uploads/${project.title}`)
  }
  
  //Delete the project
  await project.deleteOne();

  res.json(project)
}

// update a project
const updateProject = async (req, res) => {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.json({
      error: 'No such project'
    })
  }

  const { updatedFields } = req.body
  console.log(updatedFields)
  const project = await Projects.findById({ _id: id }).updateOne({ subtitle: updatedFields })

  if (!project) {
    return res.json({ error: 'No such project' })
  }
  res.json(project)
}


const burnProject = async (req, res) => {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.json({
      error: 'No such project'
    })
  }

  const project = await Projects.findById({ _id: id })

  const outputPath = `burned${project.title}`

  // Create a temporary SRT file with the provided subtitle text
  const baseName = path.basename(project.title, path.extname(project.title));
  const tempSubtitlePath = `./uploads/${baseName}.srt`
  fs.writeFileSync(tempSubtitlePath, project.subtitle.join(""));

  console.log(project.title)
  console.log(tempSubtitlePath)
  console.log(outputPath)

  const command = `ffmpeg -y -i uploads/${project.title} -vf "subtitles=${tempSubtitlePath}:force_style='FontName=Arial,FontSize=24,PrimaryColour=&HFF0000,WritingMode=1,rtl'" uploads/${outputPath}`

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      res.json(outputPath)
      fs.unlinkSync(tempSubtitlePath)
      return;
    }
    console.log(`stdout: ${stdout}`);
  });

}


module.exports = {
  getProjects,
  getProject,
  createProject,
  deleteProject,
  updateProject,
  burnProject
}