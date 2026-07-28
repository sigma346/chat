const config = window.CHAT_CONFIG;

/*
    Page elements
*/

const joinScreen = document.querySelector("#join-screen");
const chatScreen = document.querySelector("#chat-screen");

const joinForm = document.querySelector("#join-form");
const nicknameInput = document.querySelector("#nickname-input");
const joinButton = document.querySelector("#join-button");
const joinError = document.querySelector("#join-error");

const currentUserLabel = document.querySelector("#current-user");
const changeNameButton = document.querySelector("#change-name-button");

const connectionStatus = document.querySelector(
    "#connection-status"
);

const messageList = document.querySelector("#message-list");

const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const chatError = document.querySelector("#chat-error");

/*
    Application state
*/

let supabaseClient = null;
let currentSession = null;
let currentNickname = "";
let realtimeChannel = null;

const displayedMessageIds = new Set();

/*
    General helper functions
*/

function showError(element, message = "") {
    element.textContent = message;
}

function validateConfiguration() {
    const missingUrl =
        !config?.supabaseUrl ||
        config.supabaseUrl.includes("YOUR_SUPABASE");

    const missingKey =
        !config?.supabaseKey ||
        config.supabaseKey.includes("YOUR_SUPABASE");

    if (missingUrl || missingKey) {
        throw new Error(
            "Add your Supabase URL and publishable key to config.js."
        );
    }
}

function updateConnectionStatus(message, state = "") {
    connectionStatus.textContent = message;

    connectionStatus.className =
        `connection-status ${state}`.trim();
}

function formatTime(timestamp) {
    const date = new Date(timestamp);

    return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function isNearBottomOfMessages() {
    const distanceFromBottom =
        messageList.scrollHeight -
        messageList.scrollTop -
        messageList.clientHeight;

    return distanceFromBottom < 120;
}

function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
}

/*
    Empty message display
*/

function removeEmptyMessage() {
    const emptyMessage =
        document.querySelector("#empty-message");

    if (emptyMessage) {
        emptyMessage.remove();
    }
}

function showEmptyMessage() {
    if (messageList.children.length > 0) {
        return;
    }

    const emptyMessage = document.createElement("li");

    emptyMessage.id = "empty-message";
    emptyMessage.className = "empty-message";

    emptyMessage.textContent =
        "No messages yet. A rare moment of internet peace.";

    messageList.append(emptyMessage);
}

/*
    Message rendering
*/

function displayMessage(message, forceScroll = false) {
    if (!message?.id) {
        return;
    }

    if (displayedMessageIds.has(message.id)) {
        return;
    }

    const shouldScroll =
        forceScroll || isNearBottomOfMessages();

    displayedMessageIds.add(message.id);
    removeEmptyMessage();

    /*
        Check whether the previous visible message
        was sent by the same user.
    */

    const previousMessage =
        messageList.lastElementChild;

    const isGroupedMessage =
        previousMessage?.classList.contains("message") &&
        previousMessage.dataset.userId === message.user_id;

    const messageElement =
        document.createElement("li");

    messageElement.className = "message";
    messageElement.dataset.userId = message.user_id;

    const isOwnMessage =
        currentSession?.user?.id === message.user_id;

    if (isOwnMessage) {
        messageElement.classList.add("own-message");
    }

    if (isGroupedMessage) {
        messageElement.classList.add("grouped-message");
    }

    /*
        Only display the username and time when this
        is the first message in a group.
    */

    if (!isGroupedMessage) {
        const messageInformation =
            document.createElement("div");

        messageInformation.className =
            "message-information";

        const authorElement =
            document.createElement("span");

        authorElement.className = "message-author";
        authorElement.textContent = message.username;

        const timeElement =
            document.createElement("time");

        timeElement.dateTime = message.created_at;
        timeElement.textContent =
            formatTime(message.created_at);

        messageInformation.append(
            authorElement,
            timeElement
        );

        messageElement.append(messageInformation);
    }

    const contentElement =
        document.createElement("p");

    contentElement.className = "message-content";
    contentElement.textContent = message.content;

    /*
        Hovering over any message still reveals its
        username and exact time.
    */

    contentElement.title =
        `${message.username} • ${formatTime(message.created_at)}`;

    messageElement.append(contentElement);
    messageList.append(messageElement);

    if (shouldScroll) {
        scrollToBottom();
    }
}
/*
    Supabase authentication
*/

