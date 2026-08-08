const friendCount = document.querySelector("#friend-count");
const incomingCount = document.querySelector("#incoming-count");
const outgoingCount = document.querySelector("#outgoing-count");
const incomingSectionCount = document.querySelector(
    "#incoming-section-count"
);
const outgoingSectionCount = document.querySelector(
    "#outgoing-section-count"
);
const incomingRequestList = document.querySelector(
    "#incoming-request-list"
);
const outgoingRequestList = document.querySelector(
    "#outgoing-request-list"
);
const friendList = document.querySelector("#friend-list");
const friendListFilter = document.querySelector(
    "#friend-list-filter"
);
const friendSearchForm = document.querySelector(
    "#friend-search-form"
);
const friendSearchInput = document.querySelector(
    "#friend-search-input"
);
const friendSearchButton = document.querySelector(
    "#friend-search-button"
);
const friendSearchResults = document.querySelector(
    "#friend-search-results"
);
const friendsMessage = document.querySelector("#friends-message");

const badgeSymbols = {
    badge_admin_shield: "🛡",
    badge_ace: "♠",
    badge_penguin: "🐧",
    badge_dice: "⚄",
    badge_crown: "♛",
    badge_first_steps: "★",
    badge_level_10: "✦",
    badge_level_50: "◆",
    badge_chip_vault: "◈",
    badge_hot_streak: "🔥",
    badge_poker_veteran: "♠",
    badge_big_pot: "●",
    badge_draw_veteran: "🂠",
    badge_twenty_one: "21",
    badge_blackjack_veteran: "♣",
    badge_hearts_winner: "♥",
    badge_klondike: "K",
    badge_spider: "🕷",
    badge_plinko_profit: "•",
    badge_ice_crossing: "❄",
    badge_horse_winner: "♞",
    badge_green_zero: "0"
};

let currentUser = null;
let friends = [];
let friendRequests = [];
let friendshipChannel = null;
let refreshTimer = null;
let actionBusy = false;

function setMessage(message = "", type = "") {
    friendsMessage.textContent = message;
    friendsMessage.className =
        `form-message friends-message ${type}`.trim();
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}

function formatDate(value) {
    if (!value) {
        return "";
    }

    return new Intl.DateTimeFormat(
        "en-AU",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    ).format(new Date(value));
}

function initialsFromUsername(username) {
    const parts = String(username ?? "?")
        .replaceAll("_", " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
        return "?";
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0][0]
        + parts[parts.length - 1][0]
    ).toUpperCase();
}

function badgeSymbol(badgeId) {
    return badgeSymbols[badgeId] ?? "";
}

function emptyMessage(text) {
    const element = document.createElement("p");
    element.className = "friends-empty";
    element.textContent = text;
    return element;
}

function createButton(label, action, data, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
        `friend-action ${className}`.trim();
    button.textContent = label;
    button.dataset.action = action;

    if (data.friendship_id) {
        button.dataset.friendshipId = data.friendship_id;
    }

    if (data.user_id) {
        button.dataset.userId = data.user_id;
    }

    return button;
}

function createCallButton(label, player, mode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
        `friend-call-action ${mode}`;
    button.textContent = label;
    button.dataset.playerCallUser = player.user_id;
    button.dataset.playerCallName = player.username;
    button.dataset.playerCallMode = mode;
    return button;
}

