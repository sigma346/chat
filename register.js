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

function emailLooksValid(email) {
    if (
        email.length < 6
        || email.length > 254
        || /\s/.test(email)
    ) {
        return false;
    }

    const parts = email.split("@");
    if (parts.length !== 2) {
        return false;
    }

    const [localPart, domain] = parts;
    if (
        !localPart
        || localPart.length > 64
        || localPart.startsWith(".")
        || localPart.endsWith(".")
        || localPart.includes("..")
        || !domain.includes(".")
    ) {
        return false;
    }

    return domain.split(".").every((label) =>
        label.length > 0
        && label.length <= 63
        && !label.startsWith("-")
        && !label.endsWith("-")
        && /^[A-Za-z0-9-]+$/.test(label)
    );
}

async function parseFunctionError(error) {
    try {
        if (error?.context instanceof Response) {
            const payload = await error.context.clone().json();
            return payload?.error || error.message;
        }
    } catch {
        // Fall through to the client error.
    }

    return error?.message || "The email address could not be checked.";
}

async function validateEmailAddress(email) {
    const { data, error } = await window.supabaseClient.functions.invoke(
        "validate-email-domain",
        { body: { email } }
    );

    if (error) {
        throw new Error(await parseFunctionError(error));
    }
    if (!data?.valid) {
        throw new Error(
            data?.error || "Enter an email address with a working mail domain."
        );
    }

    return data.email || email.toLowerCase();
}

registerForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        showRegisterMessage("");

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
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

        if (!emailLooksValid(email)) {
            showRegisterMessage(
                "Enter a complete email address in the format name@example.com."
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
            showRegisterMessage(
                "Checking the email domain…",
                "success"
            );

            const validatedEmail = await validateEmailAddress(email);

            const {
                data,
                error
            } = await window.supabaseClient.auth.signUp({
                email: validatedEmail,
                password,

                options: {
                    data: {
                        username
                    }
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
                "Account created. You can log in now; no email confirmation is required.",
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
