var cfg = require('dotenv').config(); // this line is important!
const env = process.env.NODE_ENV || cfg.parsed.env || 'development';

const config = require("./config.json");
const envConfig = config[env];

console.log(`setting environment variables : ${JSON.stringify(envConfig)}`);

Object.keys(envConfig).forEach((key) => {
  var val = envConfig[key];
  if (typeof envConfig[key] === 'object') {
    val = JSON.stringify(val);
  }
  process.env[key] = val;
});
