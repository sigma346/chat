const conversationList = document.querySelector("#conversation-list");
const conversationFilter = document.querySelector("#conversation-filter");
const statusMessage = document.querySelector("#direct-message-status");
const thread = document.querySelector("#message-thread");
const threadEmpty = document.querySelector("#message-thread-empty");
const threadActive = document.querySelector("#message-thread-active");
const threadUsername = document.querySelector("#thread-username");
const threadFriendState = document.querySelector("#thread-friend-state");
const threadProfileLink = document.querySelector("#thread-profile-link");
const threadAudioCall = document.querySelector("#thread-audio-call");
const threadVideoCall = document.querySelector("#thread-video-call");
const messageList = document.querySelector("#message-list");
const loadOlderButton = document.querySelector("#load-older-messages");
const messageForm = document.querySelector("#direct-message-form");
const messageInput = document.querySelector("#direct-message-input");
const sendButton = document.querySelector("#send-direct-message");
const characterCount = document.querySelector("#message-character-count");

let currentUser = null;
let conversations = [];
let activeContact = null;
let activeMessages = new Map();
let messagesChannel = null;
let sending = false;
let loadingThread = false;
let hasOlderMessages = false;

function setStatus(message = "", type = "") {
    statusMessage.textContent = message;
    statusMessage.className =
        `form-message direct-message-status ${type}`.trim();
}

function formatConversationTime(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    const sameDay = date.toDateString() === new Date().toDateString();

    return new Intl.DateTimeFormat(
        "en-AU",
        sameDay
            ? { hour: "numeric", minute: "2-digit" }
            : { day: "numeric", month: "short" }
    ).format(date);
}

function formatMessageTime(value) {
    return new Intl.DateTimeFormat(
        "en-AU",
        {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit"
        }
    ).format(new Date(value));
}

function updateCharacterCount() {
    characterCount.textContent =
        `${messageInput.value.length} / 1000`;
}

function renderConversations() {
    const query = conversationFilter.value.trim().toLowerCase();
    const filtered = query
        ? conversations.filter((conversation) =>
            conversation.username.toLowerCase().includes(query)
        )
        : conversations;

    conversationList.replaceChildren();

    if (!filtered.length) {
        const empty = document.createElement("p");
        empty.className = "direct-message-empty";
        empty.textContent = conversations.length
            ? "No conversations match that search."
            : "No direct messages yet. Open an accepted friend to start a private conversation.";
        conversationList.append(empty);
        return;
    }

    for (const conversation of filtered) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "conversation-button";
        button.dataset.userId = conversation.other_user_id;

        if (activeContact?.user_id === conversation.other_user_id) {
            button.classList.add("active");
            button.setAttribute("aria-current", "true");
        }

        const name = document.createElement("span");
        name.className = "conversation-name";
        name.textContent = conversation.username;

        const time = document.createElement("time");
        time.className = "conversation-time";
        time.dateTime = conversation.last_message_at || "";
        time.textContent = formatConversationTime(
            conversation.last_message_at
        );

        const preview = document.createElement("span");
        preview.className = "conversation-preview";
        preview.textContent = conversation.last_message
            ? `${conversation.last_message_from_me ? "You: " : ""}${conversation.last_message}`
            : "Start a conversation";

        const unreadCount = Number(conversation.unread_count ?? 0);
        const unread = document.createElement("span");

        if (unreadCount > 0) {
            unread.className = "conversation-unread";
            unread.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
            unread.title = `${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`;
        } else {
            unread.className = "conversation-time";
        }

        button.append(name, time, preview, unread);
        conversationList.append(button);
    }
}

