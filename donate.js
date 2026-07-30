const donationForm = document.querySelector("#donation-form");
const recipientInput = document.querySelector("#recipient-username");
const recipientResults = document.querySelector("#recipient-results");
const amountInput = document.querySelector("#donation-amount");
const noteInput = document.querySelector("#donation-note");
const noteCharacterCount = document.querySelector(
    "#note-character-count"
);
const submitButton = document.querySelector(
    "#submit-donation-button"
);
const donationMessage = document.querySelector("#donation-message");
const walletBalance = document.querySelector("#wallet-balance");
const donationHistory = document.querySelector("#donation-history");
const refreshButton = document.querySelector(
    "#refresh-donations-button"
);

let currentUser = null;
let searchTimer = null;
let selectedUsername = "";


function formatChips(value) {
    return new Intl.NumberFormat("en-GB").format(
        Number(value ?? 0)
    );
}


function formatDate(value) {
    return new Intl.DateTimeFormat(
        "en-GB",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    ).format(new Date(value));
}


function setMessage(message, type = "") {
    donationMessage.textContent = message;
    donationMessage.className = "form-message";

    if (type) {
        donationMessage.classList.add(type);
    }
}


async function loadWallet() {
    const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("chips")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    walletBalance.textContent = formatChips(data?.chips ?? 0);
}


function hideRecipientResults() {
    recipientResults.classList.add("hidden");
    recipientResults.replaceChildren();
}


function selectRecipient(username) {
    selectedUsername = username;
    recipientInput.value = username;
    hideRecipientResults();
}


function renderRecipientResults(results) {
    recipientResults.replaceChildren();

    if (!results.length) {
        const empty = document.createElement("p");
        empty.className = "recipient-empty";
        empty.textContent = "No matching accounts found.";
        recipientResults.append(empty);
        recipientResults.classList.remove("hidden");
        return;
    }

    for (const result of results) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "recipient-result-button";

        const username = document.createElement("strong");
        username.textContent = result.username;

        const level = document.createElement("span");
        level.textContent = `Level ${Number(result.level ?? 1)}`;

        button.append(username, level);
        button.addEventListener(
            "click",
            () => selectRecipient(result.username)
        );

        recipientResults.append(button);
    }

    recipientResults.classList.remove("hidden");
}


async function searchRecipients() {
    const query = recipientInput.value.trim();
    selectedUsername = "";

    if (!query) {
        hideRecipientResults();
        return;
    }

    const { data, error } = await window.supabaseClient.rpc(
        "search_donation_recipients",
        {
            p_query: query
        }
    );

    if (error) {
        throw error;
    }

    renderRecipientResults(data ?? []);
}


function renderDonationHistory(rows) {
    donationHistory.replaceChildren();

    if (!rows.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No donations yet.";
        donationHistory.append(empty);
        return;
    }

    for (const row of rows) {
        const item = document.createElement("article");
        item.className = `donation-history-item ${row.direction}`;

        const icon = document.createElement("span");
        icon.className = "donation-history-icon";
        icon.textContent = row.direction === "sent" ? "↗" : "↙";

        const copy = document.createElement("div");
        copy.className = "donation-history-copy";

        const heading = document.createElement("div");

        const title = document.createElement("strong");
        title.textContent = row.direction === "sent"
            ? `Sent to ${row.other_username}`
            : `Received from ${row.other_username}`;

        const time = document.createElement("time");
        time.dateTime = row.created_at;
        time.textContent = formatDate(row.created_at);

        heading.append(title, time);

        const amount = document.createElement("span");
        amount.className = "donation-history-amount";
        amount.textContent = `${row.direction === "sent" ? "−" : "+"}${formatChips(row.amount)} chips`;

        copy.append(heading, amount);

        if (row.note) {
            const note = document.createElement("p");
            note.textContent = `“${row.note}”`;
            copy.append(note);
        }

        item.append(icon, copy);
        donationHistory.append(item);
    }
}


async function loadDonationHistory() {
    refreshButton.disabled = true;

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "get_my_donation_history"
        );

        if (error) {
            throw error;
        }

        renderDonationHistory(data ?? []);
    } catch (error) {
        donationHistory.innerHTML = `
            <p class="empty-state error-state">
                ${error.message}
            </p>
        `;
    } finally {
        refreshButton.disabled = false;
    }
}


async function submitDonation(event) {
    event.preventDefault();
    setMessage("");

    const username = (
        selectedUsername || recipientInput.value
    ).trim();
    const amount = Number(amountInput.value);
    const note = noteInput.value.trim();

    if (!username) {
        setMessage("Choose a recipient.", "error");
        return;
    }

    if (!Number.isSafeInteger(amount) || amount < 1) {
        setMessage("Enter a valid whole-chip amount.", "error");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "donate_chips",
            {
                p_recipient_username: username,
                p_amount: amount,
                p_note: note || null
            }
        );

        if (error) {
            throw error;
        }

        walletBalance.textContent = formatChips(
            data.sender_balance
        );

        setMessage(
            `Sent ${formatChips(data.amount)} chips to ${data.recipient_username}.`,
            "success"
        );

        donationForm.reset();
        amountInput.value = "100";
        noteCharacterCount.textContent = "0 / 120";
        selectedUsername = "";
        hideRecipientResults();

        await loadDonationHistory();
    } catch (error) {
        setMessage(error.message, "error");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Send donation";
    }
}


async function initialiseDonationPage() {
    try {
        const {
            data: { user },
            error
        } = await window.supabaseClient.auth.getUser();

        if (error) {
            throw error;
        }

        if (!user) {
            window.location.href = "login.html";
            return;
        }

        currentUser = user;

        await Promise.all([
            loadWallet(),
            loadDonationHistory()
        ]);
    } catch (error) {
        setMessage(error.message, "error");
    }
}


recipientInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
        searchRecipients().catch((error) => {
            setMessage(error.message, "error");
        });
    }, 220);
});

recipientInput.addEventListener("blur", () => {
    window.setTimeout(hideRecipientResults, 180);
});

noteInput.addEventListener("input", () => {
    noteCharacterCount.textContent =
        `${noteInput.value.length} / 120`;
});

document
    .querySelectorAll("[data-amount]")
    .forEach((button) => {
        button.addEventListener("click", () => {
            amountInput.value = button.dataset.amount;
        });
    });

donationForm.addEventListener("submit", submitDonation);
refreshButton.addEventListener("click", loadDonationHistory);

initialiseDonationPage();
