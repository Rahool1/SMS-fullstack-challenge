const db = require('./../db/models');
const {Op} =require('sequelize')


module.exports = {
  async getCities() {
    try {
      return await db.City.findAll({});
    } catch (err) {
      throw new Error(err);
    }
  },
  async addCities(city) {
    try {
      return await db.City.bulkCreate(city);
    } catch (err) {
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
    try {
      return await db.City.destroy({
        where:{
          id: {
          [Op.in]: ids
        }
      }});
    } catch (err) {
       throw new Error(err);
    }
  }
}