async function createOrRestoreSession() {
    const {
        data: sessionData,
        error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError) {
        throw sessionError;
    }

    if (sessionData.session) {
        currentSession = sessionData.session;
        return;
    }

    const {
        data: anonymousData,
        error: anonymousError
    } = await supabaseClient.auth.signInAnonymously();

    if (anonymousError) {
        throw anonymousError;
    }

    currentSession = anonymousData.session;
}

/*
    Load previous messages
*/

async function loadMessages() {
    const {
        data,
        error
    } = await supabaseClient
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

    /*
        The database returns newest first.

        Reverse the array so the oldest message appears
        at the top and the newest appears at the bottom.
    */

    const orderedMessages = [...data].reverse();

    for (const message of orderedMessages) {
        displayMessage(message);
    }

    showEmptyMessage();
    scrollToBottom();
}

/*
    Realtime message subscription
*/

function subscribeToMessages() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
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

            updateConnectionStatus("Connecting...");
        });
}

/*
    Enter the chat
*/

async function enterChat(chosenNickname) {
    joinButton.disabled = true;

    showError(joinError);

    try {
        validateConfiguration();

        const trimmedNickname =
            chosenNickname.trim();

        if (!trimmedNickname) {
            throw new Error("Enter a nickname.");
        }

        currentNickname = trimmedNickname;

        localStorage.setItem(
            "quick-chat-nickname",
            currentNickname
        );

        if (!supabaseClient) {
            supabaseClient = window.supabase.createClient(
                config.supabaseUrl,
                config.supabaseKey
            );
        }

        await createOrRestoreSession();

        currentUserLabel.textContent =
            currentNickname;

        joinScreen.classList.add("hidden");
        chatScreen.classList.remove("hidden");

        await loadMessages();

        subscribeToMessages();

        messageInput.focus();
    } catch (error) {
        console.error(error);

        joinScreen.classList.remove("hidden");
        chatScreen.classList.add("hidden");

        showError(
            joinError,
            error.message || "Could not enter the chat."
        );
    } finally {
        joinButton.disabled = false;
    }
}

/*
    Submit nickname
*/

joinForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        await enterChat(nicknameInput.value);
    }
);

/*
    Send a message
*/

messageForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        showError(chatError);

        const content = messageInput.value.trim();

        if (!content) {
            return;
        }

        if (!currentSession?.user?.id) {
            showError(
                chatError,
                "Your user session is unavailable."
            );

            return;
        }

        sendButton.disabled = true;
        messageInput.disabled = true;

        try {
            const {
                error
            } = await supabaseClient
                .from("messages")
                .insert({
                    user_id: currentSession.user.id,
                    username: currentNickname,
                    content: content
                });

            if (error) {
                throw error;
            }

            messageInput.value = "";
        } catch (error) {
            console.error(error);

            showError(
                chatError,
                error.message || "Message failed to send."
            );
        } finally {
            sendButton.disabled = false;
            messageInput.disabled = false;

            messageInput.focus();
        }
    }
);

/*
    Change nickname
*/

changeNameButton.addEventListener(
    "click",
    () => {
        localStorage.removeItem(
            "quick-chat-nickname"
        );

        location.reload();
    }
);

/*
    Remove realtime subscription when leaving
*/

window.addEventListener(
    "beforeunload",
    () => {
        if (
            supabaseClient &&
            realtimeChannel
        ) {
            supabaseClient.removeChannel(
                realtimeChannel
            );
        }
    }
);

/*
    Automatically restore saved nickname
*/

const savedNickname =
    localStorage.getItem(
        "quick-chat-nickname"
    );

if (savedNickname) {
    nicknameInput.value = savedNickname;

    enterChat(savedNickname);
}