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

async function redirectIfAlreadyLoggedIn() {
    const {
        data: {
            session
        }
    } = await window.supabaseClient.auth.getSession();

    if (session) {
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

            window.location.href = "index.html";
        } catch (error) {
            console.error(error);

            showLoginMessage(
                error.message ||
                "The account could not be logged in."
            );
        } finally {
            loginButton.disabled = false;
        }
    }
);

redirectIfAlreadyLoggedIn();