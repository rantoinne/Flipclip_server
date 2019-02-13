var compression = require('compression');
const multer = require('multer');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const async = require('async');
var fs = require('fs');
var os = require('os');
var bodyParser = require('body-parser');
const logger = require('morgan');
const {Users} = require('./db/models/users');
const {Videos} = require('./db/models/video');
const {Activities} = require('./db/models/activity');
const {passport} = require('./middleware/passport');
const {secret} = require('./config/secret');
const AWS = require('aws-sdk');
const {BUCKET_NAME, IAM_USER_KEY, IAM_USER_SECRET} = require('./config/config');
const Busboy = require('busboy');
const {waterfall}=require('async/waterfall');
var ffmpeg = require('ffmpeg');
const { execFile } = require('child_process');
const { Token } = require('./db/models/emailToken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

var app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(compression());
const client = require('twilio')(
  'AC3128a9062e2f3dd8e8f847b7497e2445',
  '0977ff0f88df7dbb3471b454f8cfbbb9'
);

app.post('/sendInvite', (req,res) => {
  req.body.phoneNumbers.map(phone => {
  client.messages.create({
    from: '+17073773547',
    to: phone,
    body: `${req.body.username} invited you to download flipClip!`
    })
  })
  return res.status(200).json({message:'SMS sent successfully'});
})

app.post('/register', (req,res) => {
    var busboy = new Busboy({ headers: req.headers });
    var name = '';
    const formData = {};
    var imageUrl = '';
  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    var saveTo = path.join('.', filename);
    console.log('Uploading: ' + saveTo);
    file.pipe(fs.createWriteStream(saveTo));
    name = filename;
  });
  busboy.on('field', (fieldname, value) => {
	if(fieldname == 'username')
		formData[fieldname] = value.toLowerCase();
	else
        	formData[fieldname] = value;
    });
  busboy.on('finish', function() {
    fs.readFile(name, function(err, data) {
      if(err){
        var newUser = new Users (formData);
        newUser.save().then((result) => {
            res.send(result);
            }, (error) => {
            // handle the error here
            res.status(400).json({erro : error});
          });
      }
       else {
        uploadToS3(data, name, function(response){
        formData['imageUrl'] = response.Location;
        var newUser = new Users (formData);
        newUser.save().then((result) => {
            res.send(result);

            //email auth
            var token = new Token({ _userId: newUser._id, token: crypto.randomBytes(16).toString('hex') });
            
            var transporter = nodemailer.createTransport({ service: 'Sendgrid', 
                                                           auth: { 
                                                             user: process.env.SENDGRID_USERNAME, 
                                                             pass: process.env.SENDGRID_PASSWORD 
                                                            } 
                                                          });

            var mailOptions = { from: 'no-reply@flipclip.com', 
                                to: newUser.email, 
                                subject: 'Account Verification Token', 
                                text: 'Hello,\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + token.token + '.\n' 
                              };
                          
            transporter.sendMail(mailOptions, function (err) {
                                                if (err) { return res.status(500).send({ msg: err.message }); }
                                                
                                                res.status(200).send('A verification email has been sent to ' + newUser.email + '.');
                                });

            }, (error) => {
            // handle the error here
            res.status(400).json({erro : error});
          });
      });
    }
    });
  });
  return req.pipe(busboy);
});

app.post('/login', (req, res) => {
  passport.authenticate('local', {session: false}, (err, user, info) => {
        if (err || !user) {
          console.log('error condtion', err);
            return res.status(400).json({
                message: 'Something is not right',
                user   : user
            });
        }

       req.login(user, {session: false}, (err) => {
           if (err) {
               res.send(err);
           }
           // generate a signed son web token with the contents of user object and return it in the response
           const token = jwt.sign({user: user}, secret);
           return res.json({user, token});
        });
    })(req, res);
    console.log('exiting login');
});

