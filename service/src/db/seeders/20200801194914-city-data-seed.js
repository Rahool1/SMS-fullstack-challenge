'use strict';

const data = require('../data.json')
module.exports = {
  up: async (queryInterface, Sequelize) => {
    
    await queryInterface.bulkInsert('Cities', data, {});
  
  },

  down: async (queryInterface, Sequelize) => {
     await queryInterface.bulkDelete('Cities', null, {});
  }
};
