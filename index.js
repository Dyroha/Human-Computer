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
    const username = data.username;
    const deleteResponse = await collections.sessions.deleteMany({
        username: username,
    });

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
            gateCount: foundUser.gateCount,
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
        let newUser = {
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
        };
        collections.users.insertOne(newUser);
        let sessionID = await createSession(username);
        logEvent(username, "signup", "User signed up");
        response.json({
            status: "success",
            message: "Successfully signed up",
            sessionID: sessionID,
            gateCount: newUser.gateCount,
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

app.post("/sendgame", async (request, response) => {
    const data = request.body;
    //for the user
    const username = data.username;
    const sessionID = data.sessionID;

    //check session
    let sessionValid = checkSession(sessionID);
    //if session valid...
    if (sessionValid) {
        //get game data, {gate: input: userResponse: duration: time:}
        let game = JSON.parse(data.game);
        //add correct if user input is correct or not
        game.correct =
            getCorrect(game.gate, game.input[0], game.input[1]) ==
            game.userResponse;
        //add dateTime now
        game.time = Date.now();
        //send to database for that user
        //get/create collection
        let usergames = db.collection(username + "Games");
        try {
            await usergames.insertOne(game);
            response.json({
                status: "success",
                message: "game compleated",
            });
        } catch (error) {
            logEvent(username, "sendgame", "Failed to add game to database");
            response.json({
                status: "error",
                message:
                    "something when wrong when adding the game to the database, contact the admin",
            });
        }

        //increment games done of this type for user in users collection
        let gateUpdateStr = "gateCount." + game.gate;
        collections.users.updateOne(
            { username: username },
            { $inc: { [gateUpdateStr]: 1 } }
        );
    } else {
        //error response
        response.json({
            status: "error",
            message: "session has ended, reload the page to login again",
        });
    }
});