app.post('/userInfo', (req, res) => {
  if(req.body.userId){
    Users.find({_id: req.body.userId},{password:0},
    function(err, docs){
        if(err){
          console.log(err)
          return err;
        }
        return res.send(docs);
    })
  }
})

app.post('/changePassword', (req, res) => {
  //var query = {username: req.body.username, password: req.body.password}
  Users.update({username: req.body.username, password: req.body.password} ,
    { $set: { password: req.body.newPassword }},
    function(err, numberAffected) {
    if(err){
      console.log(err)
      return err;
    }
    console.log(numberAffected);
    if(numberAffected.nModified > 0)
      return res.status(200).json({message:'Password updated successfully'});
    else {
      return res.status(400).json({message:'Incorrect current password'});
    }
})
})

app.post('/editProfile',(req, res)=>{
  var busboy = new Busboy({ headers: req.headers });
  var name = '';
  const formData = {};
  var imageUrl = '';
busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
  var saveTo = path.join('.', filename);
  console.log('Uploading: ' + saveTo);
  file.pipe(fs.createWriteStream(saveTo));
  name = filename;
});
busboy.on('field', (fieldname, value) => {
      formData[fieldname] = value;
  });
busboy.on('finish', function() {
  fs.readFile(name, function(err, data) {
    if(err){
      Users.update({_id: formData['userId']} ,
      { $set:
        formData
      },
      function(err, numberAffected){
        if(err){
          console.log(err)
          return err;
        }
        if(numberAffected.nModified > 0)
          return res.status(200).json({message:'Profile updated successfully', editedProfile: formData});
        else {
          return res.status(400).json({message:'Something went wrong'});
        }
      })
    }
    else {
	console.log("formData",formData)
      uploadToS3(data, name, function(response){
      formData['imageUrl'] = response.Location;
      Users.update({_id: formData['userId']},
      { $set:
        formData
      },
      function(err, numberAffected){
        if(err){
          console.log(err)
          return err;
        }
        if(numberAffected.nModified > 0)
          return res.status(200).json({message:'Profile updated successfully', editedProfile: formData});
        else {
          return res.status(400).json({message:'Something went wrong'});
        }
      })
    });}
  });
});
return req.pipe(busboy);
});

function uploadToS3(file, name, callback) {
  let s3bucket = new AWS.S3({
    accessKeyId: IAM_USER_KEY,
    secretAccessKey: IAM_USER_SECRET,
    Bucket: 'flipclipmedia'
  });
  s3bucket.createBucket(function () {
      var params = {
        Bucket: 'flipclipmedia',
        Key: name,
        Body: file,
	      ACL:'public-read'
      };
      s3bucket.upload(params, function (err, data) {
        if (err) {
          console.log('error in callback', err);
        }
        return callback(data);
      });
  });
}

app.post('/upload',(req, res)=>{
  var busboy = new Busboy({ headers: req.headers });
  var name = {};
  const formData = {};
  var userId = '';
  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    var saveTo = path.join('.', filename);
    console.log('Uploading: ' + saveTo);
    file.pipe(fs.createWriteStream(saveTo));
    name[fieldname] = filename;
  });
  busboy.on('field', (fieldname, value) => {
      console.log(fieldname, value)
        formData[fieldname] = value;
    });
  busboy.on('finish', function() {
    async.waterfall([
      function(callback) {

          execFile('ffmpeg', [
            '-i', name['video'],
            '-vcodec', 'h264',
            '-b:v', '512k',
            '-acodec', 'copy',
            'videos/'+name['video']
          ], function(error, stdout, stderr) {
            if(error)
              console.log("error while compressing",error)
            else {
              fs.readFile(path.join('./videos',name['video']), function(err, data) {
              uploadToS3(data, name['video'], function(response){
                  console.log("video url", response.Location)
                  callback(null, response.Location)
              })
            })
          }
          })
          // fs.readFile(name['video'], function(err, data) {
          //   uploadToS3(data, name['video'], function(response){
          //       callback(null, response.Location)
          //   })
          // })

          // uploadToS3(data, name['video'], function(response){
          //     console.log("video url", response.Location)
          //     callback(null, response.Location)
          // })
      },
      function(videoUrl, callback) {
        fs.readFile(name['thumbnail'], function(err, data) {
          uploadToS3(data, name['thumbnail'], function(response){
            var video = new Videos ({
              ...formData,
              streamingUrl: videoUrl,
              thumbnail: response.Location
            });

        video.save().then((result) => {
        },(error) => {
		          console.log(error)
          });
        Users.update({_id: formData['userId']},
          { $inc: { postsCount: 1 }},
          function(err, numberAffected){
            if(err){
              console.log(err)
              return err;
            }
            if(numberAffected.nModified > 0)
              console.log("successfully incremented posts count");
            else {
              console.log("Something went wrong to increment posts");
            }
          })
          callback(null,response)
      })
    })
  }
    ], function(err, result){
        res.send(result)
        })
      });
      return req.pipe(busboy);
    });

