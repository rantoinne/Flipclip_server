const passport = require('passport');
// for local strategy for sign in
const LocalStrategy = require('passport-local').Strategy;
const {Users} = require('../db/models/users');


passport.use(new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password'
    },
    function (username, password, cb) {
      console.log(username, password)
	const userToLowerCase = username.toLowerCase();	
        //this one is typically a DB call. Assume that the returned user object is pre-formatted and ready for storing in JWT
        return Users.findOne({username : userToLowerCase, password})
           .then(user => {
               if (!user) {
                   return cb( {message: 'Incorrect email or password.'}, false, {message: 'Incorrect email or password.'});
               }

               else if(!user.isVerified) return res.status(401).send({ type: 'not-verified', msg: 'Your account has not been verified.' }); 

               return cb(null, user, {message: 'Logged In Successfully'});
          })
          .catch(err => cb(err));
    }
));

const passportJWT = require("passport-jwt");
const JWTStrategy   = passportJWT.Strategy;
const ExtractJWT = passportJWT.ExtractJwt;

passport.use(new JWTStrategy({
        jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
        secretOrKey   : 'your_jwt_secret'
    },
    function (jwtPayload, cb) {

        //find the user in db if needed. This functionality may be omitted if you store everything you'll need in JWT payload.
        return UserModel.findOneById(jwtPayload.id)
            .then(user => {
                return cb(null, user);
            })
            .catch(err => {
                return cb(err);
            });
    }
));

// Configure the local strategy for use by Passport.
//
// The local strategy require a `verify` function which receives the credentials
// (`username` and `password`) submitted by the user.  The function must verify
// that the password is correct and then invoke `cb` with a user object, which
// will be set at `req.user` in route handlers after authentication.
// passport.use(new Strategy(
//   function(username, password, cb) {
//     // db.users.findByUsername(username, function(err, user) {
//     //   if (err) { return cb(err); }
//     //   if (!user) { return cb(null, false); }
//     //   if (user.password != password) { return cb(null, false); }
//     //   return cb(null, user);
//     // });
//
//     // the local verification code goes here.
//     // get users from table with username,
//     // match the bcrypted password with the stored hash
//     // in case of success , return the user itself
//   }));

  // Configure Passport authenticated session persistence.
  //
  // In order to restore authentication state across HTTP requests, Passport needs
  // to serialize users into and deserialize users out of the session.  The
  // typical implementation of this is as simple as supplying the user ID when
  // serializing, and querying the user record by ID from the database when
  // deserializing.
  passport.serializeUser(function(user, cb) {
    cb(null, user._id);
  });

  passport.deserializeUser(function(_id, cb) {
    // db.users.findById(id, function (err, user) {
    //   if (err) { return cb(err); }
    //   cb(null, user);
    // });

    // write mongo query to get user record by the _id
  });

module.exports = {passport}
