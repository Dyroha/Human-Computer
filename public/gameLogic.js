function boolToFlag(bool) {
    if (bool) {
        return "🏴";
    } else {
        return "🏳️";
    }
}

function doDemo(part, answer = null) {
    console.log(part + " " + answer);
    //get session id
    var sessionID = getCookieValue("sessionID");
    $.post(
        "/demo",
        {
            sessionID: sessionID,
            part: part,
            flag1: flag1,
            flag2: flag2,
            answer: answer,
        },
        (data) => {
            console.log(data.status);
            if (data.status == "start demo" || data.status == "correct") {
                flag1 = data.flag1;
                flag2 = data.flag2;
                $("#flag1").text(boolToFlag(flag1));
                $("#flag2").text(boolToFlag(flag2));

                $("#row" + demoPart).css("background-color", "transparent");
                demoPart += 1;
                // highlight row of truthTable that corresponds to demoPart
                $("#row" + demoPart).css("background-color", "yellow");
            } else if (data.status == "incorrect") {
                alert("Incorrect");
            } else {
                endDemo();
            }
        },
        "json"
    );
}

function endDemo() {
    //remove .response:hover from #flagL and #flagR
    $("#flagL").removeClass("response");
    $("#flagR").removeClass("response");
    //update demo cookie to true
    document.cookie = "demo=true";
    //wait 2 seconds
    setTimeout(() => {
        $("#demoBox").hide();
        $("#gameMessages").html(
            "You have completed the demo!<br><br>You may now play the game.<br><br>Go back to the home page to start playing."
        );
    }, 2000);
}

//game logic
function startRound(gate) {
    //get session id
    var sessionID = getCookieValue("sessionID");
    var package = {
        sessionID: sessionID,
        gate: gate,
    };
    $.post(
        "/game",
        package,
        (data) => {
            console.log(data.status);
            if (data.status == "start game") {
                flag1 = data.flag1;
                flag2 = data.flag2;
                gameID = data.gameID;
                $("#flag1").text(boolToFlag(flag1));
                $("#flag2").text(boolToFlag(flag2));
                startTime = new Date().getTime();
            } else {
                alert("Error: " + data.status);
            }
        },
        "json"
    );
}

function sendAnswer(startTime, currentGameID, answer) {
    //remove input flags
    $("#flag1").text("");
    $("#flag2").text("");

    let sessionID = getCookieValue("sessionID");
    let endTime = new Date().getTime();
    let duration = endTime - startTime;
    let package = {
        sessionID: sessionID,
        gameID: currentGameID,
        answer: answer,
        duration: duration,
    };
    console.log(package);
    $.post(
        "/game",
        package,
        (data) => {
            if (data.status == "correct" || data.status == "incorrect") {
                //wait 2 seconds
                setTimeout(() => {
                    flag1 = data.flag1;
                    flag2 = data.flag2;
                    gameID = data.gameID;
                    $("#flag1").text(boolToFlag(flag1));
                    $("#flag2").text(boolToFlag(flag2));
                    //make sure the user can click on the flags
                    $("#flagL").addClass("response");
                    $("#flagR").addClass("response");
                    time = new Date().getTime();
                }, 2000);
            } else if (data.status == "end game") {
                endGame();
            } else {
                alert("Error: " + data.status);
            }
        },
        "json"
    );
}
