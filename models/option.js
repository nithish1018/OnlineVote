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
    static getAllOptions(questionId) {
      return this.findAll({
        where: {
          questionId,
        },
        order: [["id", "ASC"]],
      });
    }
    static getOneOption(id) {
      return this.findOne({
        where: {
          id,
        },
      });
    }
    static addNewOption({option,questionId}){
      return this.create({
        option,
        questionId
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