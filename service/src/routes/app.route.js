const express = require("express");
const appController = require("../controllers/app.controller");

const router = express.Router();
router.get("/cities", appController.read);
router.post("/cities", appController.create);
router.put("/city/:id", appController.update);
router.delete("/cities", appController.delete);

module.exports = router;