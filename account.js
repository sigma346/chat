const accountUsername =
    document.querySelector("#account-username");

const accountEmail =
    document.querySelector("#account-email");

const accountId =
    document.querySelector("#account-id");

const accountChips =
    document.querySelector("#account-chips");

const usernameForm =
    document.querySelector("#username-form");

const newUsernameInput =
    document.querySelector("#new-username-input");

const accountMessage =
    document.querySelector("#account-message");

const logoutButton =
    document.querySelector("#logout-button");

let currentUser = null;

function createShortUserId(userId) {
    return userId
        .replaceAll("-", "")
        .slice(0, 8)
        .toUpperCase();
}

function formatChips(chips) {
    return new Intl.NumberFormat("en-GB").format(chips);
}

function showAccountMessage(message, type = "error") {
    accountMessage.textContent = message;
    accountMessage.className =
        `form-message ${type}`.trim();
}

async function loadAccount() {
    const {
        data: {
            user
        },
        error: userError
    } = await window.supabaseClient.auth.getUser();

    if (userError || !user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    const {
        data: profile,
        error: profileError
    } = await window.supabaseClient
        .from("profiles")
        .select("id, username, chips")
        .eq("id", user.id)
        .single();

    if (profileError) {
        showAccountMessage(profileError.message);
        return;
    }

    accountUsername.textContent = profile.username;
    accountEmail.textContent = user.email;
    accountId.textContent =
        `#${createShortUserId(user.id)}`;

    accountChips.textContent =
        formatChips(profile.chips);

    newUsernameInput.value = profile.username;
}

usernameForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        showAccountMessage("");

        const newUsername =
            newUsernameInput.value.trim();

        const validUsername =
            /^[A-Za-z0-9_]{3,20}$/.test(newUsername);

        if (!validUsername) {
            showAccountMessage(
                "Username must be 3–20 characters using letters, numbers or underscores."
            );

            return;
        }

        const {
            error
        } = await window.supabaseClient
            .from("profiles")
            .update({
                username: newUsername
            })
            .eq("id", currentUser.id);

        if (error) {
            showAccountMessage(error.message);
            return;
        }

        accountUsername.textContent = newUsername;

        showAccountMessage(
            "Username updated.",
            "success"
        );
    }
);

logoutButton.addEventListener(
    "click",
    async () => {
        await window.supabaseClient.auth.signOut({
            scope: "local"
        });

        window.location.href = "login.html";
    }
);

loadAccount();