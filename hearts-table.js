const tableId =
    new URLSearchParams(window.location.search).get("id");

const tableNameLabel = document.querySelector("#table-name");
const tableDescriptionLabel = document.querySelector("#table-description");
const currentUsernameLabel = document.querySelector("#current-username");
const walletBalanceLabel = document.querySelector("#wallet-balance");
const playerCountLabel = document.querySelector("#player-count-label");
const handNumberLabel = document.querySelector("#hand-number-label");
const passDirectionLabel = document.querySelector("#pass-direction-label");
const trickNumberLabel = document.querySelector("#trick-number-label");
const scoreList = document.querySelector("#score-list");
const playerGrid = document.querySelector("#hearts-player-grid");
const currentTrickElement = document.querySelector("#current-trick");
const turnDescription = document.querySelector("#turn-description");
const winnerMessage = document.querySelector("#winner-message");
const handInstruction = document.querySelector("#hand-instruction");
const ownCardsElement = document.querySelector("#own-hearts-cards");
const waitingControls = document.querySelector("#waiting-controls");
const waitingText = document.querySelector("#waiting-text");
const startGameButton = document.querySelector("#start-game-button");
const passControls = document.querySelector("#pass-controls");
const submitPassButton = document.querySelector("#submit-pass-button");
const playControls = document.querySelector("#play-controls");
const playCardButton = document.querySelector("#play-card-button");
const turnMessage = document.querySelector("#turn-message");
const trickHistory = document.querySelector("#trick-history");
const cancelGameButton = document.querySelector("#cancel-game-button");
const leaveGameButton = document.querySelector("#leave-game-button");
const tableError = document.querySelector("#table-error");

let gameState = null;
let gameChannel = null;
let statePollTimer = null;
let refreshTimer = null;
let requestInProgress = false;
let stateLoadInProgress = false;
let stateLoadQueued = false;
let selectedPassCards = new Set();
let selectedPlayCard = null;
let selectedHandId = null;


function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(Number(value ?? 0));
}


function showError(message = "") {
    tableError.textContent = message;
}


function setRequestInProgress(value) {
    requestInProgress = value;

    for (const element of [
        startGameButton,
        submitPassButton,
        playCardButton,
        cancelGameButton,
        leaveGameButton
    ]) {
        element.disabled = value;
    }

    document
        .querySelectorAll(".hearts-kick-button")
        .forEach((button) => {
            button.disabled = value;
        });
}


function suitSymbol(suit) {
    return {
        S: "♠",
        H: "♥",
        D: "♦",
        C: "♣"
    }[suit] ?? "";
}


function rankLabel(rank) {
    return rank === "T" ? "10" : rank;
}


function suitOrder(card) {
    return {
        C: 0,
        D: 1,
        S: 2,
        H: 3
    }[card.slice(1, 2)] ?? 9;
}


function rankOrder(card) {
    const rank = card.slice(0, 1);

    return {
        "2": 2,
        "3": 3,
        "4": 4,
        "5": 5,
        "6": 6,
        "7": 7,
        "8": 8,
        "9": 9,
        T: 10,
        J: 11,
        Q: 12,
        K: 13,
        A: 14
    }[rank] ?? 0;
}


function sortedCards(cards) {
    return [...cards].sort((first, second) => {
        const suitDifference = suitOrder(first) - suitOrder(second);

        if (suitDifference !== 0) {
            return suitDifference;
        }

        return rankOrder(first) - rankOrder(second);
    });
}


function createCardElement(cardCode, className = "hearts-display-card") {
    const element = document.createElement("div");
    element.className = className;

    const rank = cardCode.slice(0, 1);
    const suit = cardCode.slice(1, 2);

    if (suit === "H" || suit === "D") {
        element.classList.add("red-card");
    }

    const rankElement = document.createElement("span");
    rankElement.className = "hearts-card-rank";
    rankElement.textContent = `${rankLabel(rank)}${suitSymbol(suit)}`;

    const suitElement = document.createElement("span");
    suitElement.className = "hearts-card-suit";
    suitElement.textContent = suitSymbol(suit);

    element.append(rankElement, suitElement);
    return element;
}


