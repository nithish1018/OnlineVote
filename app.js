/* eslint-disable no-unused-vars */
// eslint-disable-next-line no-undef
const express = require("express");
var csrf = require("tiny-csrf");
var cookieParser = require("cookie-parser");
const app = express();
// eslint-disable-next-line no-unused-vars
const {
  Admin,
  Election,
  Questions,
  Option,
  Voter,
  ElectionAnswers,
} = require("./models");
const bodyParser = require("body-parser");
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const saltRounds = 10;
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("shh! some secret string"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));
const path = require("path");
// eslint-disable-next-line no-undef
app.use(express.static(path.join(__dirname, "/public")));
const flash = require("connect-flash");
// eslint-disable-next-line no-unused-vars
const questions = require("./models/questions");
// eslint-disable-next-line no-unused-vars
const voter = require("./models/voter");
const { and } = require("sequelize");
// eslint-disable-next-line no-undef
app.set("views", path.join(__dirname, "views"));
app.use(flash());

app.set("view engine", "ejs");
app.get("/", async (request, response) => {
  response.render("index", {
    title: "Online-Voting",
    csrfToken: request.csrfToken(),
  });
});
app.use(
  session({
    secret: "my-secret-super-key-10181810",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

app.use(passport.initialize());
app.use(passport.session());
passport.use(
  "admin",
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      Admin.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid Password" });
          }
        })
        .catch(function () {
          return done(null, false, { message: "Unrecognized Email" });
        });
    }
  )
);
//Voter Validation
passport.use(
  "voter",
  new LocalStrategy(
    {
      usernameField: "voterUserId",
      passwordField: "voterPassword",
    },
    (username, password, done) => {
      Voter.findOne({ where: { voterUserId: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.voterPassword);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid Password" });
          }
        })
        .catch(function () {
          return done(null, false, { message: "Unrecognized UserID" });
        });
    }
  )
);
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});
//login
app.get("/login", (request, response) => {
  response.render("login", { title: "Login", csrfToken: request.csrfToken() });
});
//signup
app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Signup",
    csrfToken: request.csrfToken(),
  });
});
//Add admin
app.post("/admin", async (request, response) => {
  try {
    const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
    console.log(hashedPwd);
    if (!request.body.firstName) {
      request.flash("error", "Please Enter First Name");
      return response.redirect("/signup");
    }
    if (!request.body.email) {
      request.flash("error", "Please Enter Email");
      return response.redirect("/signup");
    }
    if (!request.body.password) {
      request.flash("error", "Please Enter Your Password");
      return response.redirect("/signup");
    }
    if (request.body.password.length < 8) {
      request.flash("error", "Password should be atleast of length 8");
      return response.redirect("/signup");
    }

    const admin = await Admin.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });

    request.login(admin, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      } else {
        response.redirect("/elections");
      }
    });
  } catch (error) {
    request.flash("error", "Admin with same Email Already Exist");
    request.flash("error", "Please Login, Instead of signup");

    return response.redirect("/signup");
  }
});
//Add Elections
app.post(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    function stringHasTheWhiteSpaceOrNot(value) {
      return value.indexOf(" ") >= 0;
    }
    if (request.user.isWho == "admin") {
      const nullString = request.body.electionName.trim();
      if (nullString.length == 0) {
        request.flash("error", "Election Name Should not be Null");
        return response.redirect("/election/create");
      }
      const url = request.body.customURL;

      const whiteSpace = stringHasTheWhiteSpaceOrNot(url);
      if (whiteSpace == true) {
        request.flash("error", "Don't enter any white spaces");
        console.log("Spaces found");
        return response.redirect("/election/create");
      }
      try {
        const thisElection = await Election.addElection({
          electionName: request.body.electionName,
          adminId: request.user.id,
          customURL: request.body.customURL,
        });
        return response.redirect("/elections", {
          thisElection,
        });
      } catch (error) {
        request.flash(
          "error",
          "Sorry Entered URL Or Election Name Is Already Been Use"
        );
        return response.redirect("/elections");
      }
    } else if (request.user.isWho == "voter") {
      return response.redirect("/");
    }
  }
);
//Login user
app.post(
  "/session",
  passport.authenticate("admin", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    console.log(request.user);
    response.redirect("/elections");
  }
);
//Get elections
app.get(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
    let userName = request.user.firstName + " " + request.user.lastName;
    try {
      const elections = await Election.getAllElections(request.user.id);
      if (request.accepts("html")) {
        response.render("elections", {
          title: "Online Voting",
          userName,
          elections,
          csrfToken: request.csrfToken(),
        });
      } else {
        return response.json({ elections });
      }
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
),
  //Get election edit page
  app.get(
    "/elections/:electionId/edit",
    connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
      if (request.user.isWho === "admin") {
        try {
          const election = await Election.getElectionWithId(
            request.params.electionId
          );
          if (request.user.id !== election.adminId) {
            request.flash("error", "Invalid election ID");
            return response.redirect("/elections");
          }
          if (election.isRunning === true) {
            request.flash("error", "Cannot edit while election is running");
            return response.redirect(
              `/elections/${request.params.electionId}/`
            );
          }
          if (election.isEnded == true) {
            request.flash("error", "Cannot edit when election has ended");
            return response.redirect(
              `/elections/${request.params.electionId}/`
            );
          }

          return response.render("edit_election", {
            electionId: request.params.electionId,
            csrfToken: request.csrfToken(),
          });
        } catch (error) {
          console.log(error);
          return response.status(422).json(error);
        }
      } else if (request.user.isWho === "voter") {
        return response.redirect("/");
      }
    }
  );
