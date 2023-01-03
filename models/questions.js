"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Questions extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Questions.belongsTo(models.Election, {
        foreignKey: "electionId",
      });
      Questions.hasMany(models.Option, {
        foreignKey: "questionId",
      });
      Questions.hasMany(models.ElectionAnswers, {
        foreignKey: "questionId",
      });
    }
    static addNewQuestion({ question, description, electionId }) {
      return this.create({
        electionQuestion: question,
        questionDescription: description,
        electionId,
      });
    }
    static async getAllQuestions(electionId) {
      return await this.findAll({
        where: {
          electionId,
        },
        order: [["id", "ASC"]],
      });
    }
    static async countOFQuestions(electionId) {
      return await this.count({
        where: {
          electionId,
        },
      });
    }
    static getQuestionWithId(id) {
      return this.findOne({
        where: {
          id,
        },
      });
    }
    static deleteQuestion(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }
    static getQuestionWithName(question, description) {
      return this.findOne({
        where: {
          electionQuestion: question,
          questionDescription: description,
        },
      });
    }
    static async getAllQuestions(electionId) {
      return this.findAll({
        where: {
          electionId,
        },
      });
    }
    static updateQuestion({ electionQuestion, questionDescription, id }) {
      return this.update(
        {
          electionQuestion,
          questionDescription,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }
  }
  Questions.init(
    {
      electionQuestion: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      questionDescription: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Questions",
    }
  );
  return Questions;
};