function createOwnCard(cardCode, mode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hearts-card-button";

    const rank = cardCode.slice(0, 1);
    const suit = cardCode.slice(1, 2);

    if (suit === "H" || suit === "D") {
        button.classList.add("red-card");
    }

    const selectable = mode === "pass" || mode === "play";

    if (selectable) {
        button.classList.add("selectable");
    } else {
        button.disabled = true;
    }

    if (
        selectedPassCards.has(cardCode)
        || selectedPlayCard === cardCode
    ) {
        button.classList.add("selected");
    }

    const rankElement = document.createElement("span");
    rankElement.className = "hearts-card-rank";
    rankElement.textContent = `${rankLabel(rank)}${suitSymbol(suit)}`;

    const suitElement = document.createElement("span");
    suitElement.className = "hearts-card-suit";
    suitElement.textContent = suitSymbol(suit);

    button.append(rankElement, suitElement);

    if (mode === "pass") {
        button.addEventListener("click", () => {
            if (selectedPassCards.has(cardCode)) {
                selectedPassCards.delete(cardCode);
            } else if (selectedPassCards.size < 3) {
                selectedPassCards.add(cardCode);
            } else {
                showError("Select exactly three cards. Deselect one first.");
            }

            selectedPlayCard = null;
            renderOwnCards();
            configureControls();
        });
    } else if (mode === "play") {
        button.addEventListener("click", () => {
            selectedPlayCard = selectedPlayCard === cardCode
                ? null
                : cardCode;
            selectedPassCards.clear();
            renderOwnCards();
            configureControls();
        });
    }

    return button;
}


function createBadge(text, className) {
    const badge = document.createElement("span");
    badge.className = className;
    badge.textContent = text;
    return badge;
}


function createPlayerSeat(player) {
    const seat = document.createElement("article");
    seat.className = "hearts-player-seat";
    seat.dataset.userId = String(player.user_id ?? "");

    if (player.is_bot) {
        seat.dataset.isBot = "true";
        seat.classList.add("card-bot-seat-highlight");
    }

    if (player.is_turn) {
        seat.classList.add("active-turn-seat");
    }

    const heading = document.createElement("div");
    heading.className = "hearts-seat-heading";

    const name = document.createElement("strong");
    name.textContent = player.username;
    name.dataset.profileUserId = String(player.user_id ?? "");
    name.dataset.profileUsername = String(player.username ?? "");

    if (player.is_bot) {
        // Do not ask the normal profile/cosmetic enhancer to decorate a
        // server-only bot identity. It has no auth.users account.
        name.dataset.cosmeticProfileState = "linked";
    }

    const badges = document.createElement("div");
    badges.className = "poker-badge-row";

    if (player.is_host) {
        badges.append(createBadge("Host", "host-badge"));
    }

    if (player.is_bot) {
        badges.append(
            createBadge(
                "BOT",
                "card-bot-inline-badge"
            )
        );
    }

    if (player.is_turn) {
        badges.append(createBadge("Turn", "queue-badge"));
    }

    heading.append(name, badges);

    const details = document.createElement("div");
    details.className = "hearts-seat-details";

    const score = document.createElement("span");
    score.textContent = `${player.score} total`;

    const handPoints = document.createElement("span");
    handPoints.textContent = `${player.hand_points} this hand`;

    details.append(score, handPoints);

    const cardBacks = document.createElement("div");
    cardBacks.className = "hearts-card-backs";

    for (
        let index = 0;
        index < Math.min(Number(player.card_count), 13);
        index += 1
    ) {
        const cardBack = document.createElement("span");
        cardBack.className = "hearts-card-back";
        cardBacks.append(cardBack);
    }

    seat.append(heading, details, cardBacks);

    const canKick =
        gameState.table.status === "waiting"
        && gameState.table.host_id === gameState.you.user_id
        && player.user_id !== gameState.you.user_id
        && !player.is_bot;

    if (canKick) {
        const kickButton = document.createElement("button");
        kickButton.type = "button";
        kickButton.className = "hearts-kick-button danger-button";
        kickButton.textContent = "Kick";
        kickButton.disabled = requestInProgress;
        kickButton.addEventListener("click", () => kickPlayer(player));
        seat.append(kickButton);
    }

    return seat;
}


function renderPlayers() {
    playerGrid.replaceChildren();

    for (const player of (
        Array.isArray(gameState?.players)
            ? gameState.players
            : []
    )) {
        playerGrid.append(createPlayerSeat(player));
    }
}


function renderScores() {
    scoreList.replaceChildren();

    const sortedPlayers = [
        ...(Array.isArray(gameState?.players)
            ? gameState.players
            : [])
    ].sort(
        (first, second) => Number(first.score) - Number(second.score)
    );

    for (const player of sortedPlayers) {
        const chip = document.createElement("div");
        chip.className = "hearts-score-chip";

        const name = document.createElement("span");
        name.textContent = player.username;

        const score = document.createElement("strong");
        score.textContent = String(player.score);

        chip.append(name, score);
        scoreList.append(chip);
    }
}


