const messageList =
    document.querySelector("#message-list");

const messageForm =
    document.querySelector("#message-form");

const messageInput =
    document.querySelector("#message-input");

const sendButton =
    document.querySelector("#send-button");

const chatError =
    document.querySelector("#chat-error");

const currentUserLabel =
    document.querySelector("#current-user");

const currentUserIdLabel =
    document.querySelector("#current-user-id");

const chipBalanceLabel =
    document.querySelector("#chip-balance");

const connectionStatus =
    document.querySelector("#connection-status");

const logoutButton =
    document.querySelector("#logout-button");

let currentUser = null;
let currentProfile = null;
let realtimeChannel = null;

const displayedMessageIds = new Set();

function shortUserId(userId) {
    return userId
        .replaceAll("-", "")
        .slice(0, 6)
        .toUpperCase();
}

function formatChips(chips) {
    return new Intl.NumberFormat("en-GB").format(chips);
}

function formatTime(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(timestamp));
}

function showChatError(message = "") {
    chatError.textContent = message;
}

function updateConnectionStatus(message, state = "") {
    connectionStatus.textContent = message;

    connectionStatus.className =
        `connection-status ${state}`.trim();
}

function isNearBottom() {
    const distance =
        messageList.scrollHeight -
        messageList.scrollTop -
        messageList.clientHeight;

    return distance < 120;
}

function scrollToBottom() {
    messageList.scrollTop =
        messageList.scrollHeight;
}

function removeEmptyMessage() {
    document
        .querySelector("#empty-message")
        ?.remove();
}

function showEmptyMessage() {
    if (messageList.children.length > 0) {
        return;
    }

    const emptyMessage =
        document.createElement("li");

    emptyMessage.id = "empty-message";
    emptyMessage.className = "empty-message";

    emptyMessage.textContent =
        "No messages yet.";

    messageList.append(emptyMessage);
}

function displayMessage(message, forceScroll = false) {
    if (
        !message?.id ||
        displayedMessageIds.has(message.id)
    ) {
        return;
    }

    const shouldScroll =
        forceScroll || isNearBottom();

    displayedMessageIds.add(message.id);

    removeEmptyMessage();

    const previousMessage =
        messageList.lastElementChild;

    const groupedMessage =
        previousMessage?.classList.contains("message") &&
        previousMessage.dataset.userId === message.user_id;

    const messageElement =
        document.createElement("li");

    messageElement.className = "message";
    messageElement.dataset.userId = message.user_id;

    const ownMessage =
        currentUser.id === message.user_id;

    if (ownMessage) {
        messageElement.classList.add("own-message");
    }

    if (groupedMessage) {
        messageElement.classList.add("grouped-message");
    }

    if (!groupedMessage) {
        const informationElement =
            document.createElement("div");

        informationElement.className =
            "message-information";

        const authorElement =
            document.createElement("span");

        authorElement.className =
            "message-author";

        authorElement.textContent =
            message.username;

        const idElement =
            document.createElement("span");

        idElement.className = "user-id";

        idElement.textContent =
            `#${shortUserId(message.user_id)}`;

        const timeElement =
            document.createElement("time");

        timeElement.dateTime =
            message.created_at;

        timeElement.textContent =
            formatTime(message.created_at);

        informationElement.append(
            authorElement,
            idElement,
            timeElement
        );

        messageElement.append(
            informationElement
        );
    }

    const contentElement =
        document.createElement("p");

    contentElement.className =
        "message-content";

    contentElement.textContent =
        message.content;

    contentElement.title =
        `${message.username} #${shortUserId(message.user_id)}`;

    messageElement.append(contentElement);
    messageList.append(messageElement);

    if (shouldScroll) {
        scrollToBottom();
    }
}

async function loadCurrentAccount() {
    const {
        data: {
            user
        },
        error: userError
    } = await window.supabaseClient.auth.getUser();

    if (userError || !user) {
        window.location.href = "login.html";
        return false;
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
        showChatError(profileError.message);
        return false;
    }

    currentProfile = profile;

    currentUserLabel.textContent =
        profile.username;

    currentUserIdLabel.textContent =
        `#${shortUserId(user.id)}`;

    chipBalanceLabel.textContent =
        formatChips(profile.chips);

    return true;
}

async function loadMessages() {
    const {
        data,
        error
    } = await window.supabaseClient
        .from("messages")
        .select(
            "id, user_id, username, content, created_at"
        )
        .order("created_at", {
            ascending: false
        })
        .limit(100);

    if (error) {
        throw error;
    }

    messageList.replaceChildren();
    displayedMessageIds.clear();

    const orderedMessages =
        [...data].reverse();

    for (const message of orderedMessages) {
        displayMessage(message);
    }

    showEmptyMessage();
    scrollToBottom();
}

function subscribeToMessages() {
    realtimeChannel =
        window.supabaseClient
            .channel("public-chat-room")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages"
                },
                (payload) => {
                    displayMessage(payload.new);
                }
            )
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    updateConnectionStatus(
                        "Live connection",
                        "connected"
                    );

                    return;
                }

                if (
                    status === "CHANNEL_ERROR" ||
                    status === "TIMED_OUT" ||
                    status === "CLOSED"
                ) {
                    updateConnectionStatus(
                        "Connection lost. Refresh the page.",
                        "disconnected"
                    );

                    return;
                }

                updateConnectionStatus(
                    "Connecting..."
                );
            });
}

messageForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        showChatError();

        const content =
            messageInput.value.trim();

        if (!content || !currentUser) {
            return;
        }

        sendButton.disabled = true;
        messageInput.disabled = true;

        try {
            const {
                error
            } = await window.supabaseClient
                .from("messages")
                .insert({
                    user_id: currentUser.id,
                    username: currentProfile.username,
                    content
                });

            if (error) {
                throw error;
            }

            messageInput.value = "";
        } catch (error) {
            console.error(error);

            showChatError(
                error.message ||
                "Message failed to send."
            );
        } finally {
            sendButton.disabled = false;
            messageInput.disabled = false;
            messageInput.focus();
        }
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

window.addEventListener(
    "beforeunload",
    () => {
        if (realtimeChannel) {
            window.supabaseClient.removeChannel(
                realtimeChannel
            );
        }
    }
);

async function initialiseChat() {
    try {
        const accountLoaded =
            await loadCurrentAccount();

        if (!accountLoaded) {
            return;
        }

        await loadMessages();

        subscribeToMessages();

        messageInput.focus();
    } catch (error) {
        console.error(error);

        showChatError(
            error.message ||
            "The chat could not be loaded."
        );
    }
}

initialiseChat();