const request = require("supertest");
const cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");

let server, agent;

function extractCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

// eslint-disable-next-line no-unused-vars
const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let csrfToken = extractCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
};

describe("Online voting application", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4040, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });
  //signup
  test("Sign up", async () => {
    let res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/admin").send({
      firstName: "Peter",
      lastName: "Parker",
      email: "peter@gmail.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });
  // sign in
  test("Sign in", async () => {
    const agent = request.agent(server);
    let res = await agent.get("/elections");
    expect(res.statusCode).toBe(302);
    await login(agent, "peter@gmail.com", "12345678");
    res = await agent.get("/elections");
    expect(res.statusCode).toBe(200);
  });
  //sign out
  test("Sign out", async () => {
    let res = await agent.get("/elections");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/elections");
    expect(res.statusCode).toBe(302);
  });
  // Creating Election
  test("Creating a New Election After login", async () => {
    const agent = request.agent(server);
    await login(agent, "peter@gmail.com", "12345678");
    const res = await agent.get("/election/create");
    const csrfToken = extractCsrfToken(res);
    const response = await agent.post("/elections").send({
      electionName: "GwenQuest",
      customURL: "peterParker",
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });
  // Adding Questions in new election
  test("Adding a new question", async () => {
    const agent = request.agent(server);
    await login(agent, "peter@gmail.com", "12345678");
    //Creating a new Election
    let res = await agent.get("/election/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "GwenQuest2",
      customURL: "milesmorales",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    //Now adding a question
    res = await agent.get(`/elections/${latestElection.id}/newquestion/create`);
    csrfToken = extractCsrfToken(res);
    let response = await agent
      .post(`/elections/${latestElection.id}/newquestion/create`)
      .send({
        question: "Who is spiderman?",
        description: "No one knows",
        _csrf: csrfToken,
      });
    expect(response.statusCode).toBe(302);
  });

  //Adding Options
  test("Adding an Option to the created question", async () => {
    const agent = request.agent(server);
    await login(agent, "peter@gmail.com", "12345678");

    //Creating a new Election
    let res = await agent.get("/election/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "NewElection",
      customURL: "newstring",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    //Now adding a question
    res = await agent.get(`/elections/${latestElection.id}/newquestion/create`);
    csrfToken = extractCsrfToken(res);
    await agent
      .post(`/elections/${latestElection.id}/newquestion/create`)
      .send({
        question: "Does Area 51 is real?",
        description: "No one knows",
        _csrf: csrfToken,
      });

    const groupedQuestionsResponse = await agent
      .get(`/elections/${latestElection.id}/newquestion`)
      .set("Accept", "application/json");
    const parsedQuestionsGroupedResponse = JSON.parse(
      groupedQuestionsResponse.text
    );
    const questionCount = parsedQuestionsGroupedResponse.questions.length;
    const latestQuestion =
      parsedQuestionsGroupedResponse.questions[questionCount - 1];

    res = await agent.get(
      `/elections/${latestElection.id}/newquestion/create/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);

    res = await agent
      .post(
        `/elections/${latestElection.id}/newquestion/create/${latestQuestion.id}`
      )
      .send({
        _csrf: csrfToken,
        option: "Test option",
      });
    expect(res.statusCode).toBe(302);
  });
  // New Voter
  test("Adding A New Voter", async () => {
    const agent = request.agent(server);
    await login(agent, "peter@gmail.com", "12345678");

    //create new election
    let res = await agent.get("/election/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "2023 CBM Elections",
      customURL: "cbm",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    //Adding Voter To This Election
    res = await agent.get(`/elections/${latestElection.id}/voters/new`);
    csrfToken = extractCsrfToken(res);
    res = await agent.post(`/elections/${latestElection.id}/voters/new`).send({
      voterUserId: "Voter1",
      voterPassword: "87654321",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });
  // Test For Election Preview
  test("Preview and Launch Election", async () => {
    const agent = request.agent(server);
    await login(agent, "peter@gmail.com", "12345678");

    //create new election
    let res = await agent.get("/election/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "SpiderManQuest",
      customURL: "webUp",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    res = await agent.get(`/elections/${latestElection.id}/election_preview`);
    csrfToken = extractCsrfToken(res);
    expect(res.statusCode).toBe(302);
  });
  // Test To Start Election
  test("Start The Election", async () => {
    const agent = request.agent(server);
    await login(agent, "peter@gmail.com", "12345678");

    //create new election
    let res = await agent.get("/election/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "BatmanQuest",
      customURL: "batMobo",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    //Adding a Question
    res = await agent.get(`/elections/${latestElection.id}/newquestion/create`);
    csrfToken = extractCsrfToken(res);
    await agent
      .post(`/elections/${latestElection.id}/newquestion/create`)
      .send({
        question: "Is Peter Parker Spiderman?",
        description: "Vote with caution",
        _csrf: csrfToken,
      });

    const groupedQuestionsResponse = await agent
      .get(`/elections/${latestElection.id}/newquestion`)
      .set("Accept", "application/json");
    const parsedQuestionsGroupedResponse = JSON.parse(
      groupedQuestionsResponse.text
    );
    const questionCount = parsedQuestionsGroupedResponse.questions.length;
    const latestQuestion =
      parsedQuestionsGroupedResponse.questions[questionCount - 1];

    res = await agent.get(
      `/elections/${latestElection.id}/newquestion/create/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);

    res = await agent
      .post(
        `/elections/${latestElection.id}/newquestion/create/${latestQuestion.id}`
      )
      .send({
        _csrf: csrfToken,
        option: "Yes",
      });

    //adding another option
    res = await agent.get(
      `/elections/${latestElection.id}/newquestion/create/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);

    res = await agent
      .post(
        `/elections/${latestElection.id}/newquestion/create/${latestQuestion.id}`
      )
      .send({
        _csrf: csrfToken,
        option: "No",
      });
    //Adding Voter
    res = await agent.get(`/elections/${latestElection.id}/voters/new`);
    csrfToken = extractCsrfToken(res);
    res = await agent.post(`/elections/${latestElection.id}/voters/new`).send({
      voterUserId: "Voter2",
      voterPassword: "87654321",
      _csrf: csrfToken,
    });

    res = await agent.get(`/elections/${latestElection.id}/election_preview`);
    csrfToken = extractCsrfToken(res);

    // isRunning attribute of Election is false by default
    expect(latestElection.isRunning).toBe(false);
    res = await agent.put(`/elections/${latestElection.id}/start`).send({
      _csrf: csrfToken,
    });
    const launchedElectionRes = JSON.parse(res.text);
    expect(launchedElectionRes[1][0].isRunning).toBe(true);
  });
});