function renderMessages({ preserveBottom = false } = {}) {
    const previousDistanceFromBottom =
        messageList.scrollHeight
        - messageList.scrollTop
        - messageList.clientHeight;

    messageList.replaceChildren();
    const ordered = [...activeMessages.values()].sort(
        (left, right) => Number(left.id) - Number(right.id)
    );

    if (!ordered.length) {
        const empty = document.createElement("p");
        empty.className = "direct-message-empty";
        empty.textContent = activeContact?.are_friends
            ? `No messages yet. Say hello to ${activeContact.username}.`
            : "This conversation is read-only because you are no longer friends.";
        messageList.append(empty);
    } else {
        for (const message of ordered) {
            const row = document.createElement("div");
            row.className = "message-row";

            if (message.sender_id === currentUser.id) {
                row.classList.add("mine");
            }

            const bubble = document.createElement("div");
            bubble.className = "message-bubble";

            const content = document.createElement("p");
            content.className = "message-content";
            content.textContent = message.content;

            const time = document.createElement("time");
            time.className = "message-time";
            time.dateTime = message.created_at;
            time.textContent = formatMessageTime(message.created_at);

            bubble.append(content, time);
            row.append(bubble);
            messageList.append(row);
        }
    }

    if (preserveBottom) {
        messageList.scrollTop = Math.max(
            messageList.scrollHeight
            - messageList.clientHeight
            - previousDistanceFromBottom,
            0
        );
    } else {
        messageList.scrollTop = messageList.scrollHeight;
    }

    loadOlderButton.hidden = !hasOlderMessages;
}

function setThreadContact(contact) {
    activeContact = contact;
    thread.classList.remove("empty");
    threadEmpty.hidden = true;
    threadActive.hidden = false;
    threadUsername.textContent = contact.username;
    threadProfileLink.href =
        `profile.html?id=${encodeURIComponent(contact.user_id)}`;
    threadFriendState.textContent = contact.are_friends
        ? "Accepted friend"
        : "No longer friends · message history only";

    for (const [button, mode] of [
        [threadAudioCall, "audio"],
        [threadVideoCall, "video"]
    ]) {
        button.dataset.playerCallUser = contact.user_id;
        button.dataset.playerCallName = contact.username;
        button.dataset.playerCallMode = mode;
        button.hidden = !contact.are_friends;
    }

    messageInput.disabled = !contact.are_friends;
    sendButton.disabled = !contact.are_friends;
    messageInput.placeholder = contact.are_friends
        ? "Write a message..."
        : "You can only message accepted friends.";
    renderConversations();
}

async function loadConversations() {
    const { data, error } = await window.supabaseClient.rpc(
        "get_direct_message_conversations"
    );

    if (error) {
        throw error;
    }

    const currentEmpty = activeContact
        && !data?.some((item) =>
            item.other_user_id === activeContact.user_id
        )
        ? [{
            other_user_id: activeContact.user_id,
            username: activeContact.username,
            last_message: "",
            last_message_at: null,
            last_message_from_me: false,
            unread_count: 0
        }]
        : [];

    conversations = [...currentEmpty, ...(data || [])];
    renderConversations();
}

async function loadMessages({ older = false } = {}) {
    if (!activeContact || loadingThread) {
        return;
    }

    loadingThread = true;
    loadOlderButton.disabled = true;

    try {
        const ids = [...activeMessages.keys()].map(Number);
        const beforeId = older && ids.length
            ? Math.min(...ids)
            : null;
        const contactId = activeContact.user_id;
        const { data, error } = await window.supabaseClient.rpc(
            "get_direct_messages",
            {
                p_other_user_id: contactId,
                p_before_id: beforeId,
                p_limit: 50
            }
        );

        if (error) {
            throw error;
        }

        if (activeContact?.user_id !== contactId) {
            return;
        }

        if (!older) {
            activeMessages.clear();
        }

        for (const message of data || []) {
            activeMessages.set(String(message.id), message);
        }

        hasOlderMessages = (data || []).length === 50;
        renderMessages({ preserveBottom: older });
    } finally {
        loadingThread = false;
        loadOlderButton.disabled = false;
    }
}

async function markActiveConversationRead() {
    if (!activeContact) {
        return;
    }

    const { error } = await window.supabaseClient.rpc(
        "mark_direct_messages_read",
        { p_sender_id: activeContact.user_id }
    );

    if (!error) {
        window.dispatchEvent(new CustomEvent("direct-messages-read"));
        await loadConversations();
    }
}

