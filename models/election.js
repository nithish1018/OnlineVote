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
      Election.hasMany(models.Voter, {
        foreignKey: "electionId",
      });
      Election.hasMany(models.ElectionAnswers, {
        foreignKey: "electionId",
      });
    }
    static addElection({ electionName, adminId, customURL }) {
      return this.create({
        electionName,
        customURL,
        adminId,
      });
    }
    static async updateElection({ electionName, customURL, id }) {
      return await this.update(
        {
          electionName,
          customURL,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }
    static deleteElection(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }
    static getAllURL(adminId) {
      return this.findAll({
        where: adminId,
        attributes: ["customURL"],
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
    static async findElectionWithURL(customURL) {
      return this.findOne({
        where: {
          customURL,
        },
        order: [["id", "ASC"]],
      });
    }
    static startElection(id) {
      return this.update(
        {
          isRunning: true,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }
    static stopElection(id) {
      return this.update(
        {
          isEnded: true,
          isRunning: false,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }

    static getElectionWithId(id) {
      return this.findOne({
        where: {
          id,
        },
      });
    }
  }

  Election.init(
    {
      electionName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      customURL: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      isRunning: {
        defaultValue: false,
        type: DataTypes.BOOLEAN,
      },
      isEnded: {
        defaultValue: false,
        type: DataTypes.BOOLEAN,
      },
    },
    {
      sequelize,
      modelName: "Election",
    }
  );
  return Election;
};
