const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://flipclip:OP4GAeqFOUOA9qZiU2ESzbOBxfGlCXcAuKqiJ8m8PhkGfzqvrcsZz89Cuw3oGyJo7SvTuejYFQA3HPiMOC7KTQ%3D%3D@flipclip.documents.azure.com:10255/?ssl=true&replicaSet=globaldb').then(() => console.log('mongo connection successful'))
  .catch((err) => console.error(err));

module.exports = {mongoose};
