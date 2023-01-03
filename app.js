// eslint-disable-next-line no-undef
const express = require("express");
var csrf = require("tiny-csrf");
var cookieParser = require("cookie-parser");
const app = express();
const { Admin, Election ,Questions,Option,Voter,ElectionAnswers} = require("./models");
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
app.use(express.static(path.join(__dirname, "public")));
const flash = require("connect-flash");
const questions = require("./models/questions");
const voter = require("./models/voter");
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
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});
app.get("/login", (request, response) => {
  response.render("login", { title: "Login", csrfToken: request.csrfToken() });
});
app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Signup",
    csrfToken: request.csrfToken(),
  });
});
app.post("/admin", async (request, response) => {
  try {
    const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
    console.log(hashedPwd);
    if(request.body.password.length<8){
      request.flash("error","Password should be atleast of length 8");
      response.redirect("/signup")
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
    request.flash("error", error.message);
    return response.redirect("/signup");
  }
});
app.post("/elections",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{

  if(request.user.isWho=="admin")
 {
  const nullString=(request.body.electionName).trim()
  if(nullString.length==0){
    request.flash("error","Election Name Should not be Null")
    return response.redirect("/election/create")
  }
  const url=request.body.customURL
  function stringHasTheWhiteSpaceOrNot(value){
    return value.indexOf(' ') >= 0;
 }

 const whiteSpace=stringHasTheWhiteSpaceOrNot(url);
 if(whiteSpace==true){
  request.flash("error","Don't enter any white spaces")
  console.log("Spaces found")
    return response.redirect("/election/create")
 }
 const URLs= await Election.findElectionWithURL(url);
 if(URLs.length>1){
  request.flash("error","Sorry,Given custom string is already been used");
  request.flash("error","Please Try again with another custom string");
  return response.redirect("election/create");
 }


  try{
       const thisElection= await Election.addElection({
          electionName:request.body.electionName,
          adminId:request.user.id,
          customURL:request.body.customURL
        });
       return response.redirect("/elections",{
        thisElection
       })
    }
    catch (error) {
      request.flash("error", "Sorry this URL is already been use");
      return response.redirect("/elections");
    }
 }
 else if(request.user.isWho=="voter"){
  return response.redirect("/")
 }
})
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
app.get(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
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
  },
  ),
  app.get("/elections/:id",connectEnsureLogin.ensureLoggedIn(),async(request,response)=>{
      const election= await Election.getElectionWithId(request.params.id);
      const questionsCount=await Questions.countOFQuestions(request.params.id);
      
      const votersCount=await Voter.countOFVoters(request.params.id);
      console.log(questionsCount)
     return response.render("questions",{
        id:request.params.id,
        title:election.electionName,
        csrfToken:request.csrfToken(),
        questionsC:questionsCount,
        votersC:votersCount,
        customURL:election.customURL,
        isRunning:election.isRunning,
      }) 
  }),
  app.get("/elections/:id/newquestion",connectEnsureLogin.ensureLoggedIn(),async(request,response)=>{
    
      const election=await Election.getElectionWithId(request.params.id);
      const questions=await Questions.getAllQuestions(request.params.id)
      const questionIds=[]
      const questionDescriptions=[];
      for(var i=0;i<questions.length;i++){
        questionDescriptions[i]=questions[i].questionDescription
      }
      for(var i=0;i<questions.length;i++){
        questionIds[i]=questions[i].id
      }
     console.log(questionDescriptions)
      if(election.isRunning==false){
        if(request.accepts("html")){
          return response.render("newquestion",{
            title:election.electionName,
            questions,
            questionIds,
            questionDescriptions,
            csrfToken:request.csrfToken(),
            id:request.params.id,
          })
        }
        else{
          return response.json({questions})
        }
      }
      else{
        request.flash("error","Cannot access questions while election is running");
        return response.redirect(`/election/${id}/`)
      }
    
   

  });
  app.get("/thiselection/:id/question/:questionId/edit",connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.isWho === "admin") {
      try {
        const election = await Election.getElectionWithId(request.params.id);
        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.isRunning===true) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.isEnded==true) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const question = await Questions.getQuestionWithId(request.params.questionId);
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
  });
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
  )
  app.put(
    "/elections/:id/question/:questionId/edit",
    connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
      if (request.user.isWho === "admin") {
        
        try {
          const election = await Election.getElectionWithId(request.params.id);
          if (election.isRunning==true) {
            return response.json("Cannot edit while election is running");
          }
          if (election.isEnded==true) {
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
          if(questionsCount==1){
            return response.json("Atleast One Question Should Be There")
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
  app.get("/elections/:id/newquestion/create",connectEnsureLogin.ensureLoggedIn(),async(request,response)=>{

    return response.render("create_question",{
      id: request.params.id,
      csrfToken:request.csrfToken(),
    
      
    })
  })
  app.get("/elections/:id/newquestion/create/:questionId/showoptions",connectEnsureLogin.ensureLoggedIn(),async(request,response)=>{
    try{
    const question=await Questions.getQuestionWithId(request.params.questionId);
    const allOptions=await Option.getAllOptions(request.params.questionId);

    response.render("showOptions",{
      questionName:question.electionQuestion,
      allOptions,
      csrfToken:request.csrfToken(),
      id:request.params.id,
      questionId:request.params.questionId

    })
  }
  catch(error){
    console.log(error)
  }
  })
  app.get("/election/create",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
    response.render("createElection",{
        title:"New Election",
        csrfToken:request.csrfToken(),
    })



  })
  app.post("/elections/:id/newquestion/create/:questionId",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
    await Option.addNewOption({
      option:request.body.option,
      questionId:request.params.questionId
    })
   
    const questionId=request.params.questionId
    return response.redirect(`/elections/${request.params.id}/newquestion/create/${questionId}/`)

  })
  app.get("/elections/:id/newquestion/create/:questionId",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
       response.render("optionsPage",{
      title:"Add Options",
      csrfToken:request.csrfToken(),
      questionId:request.params.questionId,
      id:request.params.id
    })
  })
  app.post("/elections/:id/newquestion/create",connectEnsureLogin.ensureLoggedIn(),async(request,response)=>{
   
    const enteredQuestion=(request.body.question).trim()
    if(enteredQuestion.length==0){
      request.flash("error","Question can't be null")
      return response.redirect(`/election/${request.params.id}/newquestion/create`)
    }
  
    try{

      const question=request.body.question;
      const description=request.body.description;
      const electionId=request.params.id;

      const thisquestion = await Questions.addNewQuestion({
        question,
        description,
        electionId,
      });
      
      // const thisquestion=await Questions.getQuestionWithName(question,description)
 
    const questionId=thisquestion.id;
    return response.redirect(`/elections/${request.params.id}/newquestion/create/${questionId}`)
    }
    catch(error){
      request.flash("error",error)
      return response.redirect(`/elections/${request.params.id}/newquestion/create`)

    } 
});
  app.get("/elections/:id/voters",connectEnsureLogin.ensureLoggedIn(),async(request,response)=>{
    const votersCount=await Voter.countOFVoters(request.params.id);
    const allVoters=await Voter.getAllVoters(request.params.id);
    const thisElection=await Election.getElectionWithId(request.params.id)
    const thisElectionName=thisElection.electionName
    return response.render("voters",{
      votersCount,
      allVoters,
      csrfToken:request.csrfToken(),
      id:request.params.id,
      thisElectionName,
    })
  });
  app.get("/elections/:id/election_preview",connectEnsureLogin.ensureLoggedIn(), async(request,response)=>{
    if (request.user.isWho ==="admin") {
      try {
        const election = await Election.getElectionWithId(request.params.id);
        if (request.user.id !== election.adminId) {
          request.flash("error", "Invalid election Id");
          return response.redirect("/elections");
        }
        const votersCount = await Voter.countOFVoters(
          request.params.id
        );
        const questions = await Questions.getAllQuestions(
          request.params.id
        );
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
          return response.redirect(
            `/elections/${request.params.id}/voters`
          );
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
  });
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
          const startElection = await Election.startElection(
            request.params.id
          );
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
  app.get("/elections/:id/voters/new",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
    response.render("newVoter",{
      csrfToken:request.csrfToken(),
      id:request.params.id,
    })
  })
  app.post("/elections/:id/voters/new",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
    const voterUserId=(request.body.voterUserId).trim();
    const voterPassword=request.body.voterPassword;
    if(voterUserId.length==0){
      request.flash("error","Voter User Name Shouldn't Be Null")
      return response.redirect(`/elections/${request.params.id}/voters/new`)
    }
    if(voterPassword.length<8){
      request.flash("error","Password Must Be Of Length 8");
      return response.redirect(`/elections/${request.params.id}/voters/new`);
    }
    try{
      await Voter.addVoter({
        voterUserId:voterUserId,
        voterPassword:voterPassword,
        electionId:request.params.id,
      })
      response.redirect(`/elections/${request.params.id}/voters`)
    }
    catch(error){
      request.flash(error,error);
      response.redirect(`/elections/${request.params.id}/voters/new`)
    } 
  });
  app.get("/signout", (request, response, next) => {
    request.logout((err) => {
      if (err) {
        return next(err);
      }
      response.redirect("/");
    });
  });

module.exports = app;
