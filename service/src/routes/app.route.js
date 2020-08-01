const express = require("express");
const bodyParser = require("body-parser");
const appController = require("../controllers/app.controller");

router.use(bodyParser.json());

router.get("/get", appController.get);

module.exports = router;