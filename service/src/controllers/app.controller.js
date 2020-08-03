
const appHelper = require('../helpers/app.helper');

module.exports = {
  async read(req, res) {
    console.log(req.query.start_date);
    console.log(req.query.end_date);
    //date filter logic
    try {
      let data = await appHelper.getCities();
      res.status(200).send({
        message: 'Cities data',
        data: data,
        status:true
      });
    } catch (err) {
      res.status(500).send({
        message: err.message,
      });
    }
  },
  async create(req, res) {
    console.log(`create`);
    try {
      console.log(req.body);
      let data = await appHelper.addCities(req.body);
      console.log(data);
      res.json({data:data,status:true})
    } catch (err) {
      res.status(500).send({
        message: err.message,
      });
    }
  },
  async update(req, res) {
    let id=req.params.id;
    let update=req.body;
     let data = await appHelper.updateCity(id,req.body);
     res.json({status:true,data:data})

    try {
    } catch (err) {
      res.status(500).send({
        message: err.message,
      });
    }
  },
  async delete(req, res) {
    let ids=req.body;
    let data = await appHelper.deleteCities(ids);
    res.json({status:true,data:data})
    try {
    } catch (err) {
      res.status(500).send({
        message: err.message,
      });
    }
  }
}