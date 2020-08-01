const _ = require('lodash');
const logger = require('./../helpers/logger.helper')('secware.controller');
const helper = require('./../helpers/util.helper');
const restHelper = require('./../helpers/rest.api.helper');
const ipTagHelper = require('./../helpers/iptag.helper');
const secwareHelper = require('../helpers/secware.helper');
const radiusHelper = require('../helpers/radius.helper');
const db = require('../db/models');
const model = db.db;
const appRoot = require("app-root-path");
const uploads = appRoot + '/uploads';
const sequelize = require('sequelize');
const Op = sequelize.Op;
const fs = require('fs');
const tokenHelper = require('../helpers/token.helper');

var multer = require('multer');
var storage = multer.diskStorage({ //multers disk storage settings
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    var datetimestamp = Date.now();
    cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1]);
  }
});

var upload = multer({ //multer settings
  storage: storage
}).array('file', 5);


function createUrl(dsl) {
  try {
    // const dslJwt = tokenHelper.generateJwt(dsl, ttl);
    // const encryptedToken = tokenHelper.encryptString(dslJwt);
    const encryptedToken = tokenHelper.createToken(dsl);
    return {
      encryptedToken,
      url: process.env.FRONT_END_URL + encryptedToken
    };
  } catch (error) {
    logger.error(error);
    return false;
  }
}

async function isValidBras(brasname) {
  // validate for active bras list name
  try {
    let bras = await model.active_bras_list.findOne({
      where: {
        bras: brasname
      }
    });
    if (!helper.empty(bras)) {
      logger.info('returning true');
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`failed to check for active brasname`);
    logger.error(error);
    return false;
  }
};