app.post('/follow', (req, res) => {
  Users.update({ _id: req.body.followedId, followers: {"$ne":req.body.userId}},
    { $addToSet: { followers: req.body.userId }, $inc: {followersCount: 1}},
    function(err, numberAffected){
      if(err){
        console.log(err)
        return err;
      }
      if(numberAffected.nModified > 0){
        Users.update({ _id: req.body.userId },
          { $inc : {followingCount: 1} },
          function(err, numberAffected) {
            if(err){
              console.log(err)
              return err;
            }
            if(numberAffected.nModified > 0)
            return res.status(200).json({message:'followed successfully'});
            else {
              return res.status(400).json({message:'something went wrong'});
            }
          })
      var message = 'followed successfully';
    }
      else {
      return res.status(400).json({message:'something went wrong'});
      }
    })
    })

app.post('/unFollow', (req, res) => {
  Users.update({ _id: req.body.unFollowedId, followers:req.body.userId},
    { $pull: { followers: req.body.userId }, $inc: { followersCount: -1 }},
    function(err, numberAffected) {
      if(err){
        console.log(err)
        return err;
      }
      if(numberAffected.nModified > 0){
        Users.update({ _id: req.body.userId },
          {$inc : {followingCount: -1}  },
          function(err, numberAffected) {
            if(err){
              console.log(err)
              return err;
            }
            if(numberAffected.nModified > 0)
            return res.status(200).json({message:'unfollowed successfully'});
            else {
              return res.status(400).json({message:'something went wrong'});
            }
          })
      }
      else {
        return res.status(200).json({message:'unfollowed successfully'});
      }
    })

    })

app.post('/followersList', (req, res) => {
  var result = [];
  //var query = {username: req.body.username, password: req.body.password}
  Users.findOne(
    { _id: req.body.userId },
    { followers : 1, _id : 0},
    function(err, docs) {
      if(err){
        return res.status(400).json({message:'something went wrong'});
      }
      if(docs){
      Users.find({_id:{
        $in: docs.followers
      }},
      {username: 1, _id: 1, imageUrl: 1, followers: 1},
      function(err, docs) {
        if(err){
          return res.status(400).json({message:'something went wrong'});
        }
        for(var i = 0; i < docs.length; i++){
          if(docs[i].followers.includes(req.body.userId))
              result.push({username: docs[i].username, imageUrl: docs[i].imageUrl, userId: docs[i]._id, following: true})
          else {
            result.push({username: docs[i].username, imageUrl: docs[i].imageUrl, userId: docs[i]._id, following: false})
          }
        }
        return res.send(result)
      }
      )}
    })
  })

app.post('/followingList', (req, res) => {
  //var query = {username: req.body.username, password: req.body.password}
  Users.find(
    {followers : req.body.userId},
    {username: 1, imageUrl: 1, _id: 1},
    function(err, docs) {
    if(err){
      console.log(err)
      return res.status(400).json({message:'something went wrong'});
    }
    return res.send(docs);
})
})

