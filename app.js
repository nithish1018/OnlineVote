// eslint-disable-next-line no-undef
const express = require("express");
var csrf = require("tiny-csrf");
var cookieParser = require("cookie-parser");
const app = express();
const { Admin, Election ,Questions,Option,Voter} = require("./models");
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
passport.serializeUser((admin, done) => {
  console.log("Serializing user in session", admin.id);
  done(null, admin.id);
});
passport.deserializeUser((id, done) => {
  Admin.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
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
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  console.log(hashedPwd);
  if(request.body.password.length<8){
    request.flash("error","Password should be atleast of length 8");
    response.redirect("/signup")
  }
  try {
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

  try{
        await Election.addElection({
          electionName:request.body.electionName,
          adminId:request.user.id,
          customURL:request.body.customURL
        });
       return response.redirect("/elections")
    }
    catch (error) {
      request.flash("error", error.message);
      return response.redirect("/elections");
    }
})
app.post(
  "/session",
  passport.authenticate("local", {
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
      const allquestions =await Questions.getAllQuestions
      const votersCount=await Voter.countOFVoters(request.params.id);
      console.log(questionsCount)
     return response.render("questions",{
        id:request.params.id,
        title:election.electionName,
        csrfToken:request.csrfToken(),
        questionsC:questionsCount,
        votersC:votersCount,
        customURL:election.customURL,
      }) 
  }),
  app.get("/elections/:id/newquestion",connectEnsureLogin.ensureLoggedIn(),async(request,response)=>{
    
      const election=await Election.getElectionWithId(request.params.id);
      const questions=await Questions.getAllQuestions(request.params.id)
      if(election.isRunning==false){
        if(request.accepts("html")){
          return response.render("newquestion",{
            title:election.electionName,
            questions,
            csrfToken:request.csrfToken(),
            id:request.params.id,
          })
        }
        else{
          return response.json({question})
        }
      }
      else{
        request.flash("error","Cannot access questions while election is running");
        return response.redirect(`/election/${id}/`)
      }
    
    // catch(error){
    //   return response.status(422).json(error)
    // }

  });
  app.get("/elections/:id/newquestion/create",connectEnsureLogin.ensureLoggedIn(),async(request,response)=>{
    return response.render("create_question",{
      id: request.params.id,
      csrfToken:request.csrfToken()
    })
  })
  app.get("/election/create",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
    response.render("createElection",{
        title:"New Election",
        csrfToken:request.csrfToken(),
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
      const electionId=request.params.id
      await Questions.addNewQuestion({
        question,
        description,
        electionId,
      });
    return response.redirect(`/elections/${request.params.id}`)
    }
    catch(error){
      request.flash("error",error)
      return response.redirect(`/elections/${request.params.id}/newquestion/create`)

    } 
})

module.exports = app;
