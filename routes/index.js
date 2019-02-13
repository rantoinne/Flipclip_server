var express = require('express');
var router = express.Router();

// This file is not really needed as of now
// will be used one day if we need a web platform for the same

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
