function deleteAllCookies() {
    const cookies = document.cookie.split(";");

    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
}

//if cookies are present, clear cookies and redirect to index page
function cookiePresent(...cookieNames) {
    for (const cookieName of cookieNames) {
        if (document.cookie.indexOf(cookieName) < 0) {
            return false;
        }
    }
    return true;
}

//get specific cookie values
function getCookieValue(cookieName) {
    var cookieSplit = document.cookie.split(";");
    for (var i = 0; i < cookieSplit.length; i++) {
        if (cookieSplit[i].indexOf(cookieName) >= 0) {
            return cookieSplit[i].split("=")[1];
        }
    }
}

//set cookie values
function setCookie(cookieName, cookieValue, duration = null) {
    var cookie = cookieName + "=" + cookieValue;
    if (duration) {
        var date = new Date();
        date.setTime(date.getTime() + duration);
        cookie += "; expires=" + date.toUTCString();
    }
    cookie += "; path=/";
    document.cookie = cookie;
}

//check if session is valid
function checkSession() {
    //create loading p
    var loading = document.createElement("p");
    loading.innerHTML = "Loading...";
    document.body.appendChild(loading);

    var sessionID = getCookieValue("sessionID");
    //ajax call to check session syncronously
    $.ajax({
        url: "/checkSession",
        type: "POST",
        data: { sessionID: sessionID },
        async: false,
        success: (response) => {
            if (response.status == "error") {
                deleteAllCookies();
                alert(response.message);
                window.location.href = "/";
            }
        },
        dataType: "json",
    });
    document.body.removeChild(loading);
}

//logOut function that ends session and redirects to /
function logOut() {
    $.post(
        "/logOut",
        { sessionID: getCookieValue("sessionID") },
        (response) => {
            if (response.status == "success") {
                deleteAllCookies();
                window.location.href = "/";
            }
        },
        "json"
    );
}