app.post('/displayNewVideos', (req, res) => {
	console.log(req.body)
  var result = []
  async.waterfall([
    function(callback) {
      Videos.find({dislikes: {"$ne":req.body.userId}, likes:{"$ne": req.body.userId}, archived:false}).sort('-creationTime').exec(function(err, videos) {
        if (err) {
          callback("could not fetch videos",null);
        } else {
          callback(null, videos);
        }
      })
    },
    function(videos, callback) {
      var users = [];
      for(let i=0; i < videos.length; i++){
	if(videos[i].userId && videos[i].userId != 'undefined')
         users.push(videos[i].userId)
      }
        Users.find({_id:{$in: users}},
          {username: 1, _id: 1, imageUrl: 1, followers: 1},
          function(err, docs){
            if(err)
            console.log(err)
            else{
              for(let i=0; i < videos.length; i++){
		if(videos[i].userId != 'undefined')
                for(let j=0; j < docs.length; j++){
		if(videos[i].userId == docs[j]._id)
                  if(videos[i].userId == req.body.userId)
                      result.push({_id:videos[i]._id, streamingUrl: videos[i].streamingUrl, thumbnail: videos[i].thumbnail, creationTime: videos[i].creationTime, description: videos[i].description ,userId: videos[i].userId, username: docs[j].username, userProfilePic: docs[j].imageUrl, likesCount: videos[i].likesCount, followingUser: "self"});

	          else if(docs[j].followers.includes(req.body.userId))
                    result.push({_id:videos[i]._id, streamingUrl: videos[i].streamingUrl, thumbnail: videos[i].thumbnail, creationTime: videos[i].creationTime, description: videos[i].description ,userId: videos[i].userId, username: docs[j].username, userProfilePic: docs[j].imageUrl, likesCount: videos[i].likesCount, followingUser: true});
                  else {
                    result.push({_id:videos[i]._id, streamingUrl: videos[i].streamingUrl, thumbnail: videos[i].thumbnail, creationTime: videos[i].creationTime, description: videos[i].description ,userId: videos[i].userId, username: docs[j].username, userProfilePic: docs[j].imageUrl, likesCount: videos[i].likesCount, followingUser: false});
                  }
                }
              }
              callback(null, result);
            }
          }
        )
    }
], function (err, result) {
  if(err){
    console.log(err)
    return res.status(400).json({message:'something went wrong'});
  }
    return res.send(result)
    // result now equals 'done'
});
})

app.post('/displayPopularVideos', (req, res) => {
  var result = []
  async.waterfall([
    function(callback) {
      Videos.find({dislikes: {"$ne":req.body.userId}, archive: false})
      .where('likesCount').gt(3)
      .sort('-likesCount')
      .exec(function(err, videos) {
        if (err) {
          callback(err,null);
        } else {
          callback(null, videos);
        }
      })
    },
    function(videos, callback) {
      var users = [];
      for(let i=0; i < videos.length; i++){
        users.push(videos[i].userId)
      }
        Users.find({_id:{$in: users}},
          {username: 1, _id: 1, imageUrl: 1, followers: 1},
          function(err, docs){
            if(err)
            console.log(err)
            else{
              for(let i=0; i < videos.length; i++){
                for(let j=0; j < docs.length; j++){
                  if(videos[i].userId == docs[j]._id)
                    if(videos[i].userId == req.body.userId)
                      result.push({_id:videos[i]._id, streamingUrl: videos[i].streamingUrl, thumbnail: videos[i].thumbnail, creationTime: videos[i].creationTime, description: videos[i].description ,userId: videos[i].userId, username: docs[j].username, userProfilePic: docs[j].imageUrl, likesCount: videos[i].likesCount, followingUser: "self"});
                    else if(docs[j].followers.includes(req.body.userId))
                      result.push({_id:videos[i]._id, streamingUrl: videos[i].streamingUrl, thumbnail: videos[i].thumbnail, creationTime: videos[i].creationTime, description: videos[i].description ,userId: videos[i].userId, username: docs[j].username, userProfilePic: docs[j].imageUrl, likesCount: videos[i].likesCount, followingUser: true});
                    else {
                      result.push({_id:videos[i]._id, streamingUrl: videos[i].streamingUrl, thumbnail: videos[i].thumbnail, creationTime: videos[i].creationTime, description: videos[i].description ,userId: videos[i].userId, username: docs[j].username, userProfilePic: docs[j].imageUrl, likesCount: videos[i].likesCount, followingUser: false});
                    }
                }
              }
              callback(null, result);
            }
          }
        )
    }
], function (err, result) {
  if(err){
    console.log(err)
    return res.status(400).json({message:'something went wrong'});
  }
    return res.send(result)
    // result now equals 'done'
});
})