function renderCurrentTrick() {
    currentTrickElement.replaceChildren();

    const currentTrick = Array.isArray(gameState?.current_trick)
        ? gameState.current_trick
        : [];

    if (!currentTrick.length) {
        const empty = document.createElement("p");
        empty.className = "description";
        empty.textContent = gameState.hand?.status === "playing"
            ? "Waiting for the lead card."
            : "No active trick.";
        currentTrickElement.append(empty);
        return;
    }

    for (const play of currentTrick) {
        const item = document.createElement("div");
        item.className = "trick-card-item";

        item.append(createCardElement(play.card));

        const name = document.createElement("span");
        name.textContent = play.username;
        item.append(name);

        currentTrickElement.append(item);
    }
}


function renderOwnCards() {
    ownCardsElement.replaceChildren();

    const cards = sortedCards(
        Array.isArray(gameState?.you?.cards)
            ? gameState.you.cards
            : []
    );

    let mode = "view";

    if (
        gameState?.hand?.status === "passing"
        && !gameState.you.has_passed
    ) {
        mode = "pass";
    } else if (
        gameState?.hand?.status === "playing"
        && gameState.you.is_turn
    ) {
        mode = "play";
    }

    for (const card of cards) {
        ownCardsElement.append(createOwnCard(card, mode));
    }

    if (!cards.length) {
        const empty = document.createElement("p");
        empty.className = "description";
        empty.textContent = "No cards currently dealt.";
        ownCardsElement.append(empty);
    }
}


function renderTrickHistory() {
    trickHistory.replaceChildren();

    const recentTricks = Array.isArray(gameState?.recent_tricks)
        ? gameState.recent_tricks
        : [];

    if (!recentTricks.length) {
        const item = document.createElement("li");
        item.textContent = "No completed tricks yet.";
        trickHistory.append(item);
        return;
    }

    for (const trick of recentTricks) {
        const item = document.createElement("li");

        const number = document.createElement("strong");
        number.textContent = `Trick ${trick.trick_number}`;

        const result = document.createElement("span");
        result.textContent =
            `${trick.winner_username} · ${trick.points} point${trick.points === 1 ? "" : "s"}`;

        item.append(number, result);
        trickHistory.append(item);
    }
}


function configureControls() {
    const { table, hand, you } = gameState;

    waitingControls.classList.add("hidden");
    passControls.classList.add("hidden");
    playControls.classList.add("hidden");
    startGameButton.classList.add("hidden");
    cancelGameButton.classList.add("hidden");
    turnMessage.textContent = "";

    if (table.status === "waiting") {
        waitingControls.classList.remove("hidden");

        if (you.can_start) {
            startGameButton.classList.remove("hidden");
            waitingText.textContent =
                "Four players are ready with the fixed entry stake.";
        } else if (table.seated_player_count < 4) {
            waitingText.textContent =
                `Waiting for ${4 - table.seated_player_count} more player${4 - table.seated_player_count === 1 ? "" : "s"}.`;
        } else if (table.host_id !== you.user_id) {
            waitingText.textContent = "Waiting for the host to start.";
        } else {
            waitingText.textContent =
                "All four players must have exactly the fixed entry stake.";
        }

        return;
    }

    if (you.can_cancel) {
        cancelGameButton.classList.remove("hidden");
    }

    if (!hand) {
        turnMessage.textContent = "Waiting for the Hearts hand to load.";
        return;
    }

    if (hand.status === "passing") {
        if (you.has_passed) {
            turnMessage.textContent =
                "Your pass is locked in. Waiting for the other players.";
        } else {
            passControls.classList.remove("hidden");
            submitPassButton.disabled =
                requestInProgress || selectedPassCards.size !== 3;
            turnMessage.textContent =
                `Pass three cards ${hand.pass_direction}.`;
        }

        return;
    }

    if (hand.status === "playing") {
        if (you.is_turn) {
            playControls.classList.remove("hidden");
            playCardButton.disabled =
                requestInProgress || !selectedPlayCard;
            turnMessage.textContent = "Your turn to play a card.";
        } else {
            turnMessage.textContent = "Waiting for another player.";
        }
    }
}


