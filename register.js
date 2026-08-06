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

const EMAIL_DOMAIN_CHECK_TIMEOUT_MS = 7000;

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

function functionCheckIsUnavailable(error) {
    const errorName = String(error?.name || "");
    const message = String(error?.message || "").toLowerCase();
    const status = Number(error?.context?.status);

    return errorName === "FunctionsFetchError"
        || errorName === "FunctionsRelayError"
        || message.includes("failed to send a request")
        || message.includes("failed to fetch")
        || message.includes("networkerror")
        || message.includes("timed out")
        || status === 404
        || status >= 500;
}

async function dnsLookup(domain, type) {
    const endpoint = new URL("https://dns.google/resolve");
    endpoint.searchParams.set("name", domain);
    endpoint.searchParams.set("type", type);
    endpoint.searchParams.set("cd", "false");

    const controller = new AbortController();
    const timeout = window.setTimeout(
        () => controller.abort(),
        EMAIL_DOMAIN_CHECK_TIMEOUT_MS
    );

    try {
        const response = await fetch(endpoint, {
            headers: { Accept: "application/dns-json" },
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`DNS lookup returned HTTP ${response.status}.`);
        }

        return await response.json();
    } finally {
        window.clearTimeout(timeout);
    }
}

async function domainCanReceiveEmail(domain) {
    const mxResult = await dnsLookup(domain, "MX");

    if (Number(mxResult?.Status) === 3) {
        return false;
    }

    if (Number(mxResult?.Status) !== 0) {
        throw new Error(
            `DNS lookup could not be completed (status ${mxResult?.Status}).`
        );
    }

    const mxAnswers = Array.isArray(mxResult?.Answer)
        ? mxResult.Answer.filter((answer) => Number(answer?.type) === 15)
        : [];

    if (mxAnswers.some((answer) => String(answer?.data || "").trim() === ".")) {
        return false;
    }

    if (mxAnswers.some((answer) => String(answer?.data || "").trim())) {
        return true;
    }

    const addressResults = await Promise.allSettled([
        dnsLookup(domain, "A"),
        dnsLookup(domain, "AAAA")
    ]);

    const successfulResults = addressResults
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);

    if (!successfulResults.length) {
        throw new Error("DNS fallback could not be reached.");
    }

    return successfulResults.some((result) =>
        Number(result?.Status) === 0
        && Array.isArray(result?.Answer)
        && result.Answer.some((answer) =>
            [1, 28].includes(Number(answer?.type))
            && String(answer?.data || "").trim()
        )
    );
}

async function validateEmailWithoutEdgeFunction(email) {
    const domain = email.slice(email.lastIndexOf("@") + 1);

    try {
        const domainWorks = await domainCanReceiveEmail(domain);

        if (!domainWorks) {
            throw new Error(
                "That email domain does not appear able to receive email. Check the address for typos."
            );
        }

        return {
            email,
            usedFallback: true,
            checkSkipped: false
        };
    } catch (error) {
        if (
            String(error?.message || "").startsWith(
                "That email domain does not appear"
            )
        ) {
            throw error;
        }

        console.warn(
            "Email domain services are unavailable; continuing with format validation:",
            error
        );

        return {
            email,
            usedFallback: true,
            checkSkipped: true
        };
    }
}

async function validateEmailAddress(email) {
    let result;
    let timeout;

    try {
        result = await Promise.race([
            window.supabaseClient.functions.invoke(
                "validate-email-domain",
                { body: { email } }
            ),
            new Promise((resolve) => {
                timeout = window.setTimeout(
                    () => resolve({
                        data: null,
                        error: {
                            name: "FunctionsFetchError",
                            message: "The email-domain check timed out."
                        }
                    }),
                    EMAIL_DOMAIN_CHECK_TIMEOUT_MS
                );
            })
        ]);
    } catch (error) {
        if (functionCheckIsUnavailable(error)) {
            return validateEmailWithoutEdgeFunction(email);
        }

        throw error;
    } finally {
        window.clearTimeout(timeout);
    }

    const { data, error } = result;

    if (error) {
        if (functionCheckIsUnavailable(error)) {
            return validateEmailWithoutEdgeFunction(email);
        }

        throw new Error(await parseFunctionError(error));
    }

    if (!data?.valid) {
        throw new Error(
            data?.error || "Enter an email address with a working mail domain."
        );
    }

    return {
        email: data.email || email.toLowerCase(),
        usedFallback: false,
        checkSkipped: false
    };
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

            const validation = await validateEmailAddress(email);

            if (validation.checkSkipped) {
                showRegisterMessage(
                    "The domain checker is temporarily unavailable. Continuing with email-format validation…",
                    "success"
                );
            } else if (validation.usedFallback) {
                showRegisterMessage(
                    "Email domain checked. Creating your account…",
                    "success"
                );
            }

            const {
                data,
                error
            } = await window.supabaseClient.auth.signUp({
                email: validation.email,
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
                window.location.href = "home.html";
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
