const {mongoose} = require('../mongoose');
const usersSchema = mongoose.Schema({
  // use _id instead of userId
  username : {
    type : String,
    required : true,
    trim : true
  },
  fullname : {
    type : String,
  },
  imageUrl : {
    type : String,
  },
  password : {
    type : String,
    required : true
  },
  email :{
    type : String,
    required : true
  },
  isVerified: { type: Boolean, default: false },
  bio :{
    type : String,
    default : ''
  },
  city : {
    type : String,
    default : null
  },
  gender : {
    type : String
  },
  age : {
    type : Number
  },
  facebookId :{
    type : String
  },
  phone : {
    type : Number,
    default: null
  },
  followersCount : {
    type : Number,
    default : 0
  },
  followingCount : {
    type : Number,
    default : 0
  },
  followers : {
    type : Array,
    default : []
  },
  postsCount : {
    type : Number,
    default : 0
  }
  // create date can be extracted from the _id
});

const Users = mongoose.model('users', usersSchema);

module.exports = {Users}
