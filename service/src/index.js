const express = require('express');
const bodyParser = require("body-parser");
const cors = require("cors");
const cfg = require('dotenv').config();
process.setMaxListeners(0);
const PORT=process.env.PORT || 3001

const appRoute = require('./routes/app.route');
const db = require('./db/models');

const { afterAppInit } = require('./helpers/app.helper');

const app = express()
app.use(cors());
app.use(express.json({limit:'50mb'}));

app.use((err, req, res, next) => {
  if(err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.sendStatus(400);
  }
  next();
});

process.on('uncaughtException', function (err) {
  console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
  console.error(err.stack)
  process.exit(1)
})

app.use('/', appRoute);

app.get('/', (req, res) => res.send('Welcome to SMS Fullstack Challange!'));


app.listen(PORT, () => {
  // logger.info(`SMS app listening on port ${process.env.PORT}!`);
  console.log(`SMS app listening on port ${PORT}!`);
  // afterAppInit();
});