//Edit Election
app.put(
  "/elections/:electionId/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(
          request.params.electionId
        );
        if (election.isRunning === true) {
          return response.json("Cannot edit while election is running");
        }
        if (election.isEnded === true) {
          return response.json("Cannot edit when election has ended");
        }
        if (request.user.id !== election.adminId) {
          return response.json({
            error: "Invalid Election ID",
          });
        }
        const updatedElection = await Election.updateElection({
          electionName: request.body.electionName,
          customURL: request.body.customURL,
          id: request.params.electionId,
        });
        return response.json(updatedElection);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
// Delete Election
app.delete(
  "/elections/:id/delete",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(request.params.id);
        if (election.isRunning) {
          request.flash(
            "error",
            "Can't Delete As This Election Is Already Running"
          );
          return response.redirect("/elections");
        }
        if (election.isEnded) {
          request.flash(
            "error",
            "Can't Delete As This Election Has Been Succesfully Conducted"
          );
          return response.redirect("/elections");
        }
        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }

        const deletedElection = await Election.deleteElection(
          request.params.id
        );
        return response.json({ success: deletedElection === 1 });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//Election management Page
app.get(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(request.params.id);
        const customURL = election.customURL;
        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.isEnded) {
          return response.redirect(`/e/${customURL}/results`);
        }
        const questionsCount = await Questions.countOFQuestions(
          request.params.id
        );

        const votersCount = await Voter.countOFVoters(request.params.id);
        console.log(questionsCount);
        return response.render("questions", {
          id: request.params.id,
          title: election.electionName,
          csrfToken: request.csrfToken(),
          questionsC: questionsCount,
          votersC: votersCount,
          customURL: election.customURL,
          isRunning: election.isRunning,
        });
      } catch (error) {
        console.log(error);
      }
    } else if (request.user.isWho == "voter") {
      return response.redirect("/");
    }
  }
),
  //Add question
  app.get(
    "/elections/:id/newquestion",
    connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
      if (request.user.isWho === "voter") {
        return response.redirect("/");
      }
      const election = await Election.getElectionWithId(request.params.id);
      const questions = await Questions.getAllQuestions(request.params.id);
      const questionIds = [];
      const questionDescriptions = [];
      for (var i = 0; i < questions.length; i++) {
        questionDescriptions[i] = questions[i].questionDescription;
      }
      for (i = 0; i < questions.length; i++) {
        questionIds[i] = questions[i].id;
      }
      console.log(questionDescriptions);
      if (election.isRunning == false) {
        if (request.accepts("html")) {
          return response.render("newquestion", {
            title: election.electionName,
            questions,
            questionIds,
            questionDescriptions,
            csrfToken: request.csrfToken(),
            id: request.params.id,
          });
        } else {
          return response.json({ questions });
        }
      } else {
        request.flash(
          "error",
          "Cannot access questions while election is running"
        );
        return response.redirect(`/election/${request.params.id}/`);
      }
    }
  );
