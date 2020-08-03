const db = require('./../db/models');
const {Op} =require('sequelize')


module.exports = {
  async getCities() {
    console.log(`get`);
        console.log(1)
    try {
        let cities = await db.City.findAll({});
        return cities;
    } catch (err) {
        console.log(err)

    }
  },
  async addCities(city) {
    console.log(`addCities`);
    try {
      let cities = await db.City.bulkCreate(city);
      return cities;
    } catch (err) {
      console.log("err",err)
      throw new Error(err);
    }
  },
  async updateCity(id,city) {
    console.log(`get`);
    
    try {
      return await db.City.update(city,{where:{id:id}});

    } catch (err) {
      throw new Error(err);
    }
  },
  async deleteCities(ids) {
    console.log(`get`,ids);
    try {
       return await db.City.destroy(
         {where:{
            id: {
            [Op.in]: ids
        }
         }});


    } catch (err) {
       throw new Error(err);
    }
  }
}