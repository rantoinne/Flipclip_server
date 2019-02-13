var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var followerSchema = new Schema({
  actorId : {
    type : String,
    required :true
  },
  followers : {
    type : Array,
    default : []
  }

});

const Followers = mongoose.model('followers', followerSchema);

module.exports = {Followers}
