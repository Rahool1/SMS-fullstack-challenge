const express = require('express');
const bodyParser = require("body-parser");
const cors = require("cors");

process.setMaxListeners(0);

require('./config/config');


const appRoute = require('./routes/app.route');

const { afterAppInit } = require('./helpers/app.helper');

const app = express()
app.use(cors());
app.use(bodyParser.json({limit:'50mb'}));
app.use(bodyParser.urlencoded({ extended: true ,limit:'50mb'}));

app.use((err, req, res, next) => {

  if(err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      logger.error(err);
      return res.sendStatus(400);
  }
  next();
});

app.use('/', appRoute);

app.get('/', (req, res) => res.send('Welcome to SMS Fullstack Challange!'));


// app.listen(process.env.PORT, () => {
app.listen(8088, () => {
  // logger.info(`SMS app listening on port ${process.env.PORT}!`);
  logger.info(`SMS app listening on port 8088!`);
  // afterAppInit();
});
