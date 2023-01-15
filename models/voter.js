"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Voter extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Voter.belongsTo(models.Election, {
        foreignKey: "electionId",
      });
      Voter.hasMany(models.ElectionAnswers, {
        foreignKey: "voterId",
      });
    }
    static async addVoter({ voterUserId, voterPassword, electionId }) {
      return await this.create({
        voterUserId,
        voterPassword,
        electionId,
      });
    }
    static async countOFVoted(electionId) {
      return await this.count({
        where: {
          electionId,
          isVoted: true,
        },
      });
    }
    static async countOFNotVoted(electionId) {
      return await this.count({
        where: {
          electionId,
          isVoted: false,
        },
      });
    }
    static async isVoted(id) {
      return await this.update(
        {
          isVoted: true,
        },
        {
          where: {
            id,
          },
        }
      );
    }
    static async updateVoter({ id, voterUserId, voterPassword }) {
      return await this.update(
        {
          voterUserId,
          voterPassword,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }
    static deleteVoter(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }
    static async getAllVoters(electionId) {
      return await this.findAll({
        where: {
          electionId,
        },
        order: [["id", "ASC"]],
      });
    }
    static async getOneVoter(id) {
      return await this.findOne({
        where: {
          id,
        },
        order: [["id", "ASC"]],
      });
    }
    static async countOFVoters(electionId) {
      return await this.count({
        where: {
          electionId,
        },
      });
    }
  }
  Voter.init(
    {
      voterUserId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      voterPassword: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isVoted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isWho: {
        type: DataTypes.STRING,
        defaultValue: "voter",
      },
    },
    {
      sequelize,
      modelName: "Voter",
    }
  );
  return Voter;
};