async function activateContact(userId, suppliedUsername = "") {
    setStatus();
    const { data, error } = await window.supabaseClient.rpc(
        "get_direct_message_contact",
        { p_user_id: userId }
    );

    if (error) {
        throw error;
    }

    const contactRow = Array.isArray(data) ? data[0] : data;

    if (!contactRow) {
        throw new Error("That player could not be opened.");
    }

    const contact = {
        user_id: contactRow.user_id,
        username: contactRow.username || suppliedUsername || "Player",
        are_friends: Boolean(contactRow.are_friends)
    };

    setThreadContact(contact);
    activeMessages.clear();
    await loadMessages();
    await markActiveConversationRead();
    await loadConversations();

    const url = new URL(window.location.href);
    url.searchParams.set("user", contact.user_id);
    window.history.replaceState({}, "", url);
}

async function sendMessage(event) {
    event.preventDefault();

    if (sending || !activeContact?.are_friends) {
        return;
    }

    const content = messageInput.value.trim();

    if (!content) {
        return;
    }

    sending = true;
    sendButton.disabled = true;
    setStatus();

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "send_direct_message",
            {
                p_recipient_id: activeContact.user_id,
                p_content: content
            }
        );

        if (error) {
            throw error;
        }

        if (data) {
            activeMessages.set(String(data.id), data);
            renderMessages();
        }

        messageInput.value = "";
        updateCharacterCount();
        await loadConversations();
        messageInput.focus();
    } catch (error) {
        setStatus(
            error.message || "The message could not be sent.",
            "error"
        );
    } finally {
        sending = false;
        sendButton.disabled = !activeContact?.are_friends;
    }
}

async function handleMessageInsert(message) {
    if (!message || !activeContact) {
        await loadConversations();
        return;
    }

    const belongsToActive =
        (message.sender_id === currentUser.id
            && message.recipient_id === activeContact.user_id)
        ||
        (message.sender_id === activeContact.user_id
            && message.recipient_id === currentUser.id);

    if (belongsToActive) {
        activeMessages.set(String(message.id), message);
        renderMessages();

        if (
            message.recipient_id === currentUser.id
            && document.visibilityState === "visible"
            && document.hasFocus()
        ) {
            await markActiveConversationRead();
        }
    }

    await loadConversations();
}

function subscribeToMessages() {
    messagesChannel = window.supabaseClient
        .channel(`direct-message-page-${currentUser.id}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "direct_messages",
                filter: `sender_id=eq.${currentUser.id}`
            },
            (payload) => handleMessageInsert(payload.new)
        )
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "direct_messages",
                filter: `recipient_id=eq.${currentUser.id}`
            },
            (payload) => handleMessageInsert(payload.new)
        )
        .subscribe();
}

conversationList.addEventListener("click", (event) => {
    const button = event.target.closest(".conversation-button");

    if (!button) {
        return;
    }

    const conversation = conversations.find(
        (item) => item.other_user_id === button.dataset.userId
    );

    activateContact(
        button.dataset.userId,
        conversation?.username
    ).catch((error) => {
        setStatus(error.message || "The conversation could not be opened.", "error");
    });
});

conversationFilter.addEventListener("input", renderConversations);
messageInput.addEventListener("input", updateCharacterCount);
messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        messageForm.requestSubmit();
    }
});
messageForm.addEventListener("submit", sendMessage);
loadOlderButton.addEventListener("click", () => {
    loadMessages({ older: true }).catch((error) => {
        setStatus(error.message || "Older messages could not be loaded.", "error");
    });
});
window.addEventListener("focus", () => {
    if (activeContact) {
        markActiveConversationRead().catch(() => {});
    }
});
window.addEventListener("beforeunload", () => {
    if (messagesChannel) {
        window.supabaseClient.removeChannel(messagesChannel);
    }
});

async function initialiseDirectMessages() {
    try {
        const { data: { user }, error } =
            await window.supabaseClient.auth.getUser();

        if (error || !user) {
            window.location.href = "login.html";
            return;
        }

        currentUser = user;
        await loadConversations();
        subscribeToMessages();

        const requestedUser = new URLSearchParams(
            window.location.search
        ).get("user");

        if (requestedUser && requestedUser !== currentUser.id) {
            await activateContact(requestedUser);
        }
    } catch (error) {
        console.error(error);
        setStatus(
            error.message || "Direct messages could not be loaded.",
            "error"
        );
        conversationList.innerHTML =
            '<p class="direct-message-empty">Direct messages are unavailable.</p>';
    }
}

updateCharacterCount();
initialiseDirectMessages();
