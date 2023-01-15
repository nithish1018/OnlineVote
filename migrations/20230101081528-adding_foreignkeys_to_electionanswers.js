"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ElectionAnswers", "voterId", {
      type: Sequelize.DataTypes.INTEGER,
      onDelete: "CASCADE",
    });
    await queryInterface.addConstraint("ElectionAnswers", {
      fields: ["voterId"],
      type: "foreign key",
      onDelete: "CASCADE",
      references: {
        table: "Voters",
        field: "id",
      },
    });
    await queryInterface.addColumn("ElectionAnswers", "electionId", {
      type: Sequelize.DataTypes.INTEGER,
      onDelete: "CASCADE",
    });
    await queryInterface.addConstraint("ElectionAnswers", {
      fields: ["electionId"],
      type: "foreign key",
      onDelete: "CASCADE",
      references: {
        table: "Elections",
        field: "id",
      },
    });
    await queryInterface.addColumn("ElectionAnswers", "questionId", {
      type: Sequelize.DataTypes.INTEGER,
    });
    await queryInterface.addConstraint("ElectionAnswers", {
      fields: ["questionId"],
      type: "foreign key",
      references: {
        table: "Questions",
        field: "id",
      },
    });
    await queryInterface.addColumn("ElectionAnswers", "chosenOption", {
      type: Sequelize.DataTypes.INTEGER,
    });
    await queryInterface.addConstraint("ElectionAnswers", {
      fields: ["chosenOption"],
      type: "foreign key",
      references: {
        table: "Options",
        field: "id",
      },
    });

    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("ElectionAnswers", "voterId");
    await queryInterface.removeColumn("ElectionAnswers", "electionId");
    await queryInterface.removeColumn("ElectionAnswers", "questionId");
    await queryInterface.removeColumn("ElectionAnswers", "chosenOption");
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
