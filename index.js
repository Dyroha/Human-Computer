const express = require("express");
const { MongoClient } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));

const url = process.env.HCDB;
const client = new MongoClient(url);

var db;

let collections = {
    sessions: "",
    users: "",
    logs: "",
};

async function setupDB() {
    await client.connect();
    console.log("Connected");
    db = client.db("hc-db");
    collections.sessions = db.collection("sessions");
    collections.users = db.collection("users");
    collections.logs = db.collection("logs");
    Object.freeze(collections);
    return "Connected successfully to database server";
}

setupDB().then(console.log).catch(console.err);

const simplegates = ["AND", "OR", "XOR"];
const notgates = ["NAND", "NOR", "XNOR"];
const inputCombinations = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
];

function getFlags(index) {
    return inputCombinations[index];
}

function getCorrect(gate, flag1, flag2) {
    switch (gate) {
        case "AND":
            return flag1 && flag2;
        case "OR":
            return flag1 || flag2;
        case "XOR":
            return (flag1 && !flag2) || (!flag1 && flag2);
        case "NAND":
            return !(flag1 && flag2);
        case "NOR":
            return !(flag1 || flag2);
        case "XNOR":
            return !((flag1 && !flag2) || (!flag1 && flag2));
    }
}

//function to log events to database
async function logEvent(username, functionCalled, message) {
    //get current time
    let time = new Date().getTime();
    //create object to be inserted into database
    let log = {
        username: username,
        functionCalled: functionCalled,
        message: message,
        time: time,
    };
    //insert object into database
    try {
        await collections.logs.insertOne(log);
    } catch (error) {
        console.log(`Error worth logging: ${error}`);
        throw error;
    }
}

//generate unique session id
function generateSessionId() {
    let sessionId = "";
    let possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 10; i++) {
        sessionId += possible.charAt(
            Math.floor(Math.random() * possible.length)
        );
    }
    return sessionId;
}

//create session
async function createSession(username) {
    let sessionID = generateSessionId();
    let session = {
        username: username,
        sessionID: sessionID,
    };
    try {
        await collections.sessions.insertOne(session);
        return sessionID;
    } catch (error) {
        if (error instanceof MongoServerError) {
            console.log(`Error worth logging: ${error}`);
        }
        throw error;
    }
}

//check if session is valid
async function checkSession(sessionID) {
    let session = await collections.sessions.findOne({
        sessionID: sessionID,
    });
    return session != null;
}

app.get("/", (request, response) => {
    response.sendFile(__dirname + "/public/index.html");
});

app.get("/home", (request, response) => {
    response.sendFile(__dirname + "/public/home.html");
});

app.get("/demo", (request, response) => {
    response.sendFile(__dirname + "/public/demo.html");
});

app.get("/game", (request, response) => {
    response.sendFile(__dirname + "/public/game.html");
});

app.post("/checkSession", async (request, response) => {
    const data = request.body;
    const sessionID = data.sessionID;
    let sessionValid = await checkSession(sessionID);

    if (sessionValid) {
        response.json({
            status: "success",
            message: "Session is valid",
        });
    } else {
        response.json({
            status: "error",
            message: "Session has expired, please sign in again",
        });
    }
});

app.post("/logout", async (request, response) => {
    const data = request.body;
    console.log(data);
    const username = data.username;
    const deleteResponse = await collections.sessions.deleteMany({
        username: username,
    });

    console.log(deleteResponse);

    if (deleteResponse.deletedCount > 0) {
        response.json({
            status: "success",
            message: "Successfully logged out",
        });
    } else {
        logEvent(username, "logout", "session did not exist when logging out");
        response.json({
            status: "error",
            message: "Session does not exist logging out anyway",
        });
    }
});

app.post("/signin", async (request, response) => {
    const data = request.body;
    const username = data.username;
    const animal = data.animal;

    const foundUser = await collections.users.findOne({
        username: username,
        animal: animal,
    });

    if (!foundUser) {
        //report back no user found
        response.json({
            status: "error",
            message: "Invalid username or animal",
        });
    } else {
        var sessionID = await createSession(username);
        response.json({
            status: "success",
            message: "Successfully signed in",
            sessionID: sessionID,
            demoFinished: foundUser.demoFinished,
        });
    }
});

