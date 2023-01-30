const express = require("express");
const Datastore = require("nedb");
const app = express();
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));

const userDatabase = new Datastore("db/users.db");
userDatabase.loadDatabase();

const sessionDatabase = new Datastore("db/sessions.db");
sessionDatabase.loadDatabase();

const logDatabase = new Datastore("db/logs.db");
logDatabase.loadDatabase();

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
function logEvent(username, animal, functionCalled, message) {
    //get current time
    var time = new Date().getTime();
    //create object to be inserted into database
    var log = {
        username: username,
        animal: animal,
        functionCalled: functionCalled,
        message: message,
        time: time,
    };
    //insert object into database
    logDatabase.insert(log);
}

//generate unique session id
function generateSessionId() {
    var sessionId = "";
    var possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 10; i++) {
        sessionId += possible.charAt(
            Math.floor(Math.random() * possible.length)
        );
    }
    return sessionId;
}

//create session
function createSession(username, animal) {
    var sessionID = generateSessionId();
    var session = {
        username: username,
        animal: animal,
        sessionID: sessionID,
        expiration: new Date().getTime() + 3600000,
    };
    sessionDatabase.insert(session);
    return sessionID;
}

//check if session is valid
function checkSession(sessionID) {
    return new Promise((resolve, reject) => {
        sessionDatabase.find({ sessionID: sessionID }, (err, docs) => {
            console.log(err, docs);
            if (err) {
                reject(err);
            } else {
                if (docs.length > 0) {
                    var session = docs[0];
                    if (session.expiration > new Date().getTime()) {
                        resolve({
                            username: docs[0].username,
                            animal: docs[0].animal,
                        });
                    } else {
                        resolve(false);
                    }
                } else {
                    resolve(false);
                }
            }
        });
    });
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

app.post("/checkSession", (request, response) => {
    const data = request.body;
    const sessionID = data.sessionID;
    checkSession(sessionID)
        .then((sessionValid) => {
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
        })
        .catch((err) => {
            response.json({ status: "error", message: err });
        });
});

app.post("/logout", (request, response) => {
    const data = request.body;
    const sessionID = data.sessionID;
    sessionDatabase.remove({ sessionID: sessionID }, {}, (err, numRemoved) => {
        if (numRemoved > 0) {
            response.json({
                status: "success",
                message: "Successfully logged out",
            });
        } else {
            response.json({ status: "error", message: "Failed to log out" });
        }
    });
});

app.post("/signin", (request, response) => {
    const data = request.body;
    const username = data.username;
    const animal = data.animal;
    userDatabase.find({ username: username, animal: animal }, (err, docs) => {
        if (docs < 1) {
            logEvent(
                username,
                animal,
                "signin",
                "User not found, failed to sign in"
            );
            response.json({
                status: "error",
                message: "Invalid username or animal",
            });
        } else {
            var sessionID = createSession(username, animal);
            logEvent(username, animal, "signin", "User signed in");
            response.json({
                status: "success",
                message: "Successfully signed in",
                sessionID: sessionID,
                demoFinished: docs[0].demoFinished,
            });
        }
    });
});

app.post("/signup", (request, response) => {
    const data = request.body;
    const username = data.username;
    const animal = data.animal;
    userDatabase.find({ username: username }, (err, docs) => {
        if (docs < 1) {
            userDatabase.insert({
                username: username,
                animal: animal,
                demoFinished: false,
                noAND: 0,
                noOR: 0,
                noXOR: 0,
                noNAND: 0,
                noNOR: 0,
                noXNOR: 0,
            });
            var sessionID = createSession(username, animal);
            logEvent(username, animal, "signup", "User signed up");
            response.json({
                status: "success",
                message: "Successfully signed up",
                sessionID: sessionID,
            });
        } else {
            logEvent(
                username,
                animal,
                "signup",
                "User already exists, failed to sign up"
            );
            response.json({
                status: "error",
                message: "User already exists, pick a different username",
            });
        }
    });
});

app.post("/demo", (request, response) => {
    //only uses and gate
    const data = request.body;
    const part = data.part;

    if (part == "4") {
        //get user from database using session id
        const sessionID = data.sessionID;
        sessionDatabase.find({ sessionID: sessionID }, (err, docs) => {
            userDatabase.update(
                { username: docs[0].username, animal: docs[0].animal },
                { $set: { demoFinished: true } },
                {},
                (err, numReplaced) => {
                    if (err) {
                        response.json({ status: "error", message: err });
                    } else {
                        response.json({
                            status: "success",
                            message: "Successfully finished demo",
                        });
                    }
                }
            );
        });
    } else if (part == "0") {
        //start demo
        var flagsin = getFlags(parseInt(part));
        console.log(flagsin);
        response.json({
            status: "start demo",
            flag1: flagsin[0],
            flag2: flagsin[1],
        });
    } else {
        //check answer
        const flag1 = data.flag1;
        const flag2 = data.flag2;
        const answer = data.answer;
        var correct = getCorrect("AND", flag1, flag2);
        console.log(answer + " " + correct);
        if (answer == correct) {
            var flagsin = getFlags(parseInt(part));
            response.json({
                status: "correct",
                flag1: flagsin[0],
                flag2: flagsin[1],
            });
        } else {
            response.json({
                status: "incorrect",
            });
        }
    }
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

app.post("/newgame", (request, response) => {
    const data = request.body;
    const gate = data.gate;
    const number = data.number;
    const sessionID = data.sessionID;
    var inputFlags = getInputs(number);
    var correctAnswers = inputFlags.map((x) => getCorrect(gate, x[0], x[1]));
    //put flags and game id in database
    checkSession(sessionID)
        .then((result) => {
            if (result) {
                //get user from database using session id
                let username = result.username;
                let animal = result.animal;
                const userGames = new Datastore(
                    "userGames/" + username + animal + ".db"
                );
                userGames.loadDatabase();
                //generate gameID
                var gameID = createGameID();
                var game = {
                    gameID: gameID,
                    gate: gate,
                    inputFlags: inputFlags,
                    correctAnswers: correctAnswers,
                    userAnswers: null,
                    times: null,
                    numberCorrect: 0,
                };
                userGames.insert(game);
                response.json({
                    status: "start game",
                    gameID: gameID,
                    gate: gate,
                    inputFlags: inputFlags,
                });
            } else {
                response.json({
                    status: "error",
                    message: "Invalid Session ID",
                });
            }
        })
        .catch((error) => {
            response.json({
                status: "error",
                message: "Something went wrong",
            });
        });
});

app.post("/answergame", (request, response) => {
    //check session, get user, update database, add count to user gate (for progress visuals and see if to show truth table or not)
    const data = request.body;
    const sessionID = data.sessionID;
    const gameID = data.gameID;
    const answerFlags = data.answerFlags;
    const times = data.times;

    //check session
    checkSession(sessionID)
        .then((result) => {
            if (result) {
                //get user from database using session id
                let username = result.username;
                let animal = result.animal;
                const userGames = new Datastore(
                    "userGames/" + username + animal + ".db"
                );
                userGames.loadDatabase();

                //get game from database
                userGames.find({ gameID: gameID }, (err, docs) => {
                    if (len(docs) > 0) {
                        let game = docs[0];

                        if (len(game.inputFlags) == len(answerFlags)) {
                            game.userAnswers = answerFlags;
                            let numCorrect = 0;
                            for (var i = 0; i < game.inputFlags; i++) {
                                if (
                                    getCorrect(
                                        game.gate,
                                        game.inputFlags[i][0],
                                        game.inputFlags[i][0]
                                    ) == answerFlags[i]
                                ) {
                                    numCorrect += 1;
                                }
                            }
                            game.numberCorrect = numCorrect;
                            game.times = times;
                            //update database
                            userGames.update({ gameID: gameID }, game);
                        }
                    }
                    response({
                        status: "error",
                        message:
                            "something when wrong with the game, refresh the page",
                    });
                });
            }
        })
        .catch((error) => {
            response({
                status: "error",
                message: "invalid session",
            });
        });
});
