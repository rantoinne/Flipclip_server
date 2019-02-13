var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var activitySchema = new Schema({
  actorId : {
    type : String,
    required :true
  },
  receiverId : {
    type : String,
    required:false // if some day a self activity is created, this will have to be changed to a false then
  },
  type : {
    type: String, // like dislike, follow, mention , tag these are the various types
    required : true
  },
  creationTime:{
      type: Date,
      default: Date.now
  },
  videoId:{
    type: String,
    required: false // it won't be required in case of follow type of event
  }
});

const Activities = mongoose.model('activities', activitySchema);

module.exports = {Activities}
