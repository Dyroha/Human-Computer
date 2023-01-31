function boolToFlag(bool) {
    if (bool) {
        return "🏴";
    } else {
        return "🏳️";
    }
}

var flags = [
    ["🏴", "🏴", "🏴"],
    ["🏴", "🏳️", "🏳️"],
    ["🏳️", "🏴", "🏳️"],
    ["🏳️", "🏳️", "🏳️"],
];

function doDemo(part, answer = null) {
    console.log(part + " " + answer);
    if (answer != null) {
        if (answer != flags[part][2]) {
            alert("Incorrect answer, try again");
            return part;
        } else if (part == 3) {
            $(".gameArea").html(
                "Good job completing the demo</br></br>" +
                    "The other games will tell you how to respond and give you the Truth Table for your first 5 attempts so make sure you study it carefully</br>" +
                    "It will not highlight the Truth Table or tell you if you are correct or not</br>" +
                    "Once you have completed the first 5 attempts the truth table will only be able to be viewed by hovering the box saying Truth Table</br></br>" +
                    "If you ever need a refresher you can repeat the demo at by clicking the demo button at the top of the home page</br></br>" +
                    "You can now go back to the home menu to do the puzzles :) (button at the top left of the page)"
            );
            $.post(
                "/demofinished",
                { username: getCookieValue("username") },
                (data) => {
                    if (data.status == "success") {
                        console.log("Demo completed and logged");
                    }
                }
            );
            document.cookie = "demo=true";
            return;
        } else {
            part += 1;
            $("#answer").text("");
            alert("Correct answer, try the next one");
        }
    }
    $("#row" + part).css("background-color", "transparent");
    $("#flag1").text(flags[part][0]);
    $("#flag2").text(flags[part][1]);
    // highlight row of truthTable that corresponds to demoPart
    $("#row" + (part + 1)).css("background-color", "yellow");
    return part;
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