function renderGameState(state) {
    if (
        !state
        || typeof state !== "object"
        || !state.table
        || !state.you
    ) {
        throw new Error(
            "The Hearts server returned an incomplete game state."
        );
    }

    state.players = Array.isArray(state.players)
        ? state.players
        : [];
    state.current_trick = Array.isArray(state.current_trick)
        ? state.current_trick
        : [];
    state.recent_tricks = Array.isArray(state.recent_tricks)
        ? state.recent_tricks
        : [];

    gameState = state;
    showError();

    if (selectedHandId !== state.hand?.id) {
        selectedHandId = state.hand?.id ?? null;
        selectedPassCards.clear();
        selectedPlayCard = null;
    }

    if (state.hand?.status !== "passing") {
        selectedPassCards.clear();
    }

    if (!state.you.is_turn || state.hand?.status !== "playing") {
        selectedPlayCard = null;
    }

    tableNameLabel.textContent = state.table.name;
    tableDescriptionLabel.textContent =
        `${formatChips(state.table.entry_stake)} chip entry stake · first to ${state.game?.target_score ?? 100}`;
    currentUsernameLabel.textContent = state.you.username;
    walletBalanceLabel.textContent = formatChips(state.you.wallet_chips);
    playerCountLabel.textContent =
        `${state.table.seated_player_count}/${state.table.max_players}`;
    handNumberLabel.textContent = state.hand
        ? String(state.hand.hand_number)
        : "Waiting";
    passDirectionLabel.textContent = state.hand
        ? state.hand.pass_direction
        : "Waiting";
    trickNumberLabel.textContent = state.hand
        ? `${state.hand.trick_number}/13`
        : "0/13";

    winnerMessage.textContent =
        state.game?.winner_text
        || state.hand?.winner_text
        || "";

    if (state.hand?.status === "passing") {
        turnDescription.textContent =
            `Passing ${state.hand.pass_direction}`;
        handInstruction.textContent = state.you.has_passed
            ? "Your pass has been submitted."
            : "Select exactly three cards to pass.";
    } else if (state.hand?.status === "playing") {
        turnDescription.textContent = state.you.is_turn
            ? "Your turn"
            : "A trick is in progress";
        handInstruction.textContent = state.you.is_turn
            ? "Select one card and confirm the play. Illegal cards will be rejected by the server."
            : "Wait for your turn.";
    } else {
        turnDescription.textContent = "Waiting for the match";
        handInstruction.textContent =
            "Your cards will appear when the match begins.";
    }

    renderScores();
    renderPlayers();
    renderCurrentTrick();
    renderOwnCards();
    renderTrickHistory();
    configureControls();

    leaveGameButton.disabled =
        requestInProgress || state.table.status !== "waiting";

    window.dispatchEvent(
        new CustomEvent("hearts-state-rendered", {
            detail: state
        })
    );
}


async function loadGameState() {
    if (!tableId) {
        throw new Error("No Hearts game ID was supplied.");
    }

    if (stateLoadInProgress) {
        stateLoadQueued = true;
        return;
    }

    stateLoadInProgress = true;

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "get_hearts_state",
            { p_table_id: tableId }
        );

        if (error) {
            if (
                error.message
                    ?.toLowerCase()
                    .includes("not seated")
            ) {
                window.location.href = "poker.html";
                return;
            }

            throw error;
        }

        renderGameState(data);
    } finally {
        stateLoadInProgress = false;

        if (stateLoadQueued) {
            stateLoadQueued = false;
            window.setTimeout(() => {
                loadGameState().catch((error) => {
                    console.error(error);
                    showError(
                        error.message
                        || "The Hearts table could not refresh."
                    );
                });
            }, 0);
        }
    }
}


window.refreshHeartsTableState = loadGameState;

window.addEventListener(
    "card-bot-table-changed",
    () => {
        loadGameState().catch((error) => {
            console.error(error);
            showError(
                error.message
                || "The Hearts table could not refresh after changing bots."
            );
        });
    }
);


async function kickPlayer(player) {
    const confirmed = window.confirm(
        `Remove ${player.username} and return their entry stake?`
    );

    if (!confirmed) {
        return;
    }

    setRequestInProgress(true);
    showError();

    try {
        const { error } = await window.supabaseClient.rpc(
            "kick_waiting_card_game_player",
            {
                p_table_id: tableId,
                p_user_id: player.user_id
            }
        );

        if (error) {
            throw error;
        }

        await loadGameState();
    } catch (error) {
        console.error(error);
        showError(error.message || "The player could not be removed.");
    } finally {
        setRequestInProgress(false);
    }
}


