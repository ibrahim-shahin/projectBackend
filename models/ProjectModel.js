const mongoose = require('mongoose')

const Schema = mongoose.Schema

const projectSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true
  },
  subtitle: {
    type: Array,
    default:""
  },
  duration: {
    type: String,
    required: true,
  },
  Language: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default:"Loading"
  },
  user_id: {
    type: String,
    required: true
  }
}, { timestamps: true })

module.exports = mongoose.model('Project', projectSchema)