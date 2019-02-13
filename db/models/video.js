var mongoose = require('mongoose');
var async = require('async');
var amsapi = require('../../services/amsapi');
var Schema = mongoose.Schema;

var VideoSchema = new Schema({
    userId: {
      type: String,
      required: true
    },
    title:{
        type: String,
        default: '',
        trim: true
    },
    description:{
        type: String,
        default: '',
        trim: true
    },
    streamingUrl:{
        type: String,
        trim: true
    },
    creationTime:{
        type: Date,
        default: Date.now //utc format
    },
    thumbnail:{
        type: String,
        default: '',
        trim: true
    },
    archived:{
      type: Boolean,
      default: false
    },
    likesCount:{
      type: Number,
      default: 0
    },
    dislikesCount:{
      type: Number,
      default: 0
    },
    likes:{
      type: Array,
      default: []
    },
    dislikes:{
      type: Array,
      default: []
    },
    deleted:{
      type: Boolean,
      default: false
    },
    tags:{
      type: Array,
      default: []
    }
});

mongoose.model('Videos', VideoSchema);

var Videos = mongoose.model('Videos');

exports.create = function (data) {
    var video = new Video(data);
    video.save(function(err) {
        if (err) {
            console.log(err);
        } else {
            console.log('success');
        }
    });
}

exports.update = function (query, data) {
    Video.findOneAndUpdate(query, data, {upsert:true}, function(err, video){
        if (err) {
            console.log(err);
        } else {
            console.log(video);
        }
    });
}

exports.list = function(req, res) {
    Video.find().sort('-creationTime').exec(function(err, videos) {
        if (err) {
            return res.status(400).send(err);
        } else {
            res.json(videos);
        }
    });
}

module.exports = {Videos}
