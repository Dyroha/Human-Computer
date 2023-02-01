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
                },
                "json"
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

function generateGame() {
    //get random input
    let flag1 = Math.random() < 0.5 ? true : false;
    let flag2 = Math.random() < 0.5 ? true : false;

    return {
        input: [flag1, flag2],
        duration: Date.now(),
    };
}

async function postGameResult(game) {
    let package = {
        username: getCookieValue("username"),
        sessionID: getCookieValue("sessionID"),
        game: JSON.stringify(game),
    };
    //increment cookie for the gate
    let gateupdate = parseInt(getCookieValue(game.gate)) + 1;
    setCookie(game.gate, gateupdate);
    console.log(package);
    $.post(
        "/sendgame",
        package,
        (data) => {
            return (data.status = "success");
        },
        "application/json"
    );
}
