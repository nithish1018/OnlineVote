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
    }
    static addElection({ electionName, adminId, customURL }) {
      return this.create({
        electionName,
        customURL,
        adminId,
      });
    }
  
          static getAllElections(adminId) {
      return this.findAll({
        where: {
          adminId,
        },
        order: [["id", "ASC"]],
      });
    }
  }

  Election.init(
    {
      electionName: DataTypes.STRING,
      customURL: DataTypes.STRING,
      isRunning: DataTypes.BOOLEAN,
      isEnded: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Election",
    }
  );
  return Election;
};
