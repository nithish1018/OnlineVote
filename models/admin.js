'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Admin extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Admin.hasMany(models.Election,{
        foreignKey:"adminId"

      })
    }
  }
  Admin.init({
    firstName:{
      type:DataTypes.STRING,
      allowNull:false,
    },
    lastName: {
      type:DataTypes.STRING,
      allowNull:false
    },
    isWho: {
      type:DataTypes.STRING,
      defaultValue:"admin"
    },
    email: DataTypes.STRING,
    password: {
      type:DataTypes.STRING,
      allowNull:false,
      validate:{
        notNull:true,
        len:8
      }
    }
  }, {
    sequelize,
    modelName: 'Admin',
  });
  return Admin;
};