app.post('/displayLikedVideos', (req, res) => {
  var result = []
  async.waterfall([
    function(callback) {
      Activities.find({actorId:req.body.userId, type:"like"}).sort('-creationTime').exec(function(err, activities) {
        if (err) {
          callback("could not fetch videos",null);
        } else {
          callback(null, activities);
        }
      })
    },
    function(activities, callback){
      if(activities.length > 0){
      var videos = [];
      for(let i=0; i < activities.length; i++){
        videos.push(activities[i].videoId)
      }
      Videos.find({_id:{$in: videos}}).exec(function(err, videos){
        if (err) {
          callback("could not fetch videos",null);
        } else {
          callback(null, videos);
        }
      });
    }
      else
        callback(null, [])
    },
    function(videos, callback){
      var users = [];
      for(let i=0; i < videos.length; i++){
        users.push(videos[i].userId)
      }
        Users.find({_id:{$in: users}},
          {username: 1, _id: 1, imageUrl: 1, followers: 1},
          function(err, docs){
            if(err)
            console.log(err)
            else{
              for(let i=0; i < videos.length; i++){
                for(let j=0; j < docs.length; j++){
                  if(videos[i].userId == docs[j]._id)
		    if(videos[i].userId == req.body.userId)
                      result.push({_id:videos[i]._id, streamingUrl: videos[i].streamingUrl, thumbnail: videos[i].thumbnail, creationTime: videos[i].creationTime, description: videos[i].description ,userId: videos[i].userId, username: docs[j].username, userProfilePic: docs[j].imageUrl, likesCount: videos[i].likesCount, followingUser: "self"});
                    else if(docs[j].followers.includes(req.body.userId))
                      result.push({_id:videos[i]._id, streamingUrl: videos[i].streamingUrl, thumbnail: videos[i].thumbnail, creationTime: videos[i].creationTime, description: videos[i].description ,userId: videos[i].userId, username: docs[j].username, userProfilePic: docs[j].imageUrl, likesCount: videos[i].likesCount, followingUser: true});
                    else {
                      result.push({_id:videos[i]._id, streamingUrl: videos[i].streamingUrl, thumbnail: videos[i].thumbnail, creationTime: videos[i].creationTime, description: videos[i].description ,userId: videos[i].userId, username: docs[j].username, userProfilePic: docs[j].imageUrl, likesCount: videos[i].likesCount, followingUser: false});
                    }
                }
              }
              callback(null, result);
            }
          }
        )
    }
], function (err, result) {
  if(err){
    console.log(err)
    return res.status(400).json({message:'something went wrong'});
  }
    return res.send(result)
    // result now equals 'done'
});
})