module.exports = {

  async getPackageList(req, res) {
    logger.info(`Fetching package list : ${helper.printObj(req.requestUser)}`);
    try {
      let packageList = await model.Internet_Protect_Plan.findAll();
      res.status(200).send({
        message: 'Package list fetched successfully!!',
        data: packageList,
        status: 'success',
        code: '200'
      });
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Error occurred while retrieving package list',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async createOrder(req, res) {
    logger.info(`Inside create order : ${helper.printObj(req.body)}`);
    try {
      const url = `${process.env.FETCH_REGION_URL}?uid=${req.body.airtelUniqueId}`
      restHelper.rest(url, 'get', null, {}).then(async (resp) => {

        logger.info(`get region api response : ${helper.printObj(resp.body)}`);

        if (resp.statusCode == 200) {
          logger.info(`body : ${helper.printObj(resp.body)} ${typeof resp.body}`);

          if (resp.body.hasOwnProperty('ERR')) {
            res.status(500).send({
              message: resp.body.ERR || 'Error occurred while creating request.',
              data: null,
              status: 'error',
              code: '500'
            });
          } else {
            var region = '';
            var brasname = '';
            if (resp.body.hasOwnProperty('REGION')) {
              region = resp.body.REGION;
            }
            if (resp.body.hasOwnProperty('BRASNAME') && resp.body.BRASNAME != null) {
              brasname = resp.body.BRASNAME.replace(/ /g, '').replace(/_/g, '').replace(/-/g, '');
            }

            if (brasname == null || brasname === '') {
              logger.error(`empty device group found from region api`);
              res.status(500).send({
                message: `empty device group found from region api`,
                data: null,
                status: 'error',
                code: '500'
              });
            } else {
              try {
                 brasname = brasname.toUpperCase();
                let brasValid = await isValidBras(brasname);
                if (!brasValid) {
                  logger.info(`${brasname} is not configured. If configured please add in active bras list table also.`);
                  throw new Error(`Bras ${brasname} is not configured.`);
                }

                var order = await model.Orders.findOne({
                  where: {
                    airtelUniqueId: req.body.airtelUniqueId,
                  },
                  order: [
                    ['createdAt', 'DESC'],
                  ]
                });
          
                logger.info(`last order of dsl ${req.body.airtelUniqueId} : ${helper.printObj(order)}`);
          
                if (order) {
                  order = order.dataValues;
                  if (order.requestType === 'subscribe') {
                    throw new Error(`Subscribe order for ${req.body.airtelUniqueId} is already exists.`);
                  } else if (order.requestType === 'unsubscribe') {
                    var user = await model.Users.findOne({
                      where: { user_id: req.body.airtelUniqueId }
                    });
                    if (user.status === '3') {
                      throw new Error(`Previous unsubscription order for ${req.body.airtelUniqueId} is still in progress.`);
                    }
                  }
                }

                var order = await model.Orders.findOne({
                  where: {
                    airtelUniqueId: req.body.airtelUniqueId,
                  },
                  order: [
                    ['createdAt', 'DESC'],
                  ]
                });
          
                logger.info(`last order of dsl ${req.body.airtelUniqueId} : ${helper.printObj(order)}`);
          
                if (order) {
                  order = order.dataValues;
                  if (order.requestType === 'subscribe') {
                    throw new Error(`Subscribe order for ${req.body.airtelUniqueId} is already exists.`);
                  } else if (order.requestType === 'unsubscribe') {
                    var user = await model.Users.findOne({
                      where: { user_id: req.body.airtelUniqueId }
                    });
                    if (user.status === '3') {
                      throw new Error(`Previous unsubscription order for ${req.body.airtelUniqueId} is still in progress.`);
                    }
                  }
                }

                var plan = await model.Internet_Protect_Plan.findAll({
                  where: {
                    plan_name: req.body.profileType.trim()
                  }
                });

                if (plan.length === 1) {

                  var orders = new model.Orders({
                    region,
                    device_group: brasname,
                    airtelUniqueId: req.body.airtelUniqueId,
                    requestId: req.body.requestId,
                    requestType: req.body.requestType || 'subscribe',
                    productKey: req.body.productKey,
                    profileType: req.body.profileType,
                  });

                  let ttl = 0;
                  if (!helper.empty(req.body.ttl)) {
                    try {
                      ttl = parseInt(req.body.ttl);
                      if (ttl > 60) {
                        ttl = 60;
                      } else if (ttl < 0) {
                        ttl = 0;
                      }  
                    } catch (error) {
                      ttl = 0;
                    }
                  }

                  const urlDetails = createUrl(req.body.airtelUniqueId);
                  const now = new Date();
                  now.setMinutes( now.getMinutes() + ttl );
                  const encrypted_dsl_rec = new model.encrypted_dsl({
                    dsl: req.body.airtelUniqueId,
                    encrypted_dsl: urlDetails.encryptedToken,
                    ip_address: null,
                    valid_till: null,
                    ttl: ttl
                  });

                  await model.sequelize.transaction(async (t) => {
                    await orders.save({
                      transaction: t
                    });
                    await encrypted_dsl_rec.save();
                  });                  

                  req.body.active_plan = plan[0].id;
                  req.params.id = req.body.airtelUniqueId;
                  req.body.frontend_url = urlDetails.url;
                  module.exports.subscribe(req,res);
                } else {
                  res.status(400).send({
                    status: 'error',
                    responseMessage: `${req.body.profileType} is not a valid profile.`,
                    data: null,
                    url: "",
                    code: 400
                  });
                }

              } catch (err) {
                logger.error(`exception while saving order : ${helper.printObj(err)} ${helper.printObj(err.stack)}`);
                var msg;
                if(err.original && err.original.code == 'ER_DUP_ENTRY') {
                  msg = 'Request ID already present.';
                } else {
                  msg = err.message;
                }
                res.status(500).send({
                  message: msg || 'Error occurred while creating request.',
                  data: null,
                  status: 'error',
                  code: '500'
                });
              }
            }
          }
        } else {
          res.status(500).send({
            message: resp.body || 'Error occurred while creating request.',
            data: null,
            status: 'error',
            code: '500'
          });
        }

      }).catch((err) => {
        logger.error(`get region api response : ${helper.printObj(err)}`);
        res.status(500).send({
          message: err.message || 'Error occurred while creating request.',
          data: null,
          status: 'error',
          code: '500'
        });
      });
    } catch (error) {
      console.log('erro msg ; ', error);
      logger.error(`exception : get region api response : ${helper.printObj(error)}`);
      res.status(500).send({
        message: error.message || 'Error occurred while creating request.',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async deleteOrder(req, res) {

    logger.info(`Inside delete order : ${helper.printObj(req.body)}`);

    try {

      var order = await model.Orders.findOne({
        where: {
          airtelUniqueId: req.body.airtelUniqueId,
        },
        order: [
          ['createdAt', 'DESC'],
        ]
      });

      logger.info(`last order of dsl ${req.body.airtelUniqueId} : ${helper.printObj(order)}`);

      if (order) {
        order = order.dataValues;
        if (order.requestType === 'unsubscribe') {
          throw new Error(`Unsubscribe order for ${req.body.airtelUniqueId} is already exists.`);
        } else if (order.requestType === 'subscribe') {
          var user = await model.Users.findOne({
            where: { user_id: req.body.airtelUniqueId }
          });
          if (user.status === '0') {
            throw new Error(`Previous subscription order for ${req.body.airtelUniqueId} is still in progress.`);
          }
        }
      } else {
        throw new Error(`Subscription order for ${req.body.airtelUniqueId} is not found.`);
      }

      const url = `${process.env.FETCH_REGION_URL}?uid=${req.body.airtelUniqueId}`
      restHelper.rest(url, 'get', null, {}).then(async (resp) => {

        logger.info(`get region api response : ${helper.printObj(resp.body)}`);

        if (resp.statusCode == 200) {
          logger.info(`body : ${helper.printObj(resp.body)} ${typeof resp.body}`);

          if (resp.body.hasOwnProperty('ERR')) {
            res.status(500).send({
              message: resp.body.ERR || 'Error occurred while delete request.',
              data: null,
              status: 'error',
              code: '500'
            });
          } else {
            var region = '';
            var brasname = '';
            if (resp.body.hasOwnProperty('REGION')) {
              region = resp.body.REGION;
            }
            if (resp.body.hasOwnProperty('BRASNAME') && resp.body.BRASNAME != null) {
              brasname = resp.body.BRASNAME.replace(/ /g, '').replace(/_/g, '').replace(/-/g, '');
            }

            if (brasname == null || brasname === '') {
              logger.error(`empty device group found from region api`);
              res.status(500).send({
                message: `empty device group found from region api`,
                data: null,
                status: 'error',
                code: '500'
              });
            } else {
              try {
                brasname = brasname.toUpperCase();
                let brasValid = await isValidBras(brasname);
                if (!brasValid) {
                  logger.info(`${brasname} is not configured. If configured please add in active bras list table also.`);
                  throw new Error(`Bras ${brasname} is not configured.`);
                }

                const result = await model.sequelize.transaction(async (t) => {

                  var orders = new model.Orders({
                    airtelUniqueId: req.body.airtelUniqueId,
                    requestId: req.body.requestId,
                    requestType: req.body.requestType || 'unsubscribe',
                    productKey: req.body.productKey,
                    profileType: req.body.profileType,
                    status: 0,
                    device_group: brasname,
                    region
                  });
                  var ordersData = await orders.save({
                    transaction: t
                  });

                  await model.Users.update({
                      status: '3',
                      notification_sent: 'No'
                  },{
                      where: { user_id: req.body.airtelUniqueId },
                      transaction: t
                  });
                  return ordersData;
                });
                var rad_user = radiusHelper.removeUser(req.body.airtelUniqueId);
                res.status(200).send({
                  partnerId: result.airtelUniqueId,
                  requestId: result.requestId,
                  requestType: result.requestType,
                  status: 'Active',
                  responseMessage: 'Delete order received. We will notify you once completed successfully.'
                });
                let status = 1;
          
              } catch (err) {
                res.status(500).send({
                  message: err.message || 'Error occurred while delete request.',
                  data: null,
                  status: 'error',
                  code: '500'
                });
              }
            }
          }
        } else {
          res.status(500).send({
            message: resp.body || 'Error occurred while delete request.',
            data: null,
            status: 'error',
            code: '500'
          });
        }

      }).catch((err) => {
        logger.error(`get region api response : ${helper.printObj(err)}`);
        res.status(500).send({
          message: err.message || 'Error occurred while delete request.',
          data: null,
          status: 'error',
          code: '500'
        });
      });
    } catch (error) {
      console.log('erro msg ; ', error);
      logger.error(`exception : get region api response : ${helper.printObj(error)}`);
      res.status(500).send({
        message: error.message || 'Error occurred while creating request.',
        data: null,
        status: 'error',
        code: '500'
      });
    }

    // logger.info(`Inside delete order : ${helper.printObj(req.body)}`);
    // try {
    //   var orders = new model.Orders({
    //     airtelUniqueId: req.body.airtelUniqueId,
    //     requestId: req.body.requestId,
    //     requestType: req.body.requestType,
    //     productKey: req.body.productKey,
    //     profileType: req.body.profileType,
    //     status: 0
    //   });
    //   var ordersData = await orders.save();

    //   res.status(200).send({
    //     partnerId: ordersData.airtelUniqueId,
    //     requestId: ordersData.requestId,
    //     requestType: ordersData.requestType,
    //     status: 'Active',
    //     responseMessage: 'Delete order received. We will notify you once completed successfully.'
    //   });
    //   let status = 1;

    // } catch (err) {
    //   res.status(500).send({
    //     message: err.message || 'Error occurred while creating request.',
    //     data: null,
    //     status: 'error',
    //     code: '500'
    //   });
    // }
  },


  async subscribe(req, res) {
    try {
      logger.info('Inside Subscribe API');
      var DSL_id = req.params.id;

      var order = await model.Orders.findOne({
        where: {
          airtelUniqueId: DSL_id,
        },
        order: [
          ['createdAt', 'DESC'],
        ]
      });

      logger.info(`last order of dsl ${DSL_id} : ${helper.printObj(order)}`);

      if(order) {
        order = order.dataValues;
        if (order.requestType !== 'subscribe') {
          throw new Error(`Subscribe order for ${DSL_id} is not found.`);
        }
      } else{
        throw new Error(`Order for ${DSL_id} not found.`);
      }

      logger.info(`last order of dsl ${DSL_id} : ${helper.printObj(order)}`);

      let packageList = await model.Internet_Protect_Plan.findAll();

      var planList = _.map(packageList, 'id');

      if (planList.indexOf(parseInt(req.body.active_plan)) >= 0) {

        var preuser = await model.Users.findOne({
          where: { user_id: DSL_id }
        });
        var previous_plan, active_plan, new_plan;
        if (preuser) {
          logger.info(`previous user data : ${helper.printObj(preuser)}`);

          if (parseInt(preuser.dataValues.status) !== 0) {
            previous_plan = preuser.dataValues.previous_plan;
            active_plan = preuser.dataValues.active_plan;
            new_plan = req.body.active_plan;

            if (parseInt(preuser.dataValues.active_plan) === parseInt(req.body.active_plan)) {
              return res.json({
                message: 'Subscribed plan is already active on your profile.',
                data: preuser,
                status: 'success',
                partnerId: order.airtelUniqueId,
                requestId: order.requestId,
                requestType: order.requestType,
                dateActivated: order.createdAt,
                dateFailed: null,
                code: '200'
              }).end('');
            }

            // update user data
            await model.Users.update({
              active_plan: new_plan,
              subscription_date: Date.now(),
              status: '0',
              previous_plan: active_plan,
              notification_sent: 'No',
              device_group: order.device_group
            },
              {
                where: { user_id: DSL_id }
              });
          } else {
            return res.json({
              message: 'Previous subscription request is still in progress!!',
              data: preuser,
              status: 'success',
              partnerId: order.airtelUniqueId,
              requestId: order.requestId,
              requestType: order.requestType,
              dateActivated: order.createdAt,
              code: '201'
            }).end('');
          }

        } else {
          logger.info(`new subscription request of ${DSL_id} in ${order.device_group}.`);
            // creste new user
          var user = new model.Users({
            user_id: DSL_id,
            active_plan: req.body.active_plan || null,
            subscription_date: Date.now(),
            unsubscription_date: null,
            device_group: order.device_group,
            ip: req.body.ip || null,
            status: '0',
            notification_sent: 'No'
          });

          try {
            let newUser = await user.save();
          } catch (error) {
            logger.error(`exception while saving user. so reverting ${DSL_id} dag from ${order.device_group} device group`);
            logger.error(error);
            let deleteAddressGroupResp = await secwareHelper.deleteAddressGroup(DSL_id, order.device_group);
            logger.info(`${DSL_id} dag reverting response : ${helper.printObj(deleteAddressGroupResp)}`);
          }
        }

        try{
          var rad_user = await radiusHelper.addUser(DSL_id);
        } catch (e) {
          logger.error(e);
        }

        var userData = await model.Users.findOne({
          where: { user_id: DSL_id }
        });
        var user = userData.dataValues;
        const url = req.body.frontend_url || "";
        res.status(200).send({
          message: 'User Subscription is in progress!!',
          data: user,
          partnerId: order.airtelUniqueId,
          requestId: order.requestId,
          requestType: order.requestType,
          dateActivated: order.createdAt,
          url: url,
          status: 'success',
          code: '200',
          partnerId: order.airtelUniqueId,
          requestId: order.requestId,
          requestType: order.requestType,
          dateActivated: order.createdAt
        }); 
      } else {
        res.status(400).send({
          message: 'Invalide plan selected',
          data: {},
          status: 'failed',
          code: '400'
        });
      }
    } catch (err) {
      logger.error(err);
      var msg = '';
      if(err.original && err.original.code == 'WARN_DATA_TRUNCATED') {
        msg = 'Please provide valid plan details.';
      } else if (err.message) {
        msg = err.message;
      } else {
        msg = err;
      }
      logger.error(`error is : ${msg}`);
      res.status(500).send({
        message: msg || 'Error occurred while subscribing user!!',
        data: err.data || null,
        status: 'error',
        code: '500'
      });
    }
  },

  async getProvisionStatus(req, res) {
    logger.info(`Inside Get Provisioning Status API : ${helper.printObj(req.params)}`);
    try {
      let id = req.params.id;
      // console.log('id ', id);
      let provisionStatus = await model.Users.findOne({ where: { user_id: id } });
      console.log('Pro', provisionStatus);
      if(provisionStatus) {
        let stat = { status: provisionStatus.dataValues.status };
        res.status(200).send({
          message: 'Provision Status fetched successfully!!',
          data: stat.status,
          status: 'success',
          code: '200'
        });
      } else {
        throw new Error("User doesn't exist");
      }
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Error occurred while retrieving Provisioning Status!!',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async setProvisionStatus(req, res) {
    logger.info(`Inside Set Provisioning Status API : ${helper.printObj(req.requestUser)}`);
    try {
      // let id = req.params.id;
      var body = req.body;
      // console.log('provisiong body : ', JSON.stringify(body, null, 2));

      if (body.errorCode === 0 || body.errorCode === '') {
        let status;
        let provisionStatus = await model.Users.findOne({ where: { user_id: body.dsl } });
        // console.log('provision', provisionStatus);
        if (provisionStatus.dataValues.status == '0') {
          status = '1';
        }
        else if (provisionStatus.dataValues.status == '3') {
          status = '-1';
        }
        let result = await model.Users.update({
          activated_at: Date.now(),
          status: status
        },
          { where: { user_id: body.dsl } });

        res.status(200).send({
          dsl: body.dsl,
          requestId: body.requestId,
          status: 'Complete',
          message: 'Huawei Provisioned',
          code: '200',
          source: 'Homeshub',
        });
      } else {
        res.status(500).send({
          dsl: body.dsl,
          requestId: body.requestId,
          status: 'Failure',
          message: 'Huawei Provision Failed',
          code: '500',
          source: 'Homeshub'
        });
      }

    } catch (err) {
      res.status(500).send({
        dsl: req.body.dsl,
        requestId: req.body.requestId,
        status: 'Failure',
        message: 'Huawei Provision Failed',
        code: '500',
        source: 'Homeshub'
      });
    }
  },

  async getBlockedCategory(req, res) {
    logger.info(`Inside Get Blocked Category API : ${helper.printObj(req.requestUser)}`);
    try {
      let categoryName = req.params.name;
      let categoryData = await model.Blocked_category.findOne({
        where: { internet_protect_plan: categoryName }
      });
      categoryData.blocked_category = categoryData.blocked_category.split(',');
      res.status(200).send({
        message: 'Blocked category fetched successfully!!',
        data: categoryData,
        status: 'success',
        code: '200'
      });
    } catch (e) {
      res.status(500).send({
        message: err.message || 'Error occurred while retrieving Blocked Category Data!!',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async getPackageInfo(req, res) {
    logger.info(`Inside Get Package Info API : ${helper.printObj(req.requestUser)}`);
    try {
      let id = req.params.id;
      let users = await model.Users.findOne({ where: { user_id: id } });
      if (users) {
        let plan = users.dataValues.active_plan;
        let plan_status = users.dataValues.status;
        let planInfo = await model.Internet_Protect_Plan.findOne({ where: { id: plan } });
        let planData = { planInfo, plan_status: plan_status };
        res.status(200).send({
          message: 'Package Info fetched successfully!!',
          data: planData,
          status: 'success',
          code: '200'
        });
      } else {
        res.status(200).send({
          message: 'User doesn\'t exist',
          data: null,
          status: 'error',
          code: '404'
        });
      }
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Error occurred while retrieving Package Info.',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async saveAllowUrl(req, res) {
    logger.info(`Inside Save Allow URL API : ${helper.printObj(req.requestUser)}`);
    try {
      if (req.params.id) {
        let userData = await model.Allowed_url.update(
          { url: req.body.url },
          { where: { user_id: req.body.user_id } });
        res.status(200).send({
          message: 'Allow URL updated successfully!!',
          data: userData,
          status: 'success',
          code: '200'
        });
      } else {
        let AllowUrl = new model.Allowed_url({
          user_id: req.body.user_id,
          url: req.body.url || null
        });
        let userData = await AllowUrl.save();
        res.status(200).send({
          message: 'Allow URL created successfully!!',
          data: userData,
          status: 'success',
          code: '200'
        });
      }
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Error occurred while creating allow URL',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async getAllowUrl(req, res) {
    logger.info(`Inside Get Allow URL API : ${helper.printObj(req.requestUser)}`);
    try {
      let id = req.params.id;
      let allowedURL = await model.Allowed_url.findOne({
        where: {
          user_id: id
        }
      });
      allowedURL.url = allowedURL.url.split(',');
      res.status(200).send({
        message: 'Allow URL fetched successfully!!',
        data: allowedURL,
        status: 'success',
        code: '200'
      });
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Error occurred while fetching allow URL!!',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async unsubscribe() {
    logger.info(`Inside Unsubscribe API`);
    process.env.QUEUE_STATUS = "FETCHING UNSUBSCRIPTION USERS";
    var reqUsers = await secwareHelper.unsubscribeUsers();
    process.env.QUEUE_STATUS = "FETCHED UNSUBSCRIPTION USERS";
    logger.info(`Unsubscribe user data: ${helper.printObj(reqUsers)}`)
    try {
      var DSL_ids = _.map(reqUsers, 'airtelUniqueId');
      await model.Users.update(
        { status: '3', unsubscription_date: Date.now(), notification_sent: 'No' },
        {
          where: { user_id: DSL_ids }
        });
      var unsubscribedData = await model.Users.findAll({
        where: { user_id: DSL_ids }
      });

      unsubscribedData = unsubscribedData.map(function (user) { return user.dataValues });
      var groupByActivePlan = _.mapValues(_.groupBy(unsubscribedData, 'active_plan'),
        ulist => ulist.map(data => _.omit(data, 'active_plan')));

      process.env.QUEUE_STATUS = "REMOVING DYNAMIC ADDRESS GROUP FROM POLICIES";
      let updateDAGresp = await secwareHelper.unsubscribeUserPolicies(DSL_ids, groupByActivePlan);
      process.env.QUEUE_STATUS = "REMOVED DYNAMIC ADDRESS GROUP FROM POLICIES";
      
      if (updateDAGresp['status'] === 'success') {
        process.env.QUEUE_STATUS = "UPDATING ORDER STATUS OF ALL UNSUBSCRIPTION";
        await model.Orders.update({ status: 1 }, { where: { airtelUniqueId: DSL_ids } });
        process.env.QUEUE_STATUS = "REMOVING DYNAMIC ADDRESS GROUP FROM PANORAMA";
        await secwareHelper.removeAddressGroup(reqUsers);
        process.env.QUEUE_STATUS = "REMOVED DYNAMIC ADDRESS GROUP FROM PANORAMA";
        return updateDAGresp;
      }
      else {
        throw new Error(updateDAGresp);
      }

    } catch (err) {
      return {
        message: err.message || 'Error occurred while unsubscribing User!!',
        data: null,
        status: 'error',
        code: '500'
      };
    }
  },

  async getUserCount(req, res) {
    logger.info(`Inside Get User Count API : ${helper.printObj(req.requestUser)}`);
    try {
      let subscribed_users = await model.Users.findAll({
        attributes: ['subscription_date',
          [sequelize.fn('count', sequelize.col('subscription_date')), 'count']],
        where: {
          [Op.or]: [
            {
              subscription_date: {
                [Op.gt]: sequelize.col('unsubscription_date')
              }
            },
            {
              unsubscription_date: {
                [Op.eq]: null
              }
            }
          ]
        },
        group: ["subscription_date"],
        raw: true
      });
      let unsubscribed_users = await model.Users.findAll({
        attributes: ['unsubscription_date',
          [sequelize.fn('count', sequelize.col('unsubscription_date')), 'count']],
        where: {
          subscription_date: {
            [Op.lt]: sequelize.col('unsubscription_date')
          }
        },
        group: ["unsubscription_date"],
        raw: true
      });
      res.status(200).send({
        message: 'Internet Plans subscription status fetched successfully',
        data: { subscribed_users: subscribed_users, unsubscribed_users: unsubscribed_users },
        status: 'success',
        code: '200'
      });
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Error occurred while getting User Count!!',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async getMalCount(req, res) {
    logger.info(`Inside Get Malware Count API : ${helper.printObj(req.requestUser)}`);
  },

  async genReport(req, res) {
    logger.info(`Inside Generate Report API : ${helper.printObj(req.requestUser)}`);
  },

  async updateIp(req, res) {
    logger.info(`Inside Update IP API : ${helper.printObj(req.requestUser)}`);
    try {
      let id = req.params.id;
      let userData = await model.Users.update(
        { ip: req.body.ip }, { where: { id: id } });
      res.status(200).send({
        message: 'User IP updated successfully!!',
        data: userData,
        status: 'success',
        code: '200'
      })
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Error occurred while updating user IP',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async updateDSLIp(req, res) {
    logger.info(`Inside Update IP API`);
    try {
      let resp = await ipTagHelper.updateIpTag(req);
      res.status(200).send({
        message: 'User IP updated successfully!!',
        data: resp,
        status: 'success',
        code: 200
      });
    } catch (err) {
      res.status(500).send({
        message: err.msg || 'Error occurred while updating user IP',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async notifyAirtel(req, res) {
    logger.info(`Inside Notify Airtel API : ${helper.printObj(req.requestUser)}`);
    try {
      let notificationStatus = req.params.status;
      let id = req.params.id;
      if (notificationStatus == 0) {
        var status = -1;
        var unsubscription_date = Date.now();
        var subscription_date = null;
        var active_plan = null;
      }
      else {
        var status = 0;
        var unsubscription_date = null;
        var subscription_date = Date.now();
        var active_plan = req.body.active_plan;
      }
      let user = await model.Airtel_notify.findOne({
        where: { user_id: id }
      });
      if (user) {
        let userData = await model.Airtel_notify.update(
          {
            active_plan: active_plan,
            subscription_date: subscription_date,
            status: status,
            unsubscription_date: unsubscription_date,
            user_id: id
          }, { where: { user_id: id } });
        res.status(200).send({
          message: 'User IP updated successfully!!',
          data: userData,
          status: 'success',
          code: '200'
        });
      } else {
        let user = new model.Airtel_notify({
          id: req.body.id,
          user_id: id,
          name: req.body.name,
          mobile: req.body.mobile || null,
          username: req.body.username || null,
          passcode: req.body.passcode || null,
          active_plan: req.body.active_plan || 'null',
          previous_plan: req.body.previous_plan,
          subscription_date: subscription_date,
          unsubscription_date: unsubscription_date,
          activated_at: req.body.activated_at,
          device_group: req.body.device_group || 'device_group',
          ip: req.body.ip || null,
          status: status
        });
        let userData = await user.save();
        res.status(200).send({
          message: 'User Notified successfully!!',
          data: userData,
          status: 'success',
          code: '200'
        });
      }
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Error occurred while updating user IP',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async userInfo(req, res) {
    logger.info(`Inside User Info API`);
    console.log('>>>>>>>>>>>>>>>>>', process.env.FRONT_END_URL, process.env.COMMIT_INTERVAL, process.env.AIRTEL_THANKS_URL);
    try {
      let id = req.params.id;
      let userData = await model.Users.findOne({
        where: {
          user_id: id,
          status: {
            [Op.not]: '-1'
          }
        }
      });
      logger.info(`user data : ${helper.printObj(userData)}`);
      if(userData) {
        let localUserData = userData.dataValues;
        let planDetails = await model.Internet_Protect_Plan.findOne({
          where: { id: localUserData.active_plan }
        });
        logger.info(`plan data: ${helper.printObj(planDetails)}`);
        let blockedDetails = await model.Blocked_category.findOne({
          where: { internet_protect_plan: planDetails.plan_name }
        });
        let ip = await model.iptag.findOne({
          where: { tag:userData.user_id }
        });
        let ipaddress = '';
        if(ip){
          ipaddress = ip.ip;
        }
        logger.info(`ip: ${helper.printObj(ip)}`);
        logger.info(`blocked policy data: ${helper.printObj(blockedDetails)}`);
        let data = {
          id: localUserData.id,
          userId: localUserData.user_id,
          plan: planDetails.plan_name,
          previous_plan: localUserData.previous_plan,
          active_plan: localUserData.active_plan,
          status: localUserData.status,
          ip:ipaddress,
          blocked_categories: blockedDetails.blocked_category.split(',')
        };
        res.status(200).send({
          message: 'User Info fetched successfully!!',
          data: data,
          status: 'success',
          code: '200'
        });
      } else {
        throw new Error("User doesn't exist");
      }
    } catch (err) {
      let dslData = await model.Orders.findAll({
        where: { airtelUniqueId: req.params.id },
        order: [
          ['createdAt', 'DESC']
        ],
        limit: 1
      });
      logger.info(`dsl data: ${helper.printObj(dslData)}`);
      if (dslData && dslData !== null && dslData.length == 1) {
        dslData = dslData[0];
        
        if (dslData.requestType === 'subscribe') {
          res.status(200).send({
            message: 'User DSLID fetched successfully!!',
            data: dslData,
            status: 'success',
            code: '200'
          });
        } else {
          dslData.status = '-1';
          res.status(200).send({
            message: err.message || 'Error occurred while fetching New User\'s plan!!',
            data: null,
            data: dslData,
            url: process.env.AIRTEL_THANKS_URL,
            status: 'error',
            code: '200'
          });
        }
      }
      else {
        res.status(200).send({
          message: err.message || 'Error occurred while fetching New User\'s plan!!',
          data: null,
          url: process.env.AIRTEL_THANKS_URL,
          status: 'error',
          code: '404'
        });
      }
    }
  },
  async initUserStatus(req, res) {
    logger.info(`Inside User Info API : ${helper.printObj(req.requestUser)}`);
    try {
      let id = req.params.id;
      // console.log('id', id);
      // update user data
      await model.Users.update({
        unsubscription_date: null,
        status: '2'
      }, {
          where: { user_id: id }
        });
      res.status(200).send({
        message: 'User status updated successfully!!',
        status: 'success',
        code: '200'
      });
    } catch (err) {
      res.status(404).send({
        message: err.message || 'Error occurred while fetching New User\'s plan!!',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async policySettings(req, res) {
    logger.info(`Inside policy settings `);

    var path = '';
    upload(req, res, async function (err) {
      if (err) {
        res.status(500).send({
          message: "Error uploading file.",
          data: null,
          status: 'error',
          code: '500'
        });
      }

      var body = JSON.parse(req.body['form']);
      try {
        let notify_url = body.notify_url;
        let commit_interval = body.commit_interval;
        let airtel_thanks_url = body.airtel_thanks_url;
        let front_end_url = body.front_end_url;
        let faq = body.faq;
        let tandc = body.tandc;

        var faqData = new model.FAQs({
          faq: body.faq,
          tandc: body.tandc
        });
        await faqData.save();

        fs.readFile('./src/config/config.json', 'utf-8', (err, data) => {
          if (err) throw err;
          console.log('TYpe of data is:', typeof data);
          typeof (data)
          var policyData = JSON.parse(data);

          var cfg = require('dotenv').config(); // this line is important!
          const env = process.env.NODE_ENV || cfg.parsed.env || 'development';

          policyData[env].FRONT_END_URL = front_end_url;
          policyData[env].COMMIT_INTERVAL = commit_interval;
          policyData[env].AIRTEL_THANKS_URL = airtel_thanks_url;
          policyData[env].AIRTEL_NOTIFICATION.API = notify_url;

          process.env['COMMIT_INTERVAL'] = commit_interval;
          process.env['FRONT_END_URL'] = notify_url;
          process.env['AIRTEL_THANKS_URL'] = airtel_thanks_url;
          var airtelNotification = JSON.parse(process.env.AIRTEL_NOTIFICATION);
          airtelNotification.API = notify_url;
          process.env['AIRTEL_NOTIFICATION'] = JSON.stringify(airtelNotification);

          console.log('Updated data is:', policyData);
          console.log('TYpe of policy data is:', typeof policyData);
          try {
            fs.writeFileSync('./src/config/config.json', JSON.stringify(policyData, null, 2));
            console.log('inside try', process.env);

          } catch (err) {
            console.log('inside catch', err);
          }
          // fs.writeFileSync()

          console.log('File data is:', data);
        });

        var files = body.deleteImages;
        files.forEach(function (filepath) {
          deleteFiles(filepath);
        });

        console.log('After Update');
        console.log(process.env.COMMIT_INTERVAL, process.env.FRONT_END_URL, process.env.AIRTEL_THANKS_URL);

        var policySettings = await body.policyArr.forEach((ele) => {
          console.log('I am inside policy', ele);
          var policy = model.Internet_Protect_Plan.findOne({
            where: { plan_name: ele.planName }
          });
          //  console.log('Policy', policy);
          if (policy) {

            allowed_policy = ele.allowedPolicy;
            blocked_policy = ele.blockedPolicy;
            price = ele.price;
            // update policy data
            var profileData = model.Internet_Protect_Plan.update({
              allowed_policy: allowed_policy,
              blocked_policy: blocked_policy,
              price: price >= 0 ? price : 0 
            },
              {
                where: { plan_name: ele.planName }
              });
          }
        });
        // console.log(ordersData);
        res.status(200).send({
          message: 'Policy settings saved successfully!!',
          data: policySettings,
          status: 'success',
          code: '200'
        });
        // let status = 1;

      } catch (err) {
        res.status(500).send({
          message: err.message || 'Error occurred while retrieving package list',
          data: null,
          status: 'error',
          code: '500'
        });
      }
    });

  },

  async getFAQ(req, res) {
    logger.info(`Getting FAQ list : ${helper.printObj(req.requestUser)}`);
    try {
      let FAQList = await model.FAQs.findAll();
      res.status(200).send({
        message: 'FAQ list fetched successfully!!',
        data: FAQList,
        status: 'success',
        code: '200'
      });
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Error occurred while retrieving FAQs list',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async getConfigData(req, res) {
    logger.info(`Getting Config data list : ${helper.printObj(req.requestUser)}`);
    try {
      let FAQ_TandC = await model.FAQs.findAll();
      console.log(FAQ_TandC);

      res.status(200).send({
        message: 'FAQ list fetched successfully!!',
        data: {
          faq: FAQ_TandC, commit: process.env.COMMIT_INTERVAL, notify: JSON.parse(process.env.AIRTEL_NOTIFICATION).API,
          front: process.env.FRONT_END_URL, thanks: process.env.AIRTEL_THANKS_URL, thanks_ios: process.env.AIRTEL_THANKS_URL_IOS, thanks_android: process.env.AIRTEL_THANKS_URL_ANDROID
        },
        status: 'success',
        code: '200'
      });
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Error occurred while retrieving FAQs list',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },
  
  async getReport(req, res) {
    logger.info(`Getting Reports for : ${req.params.id}`);
    try {
      var query = `SELECT * FROM elk_reporting.user_report where user_id='${req.params.id}'`;
      var report = await model.sequelize.query(query,{ type: model.Sequelize.QueryTypes.SELECT });

      res.status(200).send({
        message: 'Report data fetched successfully!!',
        data: report,
        status: 'success',
        code: '200'
      });
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Error occurred while retrieving FAQs list',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  },

  async getUrl(req, res) {
    try {
      const dsl = req.query.dsl;

      var order = await model.Orders.findOne({
        where: {
          airtelUniqueId: dsl,
        },
        order: [
          ['createdAt', 'DESC'],
        ]
      });

      if (order) {
        order = order.dataValues;
        if (order.requestType.toLowerCase() !== 'subscribe') {
          return res.send({
            url: '',
            error: `Subscribe order for ${dsl} is not found.`
          });
        }
      } else {
        return res.send({
          url: '',
          error: `Subscribe order for ${dsl} is not found.`
        });
      }

      let ttl = 0;
      if (!helper.empty(req.query.ttl)) {
        try {
          ttl = parseInt(req.query.ttl);
          if (ttl > 60) {
            ttl = 60;
          } else if (ttl < 0) {
            ttl = 0;
          }  
        } catch (error) {
          ttl = 0;
        }
      }
      const urlDetails = createUrl(dsl);
      logger.info(`url details ${helper.printObj(urlDetails)}`);
      const now = new Date();
      now.setMinutes( now.getMinutes() + ttl );
      const encrypted_dsl_rec = new model.encrypted_dsl({
        dsl,
        encrypted_dsl: urlDetails.encryptedToken,
        ip_address: null,
        valid_till: null,
        ttl: ttl
      });
      logger.info(` dsl rec : ${helper.printObj(encrypted_dsl_rec)}`);
      await encrypted_dsl_rec.save();

      if (urlDetails) {
        res.send({
          url: urlDetails.url
        });
      } else {
        res.status(500).send({
          message: 'Error occurred while creating encrypted url',
          data: null,
          status: 'error',
          code: '500'
        });
      }
    } catch (error) {
      res.status(500).send({
        message: error.message || 'Error occurred while creating encrypted url',
        data: null,
        status: 'error',
        code: '500'
      });
    }
  }

};

function deleteFiles(filename) {
  return new Promise(function (resolve, reject) {
    fs.unlink(uploads + '/' + filename, function (err) {
      if (err)
        reject(err);
      else
        resolve();
    });
  });
}