app.post("/signup", async (request, response) => {
    const data = request.body;
    const username = data.username;
    const animal = data.animal;

    const foundUser = await collections.users.findOne({
        username: username,
        animal: animal,
    });

    if (!foundUser) {
        collections.users.insertOne({
            username: username,
            animal: animal,
            demoFinished: false,
            gateCount: {
                AND: 0,
                OR: 0,
                XOR: 0,
                NAND: 0,
                NOR: 0,
                XNOR: 0,
            },
        });
        let sessionID = await createSession(username);
        logEvent(username, "signup", "User signed up");
        response.json({
            status: "success",
            message: "Successfully signed up",
            sessionID: sessionID,
        });
    } else {
        response.json({
            status: "error",
            message: "User already exists, pick a different username",
        });
    }
});

app.post("/demoFinished", async (request, response) => {
    let data = request.body;
    let username = data.username;
    await collections.users.updateOne(
        { username: username },
        {
            $set: { demoFinished: true },
            $currentDate: { lastModified: true },
        }
    );
    response.json({
        status: "success",
        message: "demo has been played",
    });
});

function createGameID() {
    var gameID = "";
    var possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 5; i++)
        gameID += possible.charAt(Math.floor(Math.random() * possible.length));

    return gameID;
}

app.post("/game", (request, response) => {
    const data = request.body;
    console.log(data);
    //for the user
    var sessionID = data.sessionID;

    //for the game if not started yet
    var gate = data.gate;

    //for the game if started
    var gameID = data.gameID;
    var answer = data.answer;
    var duration = data.duration;
    // check session
    checkSession(sessionID).then((result) => {
        if (result) {
            //get user from database using session id
            let username = result.username;
            let animal = result.animal;
            const userGames = new Datastore(
                "userGames/" + username + animal + ".db"
            );
            userGames.loadDatabase();
            var gameRound;
            if (gameID == "" || gameID == undefined) {
                //start game
                //generate random game id
                let gameID = createGameID();

                //generate random flags
                let flagsin = getFlags(Math.floor(Math.random() * 4));

                gameRound = {
                    gameID: gameID,
                    gate: gate,
                    flag1: flagsin[0],
                    flag2: flagsin[1],
                    rightAnswer: getCorrect(gate, flagsin[0], flagsin[1]),
                    userAnswer: null,
                    correct: null,
                    duration: null,
                    date: null,
                };

                //insert game into user database
                userGames.insert(gameRound);

                //send game id and flags to user
                response.json({
                    status: "start game",
                    gameID: gameID,
                    flag1: flagsin[0],
                    flag2: flagsin[1],
                });
            } else {
                //check answer
                userGames.find({ gameID: gameID }, (err, docs) => {
                    if (docs.length > 0) {
                        gameRound = docs[0];
                        //update game round (answers are stored as booleans)
                        gameRound.userAnswer = answer;
                        gameRound.correct = answer === gameRound.rightAnswer;
                        gameRound.duration = duration;
                        gameRound.date = Date.now();
                        const gameUpdate = (err, numReplaced) => {
                            if (err) {
                                response.json({
                                    status: "error",
                                    message: err,
                                });
                            } else {
                                //get new flags, make suer they are not the same as the old ones
                                var flagsin = getFlags(
                                    Math.floor(Math.random() * 4)
                                );
                                while (
                                    flagsin[0] == gameRound.flag1 &&
                                    flagsin[1] == gameRound.flag2
                                ) {
                                    flagsin = getFlags(
                                        Math.floor(Math.random() * 4)
                                    );
                                }
                                var newGameID = createGameID();
                                //create new game round
                                let newGameRound = {
                                    gameID: newGameID,
                                    gate: gate,
                                    flag1: flagsin[0],
                                    flag2: flagsin[1],
                                    rightAnswer: getCorrect(
                                        gate,
                                        flagsin[0],
                                        flagsin[1]
                                    ),
                                    userAnswer: null,
                                    correct: null,
                                    duration: null,
                                };

                                //insert game into user database
                                userGames.insert(newGameRound);

                                var status = gameRound.correct
                                    ? "correct"
                                    : "incorrect";

                                //send new flags to user
                                response.json({
                                    status: status,
                                    gameID: newGameID,
                                    flag1: flagsin[0],
                                    flag2: flagsin[1],
                                });
                            }
                        };
                        userGames.update(
                            { gameID: gameID },
                            gameRound,
                            {},
                            gameUpdate
                        );
                    }
                });
            }
        } else {
            response.json({ status: "error", message: "Invalid session" });
        }
    });
});

function getInputs(number) {
    inputs = [];
    for (let i = 0; i < number; i++) {
        let flagsin = getFlags(Math.floor(Math.random() * 4));
        if (i == 0) {
            inputs[0] = flagsin;
        } else {
            while (inputs[i - 1] == flagsin) {
                flagsin = getFlags(Math.floor(Math.random() * 4));
            }
            inputs[i] = flagsin;
        }
    }
    return inputs;
}
