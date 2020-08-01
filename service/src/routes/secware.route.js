const express = require("express");
const bodyParser = require("body-parser");
const secwareController = require("../controllers/secware.controller");
const policyController = require("../controllers/policy.controller");
const {
  authenticate, asyncValidateDSL
} = require("../helpers/auth.middleware");
const router = express.Router();

router.use(bodyParser.json());

router.get("/getPackageList", secwareController.getPackageList);
router.post("/subscribe/:id", asyncValidateDSL('params', 'id'), secwareController.subscribe);
router.get("/getProvisionStatus/:id", asyncValidateDSL('params', 'id'), secwareController.getProvisionStatus);
router.put("/statusUpdate", secwareController.setProvisionStatus);
router.get("/getBlockedCategory/:name", secwareController.getBlockedCategory);
router.get("/getPackageInfo/:id", asyncValidateDSL('params', 'id'), secwareController.getPackageInfo);
router.post("/saveAllowUrl/:id", asyncValidateDSL('params', 'id'), secwareController.saveAllowUrl);
router.get("/getAllowUrl/:id", asyncValidateDSL('params', 'id'), secwareController.getAllowUrl);
// router.post("/unsubscribe", secwareController.unsubscribe);
router.get("/getUserCount", secwareController.getUserCount);
router.get("/getMalCount", secwareController.getMalCount);
router.get("/genReport", secwareController.genReport);
router.put("/updateIp/:id", asyncValidateDSL('params', 'id'), secwareController.updateIp);
router.put("/updateDSLIp", secwareController.updateDSLIp);
router.put("/notify/:status/:id", asyncValidateDSL('params', 'id'), secwareController.notifyAirtel);
router.get("/userInfo/:id", asyncValidateDSL('params', 'id'), secwareController.userInfo);
router.get("/userOperationInfo/:id", secwareController.userInfo);
router.put("/userInfo/:id", asyncValidateDSL('params', 'id'), secwareController.initUserStatus);
router.post("/createOrder", secwareController.createOrder);
router.post("/deleteOrder", secwareController.deleteOrder);
router.put("/settings", authenticate, secwareController.policySettings);
router.get("/policy-login", policyController.policyLogin);
router.get("/getFAQ", secwareController.getFAQ);
router.get("/getConfigData", secwareController.getConfigData);
router.get("/slider-images", policyController.settingsImages);
// router.get("/report/:id", asyncValidateDSL('params', 'id'), secwareController.getReport);
router.get("/report/:id", secwareController.getReport);
router.get("/getUrl", secwareController.getUrl);

module.exports = router;