//Edit question
app.get(
  "/thiselection/:id/question/:questionId/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(request.params.id);
        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.isRunning === true) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.isEnded == true) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const question = await Questions.getQuestionWithId(
          request.params.questionId
        );
        return response.render("edit_question", {
          electionId: request.params.id,
          questionId: request.params.questionId,
          questionTitle: question.electionQuestion,
          questionDescription: question.questionDescription,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//Edit option
app.get(
  "/elections/:id/newquestion/create/:questionId/showoptions/:optionId/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(request.params.id);
        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.isRunning) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.isEnded) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const option = await Option.getOneOption(request.params.optionId);
        return response.render("option_edit", {
          option: option.option,
          csrfToken: request.csrfToken(),
          id: request.params.id,
          questionId: request.params.questionId,
          optionId: request.params.optionId,
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//update option
app.put(
  "/elections/:id/newquestion/create/:questionId/showoptions/:optionId/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      if (!request.body.option) {
        request.flash("error", "Please Enter Something");
        return response.json({
          error: "Option Field Is Empty",
        });
      }
      try {
        const election = await Election.getElectionWithId(request.params.id);
        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.isRunning) {
          return response.json("Cannot edit while election is running");
        }
        if (election.isEnded) {
          return response.json("Cannot edit when election has ended");
        }
        const updatedOption = await Option.updateOption({
          id: request.params.optionId,
          option: request.body.option,
        });
        return response.json(updatedOption);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//delete question
app.delete(
  "/elections/:id/newquestion/create/:questionId/showoptions/:optionId/delete",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(request.params.id);
        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.isRunning) {
          return response.json("Cannot edit while election is running");
        }
        if (election.isEnded) {
          return response.json("Cannot edit when election has ended");
        }
        const del = await Option.deleteOption(request.params.optionId);
        return response.json({ success: del === 1 });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//update question
app.put(
  "/elections/:id/question/:questionId/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(request.params.id);
        if (election.isRunning == true) {
          return response.json("Cannot edit while election is running");
        }
        if (election.isEnded == true) {
          return response.json("Cannot edit when election has ended");
        }
        if (request.user.id !== election.adminId) {
          return response.json({
            error: "Invalid Election ID",
          });
        }
        const updatedQuestion = await Questions.updateQuestion({
          electionQuestion: request.body.question,
          questionDescription: request.body.description,
          id: request.params.questionId,
        });
        return response.json(updatedQuestion);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//delete question
app.delete(
  "/elections/:id/questions/:questionId",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(request.params.id);
        if (election.isRunning) {
          return response.json("Cannot edit while election is running");
        }
        if (election.isEnded) {
          return response.json("Cannot edit when election has ended");
        }
        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        const questionsCount = await Questions.countOFQuestions(
          request.params.id
        );
        if (questionsCount == 1) {
          request.flash("error", "Sorry, You Cannot Delete This Question!");
          request.flash(
            "error",
            "Atleast One Question Should Be Present In Ballot"
          );
        }
        if (questionsCount > 1) {
          const del = await Questions.deleteQuestion(request.params.questionId);
          return response.json({ success: del === 1 });
        } else {
          return response.json({ success: false });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//New question Form Page
app.get(
  "/elections/:id/newquestion/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
    return response.render("create_question", {
      id: request.params.id,
      csrfToken: request.csrfToken(),
    });
  }
);
//All options page
app.get(
  "/elections/:id/newquestion/create/:questionId/showoptions",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
    try {
      const question = await Questions.getQuestionWithId(
        request.params.questionId
      );
      const allOptions = await Option.getAllOptions(request.params.questionId);

      response.render("showOptions", {
        questionName: question.electionQuestion,
        allOptions,
        csrfToken: request.csrfToken(),
        id: request.params.id,
        questionId: request.params.questionId,
      });
    } catch (error) {
      console.log(error);
    }
  }
);
//Add election page
app.get(
  "/election/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "voter") {
      request.flash("error", "Voter cannot access Admin's Pages");
      return response.redirect("/");
    }
    response.render("createElection", {
      title: "New Election",
      csrfToken: request.csrfToken(),
    });
  }
);
//Add option
app.post(
  "/elections/:id/newquestion/create/:questionId",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    await Option.addNewOption({
      option: request.body.option,
      questionId: request.params.questionId,
    });

    const questionId = request.params.questionId;
    return response.redirect(
      `/elections/${request.params.id}/newquestion/create/${request.params.questionId}/showoptions/`
    );
  }
);
//Get options
app.get(
  "/elections/:id/newquestion/create/:questionId",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "voter") {
      request.flash("error", "Voter cannot access Admin's Pages");
      return response.redirect("/");
    }
    response.render("optionsPage", {
      title: "Add Options",
      csrfToken: request.csrfToken(),
      questionId: request.params.questionId,
      id: request.params.id,
    });
  }
);
//Add new question
app.post(
  "/elections/:id/newquestion/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const enteredQuestion = request.body.question.trim();
    if (enteredQuestion.length == 0) {
      request.flash("error", "Question can't be null");
      return response.redirect(
        `/election/${request.params.id}/newquestion/create`
      );
    }

    try {
      const question = request.body.question;
      const description = request.body.description;
      const electionId = request.params.id;

      const thisquestion = await Questions.addNewQuestion({
        question,
        description,
        electionId,
      });

      const questionId = thisquestion.id;
      return response.redirect(
        `/elections/${request.params.id}/newquestion/create/${questionId}`
      );
    } catch (error) {
      request.flash("error", error);
      return response.redirect(
        `/elections/${request.params.id}/newquestion/create`
      );
    }
  }
);
//Get admin password reset page
app.get(
  "/admin/passwordReset",
  connectEnsureLogin.ensureLoggedIn(),
  (request, response) => {
    if (request.user.isWho === "admin") {
      response.render("AdminPasswordReset", {
        csrfToken: request.csrfToken(),
      });
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//Update admin password
app.post(
  "/admin/passwordReset",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      if (!request.body.oldpassword) {
        request.flash("error", "Old Password Field Cannot Be Empty");
        return response.redirect("/admin/passwordReset");
      }
      if (!request.body.newpassword) {
        request.flash("error", "New Password Field Cannot Be Empty");
        return response.redirect("/admin/passwordReset");
      }
      if (request.body.newpassword.length < 8) {
        request.flash("error", "Password length should be atleast 8");
        return response.redirect("/admin/passwordReset");
      }
      const res = await bcrypt.compare(
        request.body.newpassword,
        request.user.password
      );
      if (res) {
        request.flash(
          "error",
          "New password cannot be same as existing password"
        );
        return response.redirect("/admin/passwordReset");
      }
      const hashedNewPwd = await bcrypt.hash(
        request.body.newpassword,
        saltRounds
      );
      const result = await bcrypt.compare(
        request.body.oldpassword,
        request.user.password
      );
      if (result) {
        try {
          Admin.findOne({ where: { email: request.user.email } }).then(
            (user) => {
              user.resetPassword(hashedNewPwd);
            }
          );
          request.flash("success", "Password changed successfully");
          return response.redirect("/elections");
        } catch (error) {
          console.log(error);
          return response.status(422).json(error);
        }
      } else {
        request.flash("error", "Incorrect Old Password");
        return response.redirect("/admin/passwordReset");
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);

//Get voters
app.get(
  "/elections/:id/voters",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "voter") {
      request.flash("error", "Voter cannot access Admin's Pages");
      return response.redirect("/");
    }
    const votersCount = await Voter.countOFVoters(request.params.id);
    const allVoters = await Voter.getAllVoters(request.params.id);
    const thisElection = await Election.getElectionWithId(request.params.id);
    const thisElectionName = thisElection.electionName;
    return response.render("voters", {
      votersCount,
      allVoters,
      csrfToken: request.csrfToken(),
      id: request.params.id,
      thisElectionName,
    });
  }
);
//Get Edit Voter Page
app.get(
  "/elections/:electionId/voter/:voterId/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(
          request.params.electionId
        );
        const voter = await Voter.getOneVoter(request.params.voterId);

        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.isEnded) {
          request.flash("error", "Can't Edit As Election Has Already Ended");
          return response.redirect(`/elections/${request.params.electionId}/`);
        }
        response.render("voterEdit", {
          title: "Edit Voter",
          electionId: request.params.electionId,
          voterId: request.params.voterId,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//Edit Voter
app.post(
  "/elections/:electionId/voter/:voterId/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      if (!request.body.voterUserId) {
        request.flash("error", "Please Enter Voter ID");
        return response.redirect(
          `/elections/${request.params.electionId}/voter/${request.params.voterId}/edit`
        );
      }
      if (!request.body.voterPassword) {
        request.flash("error", "Please Enter Password");
        return response.redirect(
          `/elections/${request.params.electionId}/voter/${request.params.voterId}/edit`
        );
      }
      if (request.body.voterPassword.length < 8) {
        request.flash("error", "Password length should be atleast 8");
        return response.redirect(
          `/elections/${request.params.electionId}/voter/${request.params.voterId}/edit`
        );
      }

      try {
        const election = await Election.getElectionWithId(
          request.params.electionId
        );
        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.isEnded) {
          request.flash("error", "Can't Edit As Election Has Already Ended");
          return response.redirect(`/elections/${request.params.electionId}/`);
        }
        const res = Voter.updateVoter({
          id: request.params.voterId,
          voterUserId: request.body.voterUserId,
          voterPassword: request.body.voterPassword,
        });
        if (res) {
          request.flash("success", "Voter Details Updated successfully");
          return response.redirect(
            `/elections/${request.params.electionId}/voters`
          );
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);
//Delete Voter
app.delete(
  "/elections/:electionId/voter/:voterId",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(
          request.params.electionId
        );
        if (request.user.id !== election.adminId) {
          return response.json({
            error: "Invalid Election ID",
          });
        }
        if (election.isEnded) {
          return response.json("Cannot delete when election has ended");
        }
        const votersCount = await Voter.countOFVoters(
          request.params.electionId
        );
        if (votersCount > 1) {
          const voter = await Voter.getOneVoter(request.params.voterId);
          if (voter.isVoted) {
            return response.json(
              "Deletion is not allowed as this voter has already submitted their vote"
            );
          }
          const res = await Voter.deleteVoter(request.params.voterId);
          return response.json({ success: res === 1 });
        }
        if (votersCount === 1) {
          request.flash(
            "Atleast One Voter Should be available as the election is already begun"
          );
          return response.redirect(
            `/elections/${request.params.electionId}/voters`
          );
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//Election preview page
app.get(
  "/elections/:id/election_preview",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(request.params.id);
        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election Id");
          return response.redirect("/elections");
        }
        const votersCount = await Voter.countOFVoters(request.params.id);
        const questions = await Questions.getAllQuestions(request.params.id);
        let options = [];
        for (let question in questions) {
          const question_options = await Option.getAllOptions(
            questions[question].id
          );
          if (question_options.length < 2) {
            request.flash(
              "error",
              "There should be atleast two options in each question"
            );
            request.flash(
              "error",
              "Please add atleast two options to the question below"
            );
            return response.redirect(
              `/elections/${request.params.id}/newquestion/create/${questions[question].id}`
            );
          }
          options.push(question_options);
        }

        if (questions.length < 1) {
          request.flash(
            "error",
            "Please add atleast one question for this Election ballot"
          );
          return response.redirect(
            `/elections/${request.params.id}/newquestion`
          );
        }

        if (votersCount < 1) {
          request.flash(
            "error",
            "Please add atleast one voter for this election"
          );
          return response.redirect(`/elections/${request.params.id}/voters`);
        }

        return response.render("election_preview", {
          title: election.electionName,
          electionId: request.params.id,
          questions,
          options,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//Update Election Running status
app.put(
  "/elections/:id/start",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(request.params.id);
        if (request.user.id !== election.adminId) {
          return response.json({
            error: "Invalid Election Id",
          });
        }
        const startElection = await Election.startElection(request.params.id);
        return response.json(startElection);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
// Stopping an election
app.put(
  "/elections/:electionId/stop",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(
          request.params.electionId
        );
        if (request.user.id !== election.adminId) {
          return response.json({
            error: "Invalid Election ID",
          });
        }
        if (!election.isRunning) {
          return response.json("Cannot end when election hasn't launched yet");
        }
        const stopElection = await Election.stopElection(
          request.params.electionId
        );
        return response.json(stopElection);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.isWho === "voter") {
      return response.redirect("/");
    }
  }
);
//New Voter page
app.get(
  "/elections/:id/voters/new",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "voter") {
      request.flash("error", "Voter cannot access Admin's Pages");
      return response.redirect("/");
    }
    response.render("newVoter", {
      csrfToken: request.csrfToken(),
      id: request.params.id,
    });
  }
);
//Add new voter
app.post(
  "/elections/:id/voters/new",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const voterUserId = request.body.voterUserId.trim();
    const voterPassword = request.body.voterPassword;
    if (voterUserId.length == 0) {
      request.flash("error", "Voter User Name Shouldn't Be Null");
      return response.redirect(`/elections/${request.params.id}/voters/new`);
    }
    if (voterPassword.length < 8) {
      request.flash("error", "Password Must Be Of Length 8");
      return response.redirect(`/elections/${request.params.id}/voters/new`);
    }
    try {
      const hashedPwd = await bcrypt.hash(
        request.body.voterPassword,
        saltRounds
      );
      console.log(hashedPwd);
      const voter = await Voter.addVoter({
        voterUserId: voterUserId,
        voterPassword: hashedPwd,
        electionId: request.params.id,
      });
      response.redirect(`/elections/${request.params.id}/voters`);
    } catch (error) {
      request.flash("error", "Sorry,This Voter UserId already exists");
      request.flash("error", "Please add Voter with unique VoterId");

      response.redirect(`/elections/${request.params.id}/voters/new`);
    }
  }
);
//Get voting page
app.get("/e/:customURL", async (request, response) => {
  const election = await Election.findElectionWithURL(request.params.customURL);
  if (election.isEnded) {
    return response.redirect(`/e/${request.params.customURL}/results`);
  }
  if (!request.user) {
    request.flash("error", "Please login before trying to Vote");
    return response.redirect(`/e/${request.params.customURL}/voterlogin`);
  }
  if (request.user.isVoted) {
    request.flash("error", "You have voted successfully");
    return response.redirect(`/e/${request.params.customURL}/results`);
  }
  try {
    const election = await Election.findElectionWithURL(
      request.params.customURL
    );
    if (election.isEnded) {
      return response.redirect(`/e/${request.params.customURL}/result`);
    }
    if (request.user.isWho === "voter") {
      if (election.isRunning) {
        const questions = await Questions.getAllQuestions(election.id);
        let options = [];
        for (let question in questions) {
          options.push(await Option.getAllOptions(questions[question].id));
        }
        return response.render("votingPage", {
          title: election.electionName,
          electionId: election.id,
          electionName: election.electionName,
          questions,
          options,
          customURL: request.params.customURL,
          csrfToken: request.csrfToken(),
        });
      }
    } else if (request.user.isWho === "admin") {
      request.flash("error", "You cannot vote as Admin");
      request.flash("error", "Please signout as Admin before trying to vote");
      return response.redirect(`/elections/${election.id}`);
    }
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});
//Submitting Election Answers
app.post("/e/:customURL", async (request, response) => {
  if (!request.user) {
    request.flash("error", "Please login before trying to Vote");
    return response.redirect(`/e/${request.params.customURL}/voterlogin`);
  }
  if (request.user.isVoted) {
    request.flash("error", "You have voted successfully");
    return response.redirect(`/e/${request.params.customURL}/results`);
  }
  try {
    let election = await Election.findElectionWithURL(request.params.customURL);
    if (election.isEnded) {
      request.flash("error", "Election has already ended, You cant't vote now");
      return response.redirect(`/elections/${request.params.id}/results`);
    }
    let questions = await Questions.getAllQuestions(election.id);
    for (let question of questions) {
      let qid = `q-${question.id}`;
      let chosenOption = request.body[qid];
      await ElectionAnswers.addAnswer({
        voterId: request.user.id,
        electionId: election.id,
        questionId: question.id,
        chosenOption: chosenOption,
      });
    }
    await Voter.isVoted(request.user.id);
    return response.redirect(`/e/${request.params.customURL}/results`);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});
//Voter login page
app.get("/e/:customURL/voterlogin", async (request, response) => {
  try {
    if (request.user) {
      return response.redirect(`/e/${request.params.customURL}`);
    }

    const election = await Election.findElectionWithURL(
      request.params.customURL
    );
    if (election.isRunning && !election.isEnded) {
      return response.render("voterlogin", {
        title: "Login in as Voter",
        customURL: request.params.customURL,
        electionId: election.id,
        csrfToken: request.csrfToken(),
      });
    } else {
      request.flash("Election has ended");
      return response.render("result");
    }
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});
//checking voter login
app.post(
  "/e/:customURL/voterlogin",
  passport.authenticate("voter", {
    failureFlash: true,
    failureRedirect: "back",
  }),
  async (request, response) => {
    return response.redirect(`/e/${request.params.customURL}`);
  }
);
//Get results page
app.get("/e/:customURL/results", async (request, response) => {
  try {
    const election = await Election.findElectionWithURL(
      request.params.customURL
    );
    if (!election.isRunning && !election.isEnded) {
      return response.status(404).render("error");
    }
    if (!election.isEnded && request.user.isWho === "voter") {
      return response.render("afterVoting");
    }
    const questions = await Questions.getAllQuestions(election.id);
    const answers = await ElectionAnswers.getElectionResults(election.id);
    let options = [];
    let optionLabels = [];
    let optionsCount = [];
    let winners = [];
    for (let question in questions) {
      let opts = await Option.getAllOptions(questions[question].id);
      options.push(opts);
      let opts_count = [];
      let opts_labels = [];
      for (let opt in opts) {
        opts_labels.push(opts[opt].option);
        opts_count.push(
          await ElectionAnswers.countOFOptions({
            electionId: election.id,
            chosenOption: opts[opt].id,
            questionId: questions[question].id,
          })
        );
      }
      winners.push(Math.max.apply(Math, opts_count));
      optionLabels.push(opts_labels);
      optionsCount.push(opts_count);
      console.log(winners);
    }
    const nVoted = await Voter.countOFVoted(election.id);
    const nNotVoted = await Voter.countOFNotVoted(election.id);
    const totalVoters = nVoted + nNotVoted;
    return response.render("results", {
      electionName: election.electionName,
      answers,
      questions,
      options,
      optionsCount,
      optionLabels,
      winners,
      nVoted,
      nNotVoted,
      totalVoters,
    });
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});
app.get("/elections/:id/preview_results", async (request, response) => {
  try {
    const thiselection = await Election.getElectionWithId(request.params);
    const election = await Election.findElectionWithURL(thiselection.customURL);
    if (!election.isRunning && !election.isEnded) {
      return response.status(404).render("error");
    }
    if (!election.isEnded) {
      return response.render("resultsPreview");
    }
    const questions = await Questions.getAllQuestions(election.id);
    const answers = await ElectionAnswers.getElectionResults(election.id);
    let options = [];
    let optionLabels = [];
    let optionsCount = [];
    let winners = [];
    for (let question in questions) {
      let opts = await Option.getAllOptions(questions[question].id);
      options.push(opts);
      let opts_count = [];
      let opts_labels = [];
      for (let opt in opts) {
        opts_labels.push(opts[opt].option);
        opts_count.push(
          await ElectionAnswers.countOFOptions({
            electionId: election.id,
            chosenOption: opts[opt].id,
            questionId: questions[question].id,
          })
        );
      }
      winners.push(Math.max.apply(Math, opts_count));
      optionLabels.push(opts_labels);
      optionsCount.push(opts_count);
      console.log(winners);
    }
    const nVoted = await Voter.countOFVoted(election.id);
    const nNotVoted = await Voter.countOFNotVoted(election.id);
    const totalVoters = nVoted + nNotVoted;
    return response.render("results", {
      electionName: election.electionName,
      answers,
      questions,
      options,
      optionsCount,
      optionLabels,
      winners,
      nVoted,
      nNotVoted,
      totalVoters,
    });
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});
//Sign out
app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});
// Voter Sign Out
app.get("/voter/:customURL/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect(`/e/${request.params.customURL}/voterlogin`);
  });
});
// To get error page
app.use(function (request, response) {
  response.status(404).render("error");
});

module.exports = app;