app.post('/displaySelfVideos', (req, res) => {
  var result = []
  Videos.find({userId:req.body.userId, archived: false}).sort('-creationTime').exec(function(err, videos) {
      if (err) {
          return res.status(400).send(err);
      } else {
        Users.findOne({_id: req.body.userId},
        {username: 1, _id: 1, imageUrl: 1}, function(err, docs){
            if(err)
            console.log(err)
            else{
              console.log("docssss", docs)
              for(let i=0; i < videos.length; i++){
                  if(videos[i].userId == docs._id)
                    result.push({_id:videos[i]._id, streamingUrl: videos[i].streamingUrl, thumbnail: videos[i].thumbnail, creationTime: videos[i].creationTime, description: videos[i].description, userId: videos[i].userId, username: docs.username, userProfilePic: docs.imageUrl ,likesCount: videos[i].likesCount});
                }
                res.json(result);
              }
        })
      }
  });
})

app.post('/displayArchivedVideos', (req, res) => {
  var result = []
  Videos.find({userId:req.body.userId, archived: true}).sort('-creationTime').exec(function(err, videos) {
      if (err) {
          return res.status(400).send(err);
      } else {
        Users.findOne({_id: req.body.userId},
        {username: 1, _id: 1, imageUrl: 1}, function(err, docs){
            if(err)
            console.log(err)
            else{
              for(let i=0; i < videos.length; i++){
                  if(videos[i].userId == docs._id)
                    result.push({_id:videos[i]._id, streamingUrl: videos[i].streamingUrl, thumbnail: videos[i].thumbnail, creationTime: videos[i].creationTime, description: videos[i].description, userId: videos[i].userId, username: docs.username, userProfilePic: docs.imageUrl ,likesCount: videos[i].likesCount});
                }
                res.json(result);
              }
        })
      }
  });
})

app.post('/likeVideo', (req, res) => {
  //var query = {username: req.body.username, password: req.body.password}
  var activity = new Activities ({
    actorId: req.body.userId,
    videoId: req.body.videoId,
    type: "like"
  });

activity.save().then((result) => {
},(error) => {
    console.log(error)
});
  Videos.update(
    {_id : req.body.videoId},
    {$addToSet: {likes: req.body.userId}, $inc:{likesCount: 1}},
    function(err, numberAffected) {
      if(err){
        console.log(err)
        return err;
      }
      if(numberAffected.nModified > 0)
        return res.status(200).json({message:'video liked successfully'});
      else {
        return res.status(400).json({message:'Incorrect current password'});
      }
})
})

app.post('/dislikeVideo', (req, res) => {
  //var query = {username: req.body.username, password: req.body.password}
  Videos.update(
    {_id : req.body.videoId, archived: false},
    {$addToSet: {dislikes: req.body.userId}, $inc:{dislikesCount: 1}},
    function(err, numberAffected) {
      if(err){
        console.log(err)
        return err;
      }
      if(numberAffected.nModified > 0)
        return res.status(200).json({message:'video disliked successfully'});
      else {
        return res.status(400).json({message:'Incorrect current password'});
      }
})
})

app.post('/deleteVideo', (req, res) => {
  //var query = {username: req.body.username, password: req.body.password}
  Videos.update(
    {_id : req.body.videoId, userId: req.body.userId},
    {deleted: true},
    function(err, numberAffected) {
      if(err){
        return err;
      }
      if(numberAffected.nModified > 0)
        return res.status(200).json({message:'video deleted successfully'});
      else {
        return res.status(400).json({message:'Incorrect current password'});
      }
})
})

app.post('/execute', (req, res) => {
  //var query = {username: req.body.username, password: req.body.password}
  Videos.remove({}).exec();
  Users.remove({}).exec();
  Activities.remove({}).exec();
})

app.post('/archiveVideo', (req, res) => {
  //var query = {username: req.body.username, password: req.body.password}
  Videos.update(
    {_id : req.body.videoId, userId: req.body.userId, archived: false},
    {archived: true},
    function(err, numberAffected) {
      if(err){
        console.log(err)
        return err;
      }
      if(numberAffected.nModified > 0)
        return res.status(200).json({message:'video archived successfully'});
      else {
        return res.status(400).json({message:'something went wrong'});
      }
})
})

app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.end();
  console.log('error handler end', err);
});

module.exports = app;
