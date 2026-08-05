const loginForm =
    document.querySelector("#login-form");

const emailInput =
    document.querySelector("#email-input");

const passwordInput =
    document.querySelector("#password-input");

const loginButton =
    document.querySelector("#login-button");

const loginMessage =
    document.querySelector("#login-message");

function showLoginMessage(message) {
    loginMessage.textContent = message;
}

function formatAccessDate(value) {
    if (!value) {
        return "until an administrator removes the ban";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "until the ban expires";
    }

    return `until ${date.toLocaleString()}`;
}

function buildAccessMessage(status) {
    if (status?.account_deleted) {
        return "This account has been deleted and can no longer be used.";
    }

    const reason = status?.reason
        ? ` Reason: ${status.reason}`
        : "";

    return `This account is banned ${formatAccessDate(status?.banned_until)}.${reason}`;
}

async function checkSignedInAccountAccess() {
    const {
        data: { user },
        error: userError
    } = await window.supabaseClient.auth.getUser();

    if (userError || !user) {
        showLoginMessage(
            "This account session is no longer active. If the account was banned, contact an administrator for help."
        );
        await window.supabaseClient.auth.signOut({
            scope: "local"
        });
        return false;
    }

    const { data: status, error } =
        await window.supabaseClient.rpc(
            "get_my_account_access_status"
        );

    // Keep login compatible until migration 56 is installed.
    if (error || !status) {
        if (error) {
            console.warn(
                "Account access status could not be checked.",
                error
            );
        }
        return true;
    }

    if (status.allowed === true) {
        return true;
    }

    showLoginMessage(buildAccessMessage(status));

    await window.supabaseClient.auth.signOut({
        scope: "local"
    });

    return false;
}

function friendlyAuthError(error) {
    const message = String(error?.message || "");

    if (/banned|user_banned/i.test(message)) {
        return "This account is currently banned. Contact an administrator if you think this is a mistake.";
    }

    return message || "The account could not be logged in.";
}

async function redirectIfAlreadyLoggedIn() {
    const {
        data: {
            session
        }
    } = await window.supabaseClient.auth.getSession();

    if (session && await checkSignedInAccountAccess()) {
        window.location.href = "index.html";
    }
}

loginForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        showLoginMessage("");

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        loginButton.disabled = true;

        try {
            const {
                error
            } =
                await window.supabaseClient.auth
                    .signInWithPassword({
                        email,
                        password
                    });

            if (error) {
                throw error;
            }

            if (await checkSignedInAccountAccess()) {
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error(error);

            showLoginMessage(
                friendlyAuthError(error)
            );
        } finally {
            loginButton.disabled = false;
        }
    }
);

const accessMessage = window.sessionStorage.getItem(
    "casino-account-access-message"
);

if (accessMessage) {
    window.sessionStorage.removeItem(
        "casino-account-access-message"
    );
    showLoginMessage(accessMessage);
}

redirectIfAlreadyLoggedIn();
