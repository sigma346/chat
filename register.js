const registerForm =
    document.querySelector("#register-form");

const usernameInput =
    document.querySelector("#username-input");

const emailInput =
    document.querySelector("#email-input");

const passwordInput =
    document.querySelector("#password-input");

const confirmPasswordInput =
    document.querySelector("#confirm-password-input");

const registerButton =
    document.querySelector("#register-button");

const registerMessage =
    document.querySelector("#register-message");

function showRegisterMessage(message, type = "error") {
    registerMessage.textContent = message;
    registerMessage.className =
        `form-message ${type}`.trim();
}

registerForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        showRegisterMessage("");

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmedPassword =
            confirmPasswordInput.value;

        const validUsername =
            /^[A-Za-z0-9_]{3,20}$/.test(username);

        if (!validUsername) {
            showRegisterMessage(
                "Username must be 3–20 characters using letters, numbers or underscores."
            );

            return;
        }

        if (password.length < 8) {
            showRegisterMessage(
                "Password must contain at least 8 characters."
            );

            return;
        }

        if (password !== confirmedPassword) {
            showRegisterMessage(
                "The passwords do not match."
            );

            return;
        }

        registerButton.disabled = true;

        try {
            const loginPageUrl =
                new URL(
                    "login.html",
                    window.location.href
                ).href;

            const {
                data,
                error
            } = await window.supabaseClient.auth.signUp({
                email,
                password,

                options: {
                    data: {
                        username
                    },

                    emailRedirectTo: loginPageUrl
                }
            });

            if (error) {
                throw error;
            }

            registerForm.reset();

            if (data.session) {
                window.location.href = "account.html";
                return;
            }

            showRegisterMessage(
                "Account created. Check your email and confirm the account before logging in.",
                "success"
            );
        } catch (error) {
            console.error(error);

            showRegisterMessage(
                error.message ||
                "The account could not be created."
            );
        } finally {
            registerButton.disabled = false;
        }
    }
);