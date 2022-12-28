'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Option extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Option.belongsTo(models.Questions,{
        foreignKey:"questionId",
        onDelete:"CASCADE"
      })
    }
  }
  Option.init({
    option:{
      type:DataTypes.STRING,
      allowNull:false
    }
  }, {
    sequelize,
    modelName: 'Option',
  });
  return Option;
};