startGameButton.addEventListener("click", async () => {
    if (requestInProgress) {
        return;
    }

    setRequestInProgress(true);
    showError();

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "start_hearts_game",
            { p_table_id: tableId }
        );

        if (error) {
            throw error;
        }

        renderGameState(data);
    } catch (error) {
        console.error(error);
        showError(error.message || "The Hearts match could not be started.");
    } finally {
        setRequestInProgress(false);
        if (gameState) {
            configureControls();
        }
    }
});


submitPassButton.addEventListener("click", async () => {
    if (requestInProgress || selectedPassCards.size !== 3) {
        return;
    }

    setRequestInProgress(true);
    showError();

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "submit_hearts_pass",
            {
                p_table_id: tableId,
                p_cards: [...selectedPassCards]
            }
        );

        if (error) {
            throw error;
        }

        selectedPassCards.clear();
        renderGameState(data);
    } catch (error) {
        console.error(error);
        showError(error.message || "The cards could not be passed.");
    } finally {
        setRequestInProgress(false);
        if (gameState) {
            configureControls();
        }
    }
});


playCardButton.addEventListener("click", async () => {
    if (requestInProgress || !selectedPlayCard) {
        return;
    }

    const card = selectedPlayCard;
    setRequestInProgress(true);
    showError();

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "play_hearts_card",
            {
                p_table_id: tableId,
                p_card: card
            }
        );

        if (error) {
            throw error;
        }

        selectedPlayCard = null;
        renderGameState(data);
    } catch (error) {
        console.error(error);
        showError(error.message || "The card could not be played.");
    } finally {
        setRequestInProgress(false);
        if (gameState) {
            configureControls();
        }
    }
});


cancelGameButton.addEventListener("click", async () => {
    const confirmed = window.confirm(
        "Cancel the active Hearts match? Entry stakes will remain unchanged."
    );

    if (!confirmed) {
        return;
    }

    setRequestInProgress(true);
    showError();

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "cancel_hearts_game",
            { p_table_id: tableId }
        );

        if (error) {
            throw error;
        }

        renderGameState(data);
    } catch (error) {
        console.error(error);
        showError(error.message || "The Hearts match could not be cancelled.");
    } finally {
        setRequestInProgress(false);
    }
});


leaveGameButton.addEventListener("click", async () => {
    if (gameState?.table?.status !== "waiting") {
        showError("You cannot leave during an active Hearts match.");
        return;
    }

    const confirmed = window.confirm(
        "Leave this Hearts game and return your table stack to your wallet?"
    );

    if (!confirmed) {
        return;
    }

    setRequestInProgress(true);
    showError();

    try {
        const { error } = await window.supabaseClient.rpc(
            "leave_poker_table",
            { p_table_id: tableId }
        );

        if (error) {
            throw error;
        }

        window.location.href = "poker.html";
    } catch (error) {
        console.error(error);
        showError(error.message || "The Hearts game could not be left.");
        setRequestInProgress(false);
    }
});


function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(async () => {
        if (!requestInProgress) {
            try {
                await loadGameState();
            } catch (error) {
                console.error(error);
            }
        }
    }, 120);
}


function startStatePolling() {
    window.clearInterval(statePollTimer);

    statePollTimer = window.setInterval(() => {
        if (
            document.visibilityState !== "visible"
            || requestInProgress
            || stateLoadInProgress
        ) {
            return;
        }

        loadGameState().catch((error) => {
            console.error(error);
            showError(
                error.message
                || "The Hearts table could not refresh."
            );
        });
    }, 1500);
}


window.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
        return;
    }

    loadGameState().catch((error) => {
        console.error(error);
        showError(
            error.message
            || "The Hearts table could not refresh."
        );
    });
});


window.addEventListener("beforeunload", () => {
    window.clearInterval(statePollTimer);

    if (gameChannel) {
        window.supabaseClient.removeChannel(gameChannel);
    }
});


async function initialiseGame() {
    try {
        const {
            data: { user },
            error
        } = await window.supabaseClient.auth.getUser();

        if (error || !user) {
            window.location.href = "login.html";
            return;
        }

        await loadGameState();
        startStatePolling();
    } catch (error) {
        console.error(error);
        tableNameLabel.textContent = "Hearts failed to load";
        showError(error.message || "The Hearts game could not be loaded.");
    }
}


initialiseGame();
