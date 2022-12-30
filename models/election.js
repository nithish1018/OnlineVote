"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Election extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Election.belongsTo(models.Admin, {
        foreignKey: "adminId",
      });
      Election.hasMany(models.Questions, {
        foreignKey: "electionId",
      });
      Election.hasMany(models.Voter,{
        foreignKey:"electionId"
      })
    }
    static addElection({ electionName, adminId, customURL }) {
      return this.create({
        electionName,
        customURL,
        adminId,
      });
    }
    static getAllURL(adminId){
      return this.findAll({
        where:adminId,
        attributes:['customURL']
      })
    }
    static getAllElections(adminId){
      return this.findAll({
        where:{
          adminId
        },
        order: [["id", "ASC"]],

      })
    }
  
    static  getElectionWithId(id) {
      return this.findOne({
        where: {
          id,
        },
      });
    }
  }

  Election.init(
    {
      electionName:{
        type:DataTypes.STRING,
        allowNull:false,
      },
      customURL:{
        type:DataTypes.STRING,
        allowNull:false,
        unique:true,
      },
      isRunning:{
        defaultValue:false,
        type:DataTypes.BOOLEAN
      },
      isEnded:{
        defaultValue:false,
        type:DataTypes.BOOLEAN
      },
    },
    {
      sequelize,
      modelName: "Election",
    }
  );
  return Election;
};
