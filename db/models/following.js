var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var followingSchema = new Schema({
  actorId : {
    type : String,
    required :true
  },
  following : {
    type : Array,
    default : []
  }

});

const Following = mongoose.model('following', followingSchema);

module.exports = {Following}
