var cfg = require('dotenv').config();

const env = process.env.NODE_ENV ||  cfg.parsed.env || 'development';
const config = require(__dirname + '/config.json')[env];


module.exports = config;