function createFriendCard(
    player,
    mode
) {
    const card = document.createElement("article");
    card.className = "friend-card";
    card.dataset.theme =
        player.theme_id ?? "theme_midnight";

    const avatarFrame = document.createElement("div");
    avatarFrame.className = "friend-avatar-frame";
    avatarFrame.dataset.frame =
        player.frame_id ?? "frame_standard";

    const avatar = document.createElement("div");
    avatar.className = "friend-avatar";
    avatar.textContent =
        initialsFromUsername(player.username);

    avatarFrame.append(avatar);

    const body = document.createElement("div");
    body.className = "friend-card-body";

    const nameRow = document.createElement("div");
    nameRow.className = "friend-name-row";

    const name = document.createElement("a");
    name.className = "friend-name";
    name.href = `profile.html?id=${encodeURIComponent(
        player.user_id
    )}`;
    name.textContent = player.username;

    const level = document.createElement("span");
    level.className = "friend-level";
    level.textContent = `Lv. ${Number(player.level ?? 1)}`;

    nameRow.append(name, level);

    if (player.is_admin) {
        const admin = document.createElement("span");
        admin.className = "friend-admin";
        admin.textContent = "Admin";
        nameRow.append(admin);
    }

    const cosmeticLine = document.createElement("div");
    cosmeticLine.className = "friend-cosmetic-line";

    const title = document.createElement("span");
    title.textContent = player.title_name || "Player";
    cosmeticLine.append(title);

    const symbol = badgeSymbol(player.badge_id);

    if (symbol) {
        const badge = document.createElement("span");
        badge.className = "friend-badge";
        badge.textContent = symbol;
        badge.title = player.badge_name || "";
        cosmeticLine.append(badge);
    }

    const meta = document.createElement("p");
    meta.className = "friend-meta";

    if (mode === "friend") {
        meta.textContent = player.friends_since
            ? `Friends since ${formatDate(player.friends_since)}`
            : "Friend";
    } else if (mode === "incoming") {
        meta.textContent = player.requested_at
            ? `Requested ${formatDate(player.requested_at)}`
            : "Incoming request";
    } else if (mode === "outgoing") {
        meta.textContent = player.requested_at
            ? `Sent ${formatDate(player.requested_at)}`
            : "Request sent";
    } else {
        const labels = {
            none: "Not friends yet",
            friends: "Already friends",
            outgoing_pending: "Request sent",
            incoming_pending: "Sent you a request"
        };
        meta.textContent =
            labels[player.relationship_state] ?? "";
    }

    const actions = document.createElement("div");
    actions.className = "friend-actions";

    const profileLink = document.createElement("a");
    profileLink.className = "friend-profile-link";
    profileLink.href = name.href;
    profileLink.textContent = "View profile";
    actions.append(profileLink);

    if (mode === "incoming") {
        actions.append(
            createButton(
                "Accept",
                "accept",
                player,
                "primary"
            ),
            createButton(
                "Decline",
                "decline",
                player,
                "danger"
            )
        );
    } else if (mode === "outgoing") {
        actions.append(
            createButton(
                "Cancel request",
                "cancel",
                player,
                "danger"
            )
        );
    } else if (mode === "friend") {
        const messageLink = document.createElement("a");
        messageLink.className = "friend-profile-link";
        messageLink.href = `messages.html?user=${encodeURIComponent(
            player.user_id
        )}`;
        messageLink.textContent = "Message";

        actions.append(
            messageLink,
            createCallButton(
                "Audio call",
                player,
                "audio"
            ),
            createCallButton(
                "Video call",
                player,
                "video"
            ),
            createButton(
                "Remove friend",
                "remove",
                player,
                "danger"
            )
        );
    } else if (mode === "search") {
        if (player.relationship_state === "none") {
            actions.append(
                createButton(
                    "Add friend",
                    "send",
                    player,
                    "primary"
                )
            );
        } else if (
            player.relationship_state === "incoming_pending"
        ) {
            actions.append(
                createButton(
                    "Accept",
                    "accept",
                    player,
                    "primary"
                ),
                createButton(
                    "Decline",
                    "decline",
                    player,
                    "danger"
                )
            );
        } else if (
            player.relationship_state === "outgoing_pending"
        ) {
            actions.append(
                createButton(
                    "Cancel request",
                    "cancel",
                    player,
                    "danger"
                )
            );
        } else {
            const status = document.createElement("button");
            status.type = "button";
            status.className = "friend-action";
            status.textContent = "Friends";
            status.disabled = true;
            actions.append(status);
        }
    }

    body.append(
        nameRow,
        cosmeticLine,
        meta,
        actions
    );

    card.append(avatarFrame, body);
    return card;
}

function renderRequests() {
    const incoming = friendRequests.filter(
        (request) => request.direction === "incoming"
    );
    const outgoing = friendRequests.filter(
        (request) => request.direction === "outgoing"
    );

    incomingRequestList.replaceChildren();
    outgoingRequestList.replaceChildren();

    incomingCount.textContent = formatNumber(incoming.length);
    outgoingCount.textContent = formatNumber(outgoing.length);
    incomingSectionCount.textContent = formatNumber(incoming.length);
    outgoingSectionCount.textContent = formatNumber(outgoing.length);

    if (!incoming.length) {
        incomingRequestList.append(
            emptyMessage("No incoming friend requests.")
        );
    } else {
        for (const request of incoming) {
            incomingRequestList.append(
                createFriendCard(request, "incoming")
            );
        }
    }

    if (!outgoing.length) {
        outgoingRequestList.append(
            emptyMessage("No sent friend requests.")
        );
    } else {
        for (const request of outgoing) {
            outgoingRequestList.append(
                createFriendCard(request, "outgoing")
            );
        }
    }
}

function renderFriends() {
    const query =
        friendListFilter.value.trim().toLowerCase();

    const filtered = query
        ? friends.filter((friend) =>
            friend.username.toLowerCase().includes(query)
        )
        : friends;

    friendCount.textContent = formatNumber(friends.length);
    friendList.replaceChildren();

    if (!filtered.length) {
        friendList.append(
            emptyMessage(
                friends.length
                    ? "No friends match that filter."
                    : "You have not added any friends yet."
            )
        );
        return;
    }

    for (const friend of filtered) {
        friendList.append(
            createFriendCard(friend, "friend")
        );
    }
}

