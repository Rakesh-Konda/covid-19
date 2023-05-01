const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const jwt = require("jsonwebtoken");
let db = null;

const hlo = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(2000, () => {
      console.log("Server Running at http://localhost:2000/");
    });
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};
hlo();

const convert = (msg) => {
  return {
    stateId: msg.state_id,
    stateName: msg.state_name,
    population: msg.population,
  };
};

const convertDist = (msg) => {
  return {
    districtId: msg.district_id,
    districtName: msg.district_name,
    stateId: msg.state_id,
    cases: msg.cases,
    cured: msg.cured,
    active: msg.active,
    deaths: msg.deaths,
  };
};

const middlewareFun = (request, response, next) => {
  const authHead = request.headers["authorization"];
  let jwtToken;
  if (authHead !== undefined) {
    jwtToken = authHead.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "akdjkahsdklskd", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//states
app.get("/states/", middlewareFun, async (request, response) => {
  const query = `SELECT * FROM state;`;
  const hlo = await db.all(query);
  response.send(hlo.map(convert));
});

//states Id
app.get("/states/:stateId/", middlewareFun, async (request, response) => {
  const { stateId } = request.params;
  const query = `SELECT * FROM state
    WHERE state_id="${stateId}";`;
  const hlo = await db.get(query);
  response.send(convert(hlo));
});

// post district
app.post("/districts/", middlewareFun, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const query = `INSERT INTO district
    (district_name,state_id,cases,cured,active,deaths)
    VALUES ("${districtName}",${stateId},"${cases}",
    "${cured}","${active}","${deaths}");`;
  await db.run(query);
  response.send("District Successfully Added");
});

//get district by Id
app.get("/districts/:districtId/", middlewareFun, async (request, response) => {
  const { districtId } = request.params;
  const query = `SELECT * FROM district
     WHERE district_id="${districtId}";`;
  const hlo = await db.get(query);
  response.send(convertDist(hlo));
});

//delete district by Id
app.delete(
  "/districts/:districtId/",
  middlewareFun,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `DELETE FROM district
     WHERE district_id="${districtId}";`;
    await db.get(query);
    response.send("District Removed");
  }
);

//put district by id
app.put("/districts/:districtId/", middlewareFun, async (request, response) => {
  const { districtId } = request.params;
  const del = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = del;
  const query = `UPDATE district SET
    district_name="${districtName}",state_id=${stateId},cases=${cases},
    cured=${cured},active=${active},deaths=${deaths}
    WHERE district_id=${districtId};`;
  await db.run(query);
  response.send("District Details Updated");
});

//get total cases by state id
app.get("/states/:stateId/stats/", middlewareFun, async (request, response) => {
  const { stateId } = request.params;
  const query = `SELECT SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths FROM district WHERE
    state_id=${stateId};`;
  const hlo = await db.get(query);
  response.send(hlo);
});

//register
app.post("/user/", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const sQuery = `SELECT * FROM user WHERE username="${username}";`;
  const dbUser = await db.get(sQuery);
  if (dbUser === undefined) {
    const query = `INSERT INTO user(username,password)
    VALUES ("${username}","${hashedPassword}");`;
    await db.run(query);
    response.send("User added Successfully");
  } else {
    response.status(401);
    response.send("User already Exists");
  }
});

//login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const query = `SELECT * FROM user WHERE username="${username}";`;
  const dbUser = await db.get(query);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passCheck = await bcrypt.compare(password, dbUser.password);
    if (passCheck === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "akdjkahsdklskd");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

module.exports = app;
