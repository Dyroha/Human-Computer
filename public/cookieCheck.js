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
function cookiePresent(cookieName) {
    return !(document.cookie.indexOf(cookieName) < 0);
}

//get specific cookie values
function getCookieValue(cookieName) {
    let value = "; " + document.cookie;
    let parts = value.split("; " + cookieName + "=");
    if (parts.length == 2) return parts.pop().split(";").shift();
}

//set cookie values
function setCookie(cookieName, cookieValue, duration = null) {
    let cookie = cookieName + "=" + cookieValue;
    if (duration) {
        let date = new Date();
        date.setTime(date.getTime() + duration);
        cookie += "; expires=" + date.toUTCString();
    }
    cookie += "; path=/";
    document.cookie = cookie;
}

//check if session is valid
function checkSession() {
    let sessionID = getCookieValue("sessionID");
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
}

//logOut function that ends session and redirects to /
function logOut() {
    $.post(
        "/logOut",
        { username: getCookieValue("username") },
        (response) => {
            if (response.status == "success") {
                deleteAllCookies();
                window.location.href = "/";
            }
        },
        "json"
    );
}