async function loadFriendsData() {
    const [
        friendsResult,
        requestsResult
    ] = await Promise.all([
        window.supabaseClient.rpc(
            "get_my_friends",
            {
                p_search: null
            }
        ),
        window.supabaseClient.rpc(
            "get_my_friend_requests"
        )
    ]);

    if (friendsResult.error) {
        throw friendsResult.error;
    }

    if (requestsResult.error) {
        throw requestsResult.error;
    }

    friends = friendsResult.data ?? [];
    friendRequests = requestsResult.data ?? [];

    renderFriends();
    renderRequests();
}

async function searchPlayers() {
    const query = friendSearchInput.value.trim();

    if (query.length < 2) {
        friendSearchResults.replaceChildren(
            emptyMessage(
                "Enter at least two characters."
            )
        );
        return;
    }

    friendSearchButton.disabled = true;
    friendSearchResults.replaceChildren(
        emptyMessage("Searching...")
    );

    try {
        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "search_players_for_friends",
            {
                p_query: query,
                p_limit: 20
            }
        );

        if (error) {
            throw error;
        }

        friendSearchResults.replaceChildren();

        if (!data?.length) {
            friendSearchResults.append(
                emptyMessage("No matching players were found.")
            );
            return;
        }

        for (const player of data) {
            friendSearchResults.append(
                createFriendCard(player, "search")
            );
        }
    } catch (error) {
        console.error(error);
        friendSearchResults.replaceChildren(
            emptyMessage(
                error.message || "Player search failed."
            )
        );
    } finally {
        friendSearchButton.disabled = false;
    }
}

async function runFriendAction(button) {
    if (actionBusy) {
        return;
    }

    actionBusy = true;
    setMessage();

    document
        .querySelectorAll(".friend-action")
        .forEach((candidate) => {
            candidate.disabled = true;
        });

    try {
        const action = button.dataset.action;
        const friendshipId =
            button.dataset.friendshipId || null;
        const userId =
            button.dataset.userId || null;

        let result;

        if (action === "send") {
            result = await window.supabaseClient.rpc(
                "send_friend_request",
                {
                    p_target_user_id: userId
                }
            );
        } else if (
            action === "accept"
            || action === "decline"
        ) {
            result = await window.supabaseClient.rpc(
                "respond_to_friend_request",
                {
                    p_friendship_id: friendshipId,
                    p_accept: action === "accept"
                }
            );
        } else if (action === "cancel") {
            result = await window.supabaseClient.rpc(
                "cancel_friend_request",
                {
                    p_friendship_id: friendshipId
                }
            );
        } else if (action === "remove") {
            const confirmed = window.confirm(
                "Remove this player from your friends?"
            );

            if (!confirmed) {
                return;
            }

            result = await window.supabaseClient.rpc(
                "remove_friend",
                {
                    p_friend_user_id: userId
                }
            );
        } else {
            return;
        }

        if (result.error) {
            throw result.error;
        }

        const messages = {
            send: "Friend request sent.",
            accept: "Friend request accepted.",
            decline: "Friend request declined.",
            cancel: "Friend request cancelled.",
            remove: "Friend removed."
        };

        setMessage(messages[action], "success");
        await loadFriendsData();

        if (friendSearchInput.value.trim().length >= 2) {
            await searchPlayers();
        }
    } catch (error) {
        console.error(error);
        setMessage(
            error.message || "The friend action failed.",
            "error"
        );
    } finally {
        actionBusy = false;

        document
            .querySelectorAll(".friend-action")
            .forEach((candidate) => {
                if (!candidate.textContent.includes("Friends")) {
                    candidate.disabled = false;
                }
            });
    }
}

function scheduleRefresh() {
    if (refreshTimer) {
        window.clearTimeout(refreshTimer);
    }

    refreshTimer = window.setTimeout(async () => {
        try {
            await loadFriendsData();
        } catch (error) {
            console.warn(
                "Friend data could not be refreshed:",
                error
            );
        }
    }, 180);
}

function subscribeToFriendships() {
    friendshipChannel = window.supabaseClient
        .channel(`friendships-${currentUser.id}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "player_friendships"
            },
            scheduleRefresh
        )
        .subscribe();
}

friendSearchForm.addEventListener(
    "submit",
    (event) => {
        event.preventDefault();
        searchPlayers();
    }
);

friendListFilter.addEventListener(
    "input",
    renderFriends
);

document.addEventListener("click", (event) => {
    const button = event.target.closest(
        ".friend-action[data-action]"
    );

    if (!button) {
        return;
    }

    runFriendAction(button);
});

window.addEventListener("beforeunload", () => {
    if (friendshipChannel) {
        window.supabaseClient.removeChannel(
            friendshipChannel
        );
    }
});

async function initialiseFriends() {
    try {
        const {
            data: { user },
            error
        } = await window.supabaseClient.auth.getUser();

        if (error || !user) {
            window.location.href = "login.html";
            return;
        }

        currentUser = user;
        await loadFriendsData();
        subscribeToFriendships();
    } catch (error) {
        console.error(error);
        setMessage(
            error.message || "Friends could not be loaded.",
            "error"
        );
    }
}

initialiseFriends();
