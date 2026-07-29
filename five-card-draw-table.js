const tableId =
    new URLSearchParams(window.location.search).get("id");

const tableNameLabel = document.querySelector("#table-name");
const tableDescriptionLabel = document.querySelector("#table-description");
const currentUsernameLabel = document.querySelector("#current-username");
const walletBalanceLabel = document.querySelector("#wallet-balance");
const playerCountLabel = document.querySelector("#player-count-label");
const streetLabel = document.querySelector("#street-label");
const potLabel = document.querySelector("#pot-label");
const currentBetLabel = document.querySelector("#current-bet-label");
const joinQueuePanel = document.querySelector("#join-queue-panel");
const joinQueueList = document.querySelector("#join-queue-list");
const playerGrid = document.querySelector("#draw-player-grid");
const centreMessage = document.querySelector("#draw-centre-message");
const winnerMessage = document.querySelector("#winner-message");
const selectionMessage = document.querySelector("#draw-selection-message");
const ownCardsElement = document.querySelector("#own-cards");
const hideCardsButton = document.querySelector("#hide-cards-button");
const waitingControls = document.querySelector("#waiting-controls");
const waitingText = document.querySelector("#waiting-text");
const startHandButton = document.querySelector("#start-hand-button");
const bettingControls = document.querySelector("#betting-controls");
const foldButton = document.querySelector("#fold-button");
const checkCallButton = document.querySelector("#check-call-button");
const allInButton = document.querySelector("#all-in-button");
const raiseAmountInput = document.querySelector("#raise-amount-input");
const betRaiseButton = document.querySelector("#bet-raise-button");
const drawControls = document.querySelector("#draw-controls");
const submitDrawButton = document.querySelector("#submit-draw-button");
const turnMessage = document.querySelector("#turn-message");
const actionHistory = document.querySelector("#action-history");
const repairTableButton = document.querySelector("#repair-table-button");
const leaveGameButton = document.querySelector("#leave-game-button");
const tableError = document.querySelector("#table-error");

let gameState = null;
let gameChannel = null;
let refreshTimer = null;
let requestInProgress = false;
let selectedIndexes = new Set();
let selectedHandId = null;
let repairInProgress = false;

let cardsHidden =
    sessionStorage.getItem(`draw-cards-hidden-${tableId}`) === "true";


function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(Number(value ?? 0));
}


function showError(message = "") {
    tableError.textContent = message;
}


function setRequestInProgress(value) {
    requestInProgress = value;

    for (const element of [
        startHandButton,
        foldButton,
        checkCallButton,
        allInButton,
        betRaiseButton,
        submitDrawButton,
        repairTableButton,
        leaveGameButton
    ]) {
        element.disabled = value;
    }

    raiseAmountInput.disabled = value;

    document
        .querySelectorAll(".draw-kick-button")
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


function readableStreet(street) {
    return {
        pre_draw: "First betting",
        draw: "Draw",
        post_draw: "Final betting",
        complete: "Complete"
    }[street] ?? "Waiting";
}


function createOwnCard(cardCode, index, selectable) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "draw-card-button";

    if (cardsHidden) {
        button.classList.add("face-down");
        button.textContent = "♠";
        button.disabled = true;
        return button;
    }

    if (!cardCode) {
        button.classList.add("face-down");
        button.textContent = "♠";
        button.disabled = true;
        return button;
    }

    const rank = cardCode.slice(0, 1);
    const suit = cardCode.slice(1, 2);

    if (suit === "H" || suit === "D") {
        button.classList.add("red-card");
    }

    if (selectable) {
        button.classList.add("selectable");
    } else {
        button.disabled = true;
    }

    if (selectedIndexes.has(index)) {
        button.classList.add("selected");
    }

    const rankElement = document.createElement("span");
    rankElement.className = "draw-card-rank";
    rankElement.textContent = `${rankLabel(rank)}${suitSymbol(suit)}`;

    const suitElement = document.createElement("span");
    suitElement.className = "draw-card-suit";
    suitElement.textContent = suitSymbol(suit);

    button.append(rankElement, suitElement);

    if (selectable) {
        button.addEventListener("click", () => {
            if (selectedIndexes.has(index)) {
                selectedIndexes.delete(index);
            } else if (selectedIndexes.size < 3) {
                selectedIndexes.add(index);
            } else {
                showError("You may discard at most three cards.");
            }

            renderOwnCards();
            updateDrawButton();
        });
    }

    return button;
}


function createMiniCard(cardCode) {
    const element = document.createElement("span");
    element.className = "draw-mini-card";

    if (!cardCode) {
        return element;
    }

    element.classList.add("revealed");

    const suit = cardCode.slice(1, 2);
    if (suit === "H" || suit === "D") {
        element.classList.add("red");
    }

    element.textContent =
        `${rankLabel(cardCode.slice(0, 1))}${suitSymbol(suit)}`;

    return element;
}


function playerStatus(player) {
    if (player.queued_for_next_hand) {
        return "Queued for next hand";
    }

    if (!player.in_hand) {
        return Number(player.stack) > 0 ? "Waiting" : "Busted";
    }

    if (player.folded) {
        return "Folded";
    }

    if (player.all_in) {
        return player.drew ? "All in · drew" : "All in";
    }

    if (player.is_turn) {
        return "Your move";
    }

    if (player.drew) {
        return player.draw_count === 0
            ? "Stood pat"
            : `Drew ${player.draw_count}`;
    }

    return player.last_action
        ? player.last_action.replaceAll("_", " ")
        : "In hand";
}


function createBadge(text, className) {
    const badge = document.createElement("span");
    badge.className = className;
    badge.textContent = text;
    return badge;
}


function createPlayerSeat(player) {
    const seat = document.createElement("article");
    seat.className = "draw-player-seat";

    if (player.is_turn) {
        seat.classList.add("active-turn-seat");
    }

    if (player.folded) {
        seat.classList.add("folded-seat");
    }

    if (player.queued_for_next_hand) {
        seat.classList.add("queued-seat");
    }

    const heading = document.createElement("div");
    heading.className = "draw-seat-heading";

    const name = document.createElement("strong");
    name.textContent = player.username;

    const badges = document.createElement("div");
    badges.className = "poker-badge-row";

    if (player.is_dealer) {
        badges.append(createBadge("D", "dealer-badge"));
    }

    if (player.is_small_blind) {
        badges.append(createBadge("SB", "blind-badge"));
    }

    if (player.is_big_blind) {
        badges.append(createBadge("BB", "blind-badge"));
    }

    if (player.is_host) {
        badges.append(createBadge("Host", "host-badge"));
    }

    if (player.queued_for_next_hand) {
        badges.append(createBadge("Next hand", "queue-badge"));
    }

    heading.append(name, badges);

    const details = document.createElement("div");
    details.className = "draw-seat-details";

    const stack = document.createElement("span");
    stack.textContent = `${formatChips(player.stack)} chips`;

    const status = document.createElement("span");
    status.textContent = playerStatus(player);

    details.append(stack, status);

    const cards = document.createElement("div");
    cards.className = "draw-mini-cards";

    if (player.in_hand) {
        const visibleCards = Array.isArray(player.cards)
            ? player.cards
            : [];

        for (let index = 0; index < 5; index += 1) {
            cards.append(createMiniCard(visibleCards[index]));
        }
    }

    seat.append(heading, details, cards);

    const currentUserIsHost =
        gameState.table.host_id === gameState.you.user_id;

    if (currentUserIsHost && player.user_id !== gameState.you.user_id) {
        const kickButton = document.createElement("button");
        kickButton.type = "button";
        kickButton.className = "draw-kick-button danger-button";
        kickButton.textContent = player.pending_removal
            ? "Removal pending"
            : "Kick";
        kickButton.disabled = requestInProgress || player.pending_removal;
        kickButton.addEventListener("click", () => kickPlayer(player));
        seat.append(kickButton);
    }

    return seat;
}


function renderPlayers() {
    playerGrid.replaceChildren();

    for (const player of gameState.players) {
        playerGrid.append(createPlayerSeat(player));
    }
}


function renderQueue() {
    const queuedPlayers = gameState.players.filter(
        (player) => player.queued_for_next_hand
    );

    joinQueueList.replaceChildren();

    if (queuedPlayers.length === 0) {
        joinQueuePanel.classList.add("hidden");
        return;
    }

    joinQueuePanel.classList.remove("hidden");

    for (const player of queuedPlayers) {
        const chip = document.createElement("div");
        chip.className = "queue-player-chip";
        chip.textContent =
            `${player.username} · ${formatChips(player.stack)} chips`;
        joinQueueList.append(chip);
    }
}


function renderOwnCards() {
    ownCardsElement.replaceChildren();

    const cards = Array.isArray(gameState?.you?.cards)
        ? gameState.you.cards
        : [];

    const selectable = Boolean(
        gameState?.hand?.status === "drawing"
        && gameState.you.is_turn
        && !gameState.you.folded
        && !gameState.you.drew
        && !cardsHidden
    );

    for (let index = 0; index < 5; index += 1) {
        ownCardsElement.append(
            createOwnCard(cards[index], index, selectable)
        );
    }

    hideCardsButton.disabled = cards.length !== 5;
    hideCardsButton.textContent = cardsHidden
        ? "Show cards"
        : "Hide cards";
}


function updateDrawButton() {
    const count = selectedIndexes.size;
    submitDrawButton.textContent = count === 0
        ? "Stand pat"
        : `Draw ${count} replacement${count === 1 ? "" : "s"}`;

    selectionMessage.textContent = count === 0
        ? "Select up to three cards, or stand pat."
        : `${count} card${count === 1 ? "" : "s"} selected for replacement.`;
}


function renderHistory() {
    actionHistory.replaceChildren();

    if (!gameState.actions.length) {
        const item = document.createElement("li");
        item.className = "empty-action-history";
        item.textContent = "No actions yet.";
        actionHistory.append(item);
        return;
    }

    for (const action of gameState.actions) {
        const item = document.createElement("li");
        const name = document.createElement("strong");
        name.textContent = action.username;

        const text = document.createElement("span");
        const readable = action.action.replaceAll("_", " ");

        if (action.action === "draw") {
            text.textContent = `drew ${action.amount}`;
        } else if (action.action === "stand_pat") {
            text.textContent = "stood pat";
        } else {
            text.textContent = Number(action.amount) > 0
                ? `${readable} ${formatChips(action.amount)}`
                : readable;
        }

        item.append(name, text);
        actionHistory.append(item);
    }
}


function configureControls() {
    const { table, hand, you } = gameState;

    waitingControls.classList.add("hidden");
    bettingControls.classList.add("hidden");
    drawControls.classList.add("hidden");
    startHandButton.classList.add("hidden");
    turnMessage.textContent = "";

    if (you.queued_for_next_hand && table.status === "playing") {
        waitingControls.classList.remove("hidden");
        waitingText.textContent =
            "You are queued for the next hand and may watch this one.";
        turnMessage.textContent = "Watching the current hand";
        return;
    }

    if (!hand || hand.status === "complete" || table.status === "waiting") {
        waitingControls.classList.remove("hidden");

        if (you.can_start) {
            startHandButton.classList.remove("hidden");
            waitingText.textContent =
                `${table.active_player_count} players are ready.`;
        } else if (table.active_player_count < 2) {
            waitingText.textContent =
                "At least two players need chips before a hand can start.";
        } else if (table.host_id !== you.user_id) {
            waitingText.textContent = "Waiting for the host to start.";
        } else {
            waitingText.textContent = "The hand cannot currently be started.";
        }

        return;
    }

    if (you.folded) {
        turnMessage.textContent = "You folded. Waiting for the hand to finish.";
        return;
    }

    if (!you.is_turn) {
        turnMessage.textContent = hand.status === "drawing"
            ? "Waiting for another player to draw."
            : "Waiting for another player.";
        return;
    }

    if (hand.status === "drawing") {
        drawControls.classList.remove("hidden");
        turnMessage.textContent = "Your turn to discard or stand pat.";
        updateDrawButton();
        return;
    }

    if (you.all_in) {
        turnMessage.textContent = "You are all in.";
        return;
    }

    bettingControls.classList.remove("hidden");
    turnMessage.textContent = you.can_raise
        ? "Your turn"
        : "Your turn. You may only call or fold.";

    if (Number(you.to_call) > 0) {
        const callAmount = Math.min(
            Number(you.to_call),
            Number(you.stack)
        );

        checkCallButton.textContent = callAmount === Number(you.stack)
            ? `Call all in ${formatChips(callAmount)}`
            : `Call ${formatChips(callAmount)}`;
    } else {
        checkCallButton.textContent = "Check";
    }

    const hasBet = Number(hand.current_bet) > 0;
    betRaiseButton.textContent = hasBet ? "Raise to" : "Bet";

    const minimum = Number(you.minimum_raise_to);
    const maximum = Number(you.maximum_total_bet);

    raiseAmountInput.min = String(Math.min(minimum, maximum));
    raiseAmountInput.max = String(maximum);

    const current = Number(raiseAmountInput.value);
    if (!Number.isFinite(current) || current < minimum || current > maximum) {
        raiseAmountInput.value = String(Math.min(minimum, maximum));
    }

    const allInWouldRaise = maximum > Number(hand.current_bet);

    betRaiseButton.disabled =
        requestInProgress
        || !you.can_raise
        || maximum <= Number(hand.current_bet);

    raiseAmountInput.disabled = requestInProgress || !you.can_raise;

    allInButton.disabled =
        requestInProgress
        || Number(you.stack) <= 0
        || (!you.can_raise && allInWouldRaise);
}


function renderGameState(state) {
    gameState = state;
    showError();

    if (selectedHandId !== state.hand?.id) {
        selectedIndexes.clear();
        selectedHandId = state.hand?.id ?? null;
    }

    if (state.hand?.status !== "drawing" || !state.you.is_turn) {
        selectedIndexes.clear();
    }

    tableNameLabel.textContent = state.table.name;
    tableDescriptionLabel.textContent =
        `Blinds ${formatChips(state.table.small_blind)} / ${formatChips(state.table.big_blind)}`;
    currentUsernameLabel.textContent = state.you.username;
    walletBalanceLabel.textContent = formatChips(state.you.wallet_chips);
    playerCountLabel.textContent =
        `${state.table.seated_player_count}/${state.table.max_players}`;
    streetLabel.textContent = readableStreet(state.hand?.street);
    potLabel.textContent = formatChips(state.hand?.pot ?? 0);
    currentBetLabel.textContent =
        formatChips(state.hand?.current_bet ?? 0);
    winnerMessage.textContent = state.hand?.winner_text ?? "";

    centreMessage.textContent = state.hand
        ? state.hand.status === "drawing"
            ? "Players are replacing cards"
            : readableStreet(state.hand.street)
        : "Waiting for a hand";

    renderQueue();
    renderPlayers();
    renderOwnCards();
    renderHistory();
    configureControls();

    const queuedDuringHand =
        state.table.status === "playing"
        && state.you.queued_for_next_hand;

    const canLeave =
        state.table.status === "waiting"
        || queuedDuringHand;

    leaveGameButton.disabled = requestInProgress || !canLeave;
    leaveGameButton.textContent = queuedDuringHand
        ? "Leave queue"
        : "Leave game";
}


function stateNeedsRepair(state) {
    if (state?.table?.status !== "playing" || !state?.hand) {
        return false;
    }

    const currentSeat = state.hand.current_turn_seat;
    if (currentSeat === null) {
        return true;
    }

    const player = state.players.find(
        (candidate) => candidate.seat_number === currentSeat
    );

    if (!player || !player.in_hand || player.folded) {
        return true;
    }

    if (state.hand.status === "betting") {
        return player.all_in;
    }

    return state.hand.status === "drawing" && player.drew;
}


async function repairTable() {
    if (repairInProgress) {
        return null;
    }

    repairInProgress = true;

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "repair_five_card_draw_table",
            { p_table_id: tableId }
        );

        if (error) {
            throw error;
        }

        if (data?.removed) {
            window.location.href = "poker.html";
            return null;
        }

        return data;
    } finally {
        repairInProgress = false;
    }
}


async function loadGameState() {
    if (!tableId) {
        throw new Error("No Five-Card Draw game ID was supplied.");
    }

    const { data, error } = await window.supabaseClient.rpc(
        "get_five_card_draw_state",
        { p_table_id: tableId }
    );

    if (error) {
        if (error.message?.toLowerCase().includes("not seated")) {
            window.location.href = "poker.html";
            return;
        }

        throw error;
    }

    if (stateNeedsRepair(data)) {
        const repaired = await repairTable();
        if (repaired) {
            renderGameState(repaired);
        }
        return;
    }

    renderGameState(data);
}


async function performBettingAction(action, amount = null) {
    if (requestInProgress) {
        return;
    }

    setRequestInProgress(true);
    showError();

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "play_five_card_draw_action",
            {
                p_table_id: tableId,
                p_action: action,
                p_amount: amount
            }
        );

        if (error) {
            throw error;
        }

        renderGameState(data);
    } catch (error) {
        console.error(error);
        showError(error.message || "The action could not be completed.");
    } finally {
        setRequestInProgress(false);
        if (gameState) {
            configureControls();
        }
    }
}


async function kickPlayer(player) {
    const confirmed = window.confirm(
        player.queued_for_next_hand
            ? `Remove ${player.username} from the next-hand queue?`
            : gameState.table.status === "playing"
                ? `${player.username} will be folded and removed after the hand.`
                : `Remove ${player.username} and return their stack?`
    );

    if (!confirmed) {
        return;
    }

    setRequestInProgress(true);
    showError();

    try {
        const functionName = player.queued_for_next_hand
            ? "kick_queued_poker_player"
            : "kick_five_card_draw_player";

        const { data, error } = await window.supabaseClient.rpc(
            functionName,
            {
                p_table_id: tableId,
                p_user_id: player.user_id
            }
        );

        if (error) {
            throw error;
        }

        if (data && typeof data === "object" && data.table) {
            renderGameState(data);
        } else {
            await loadGameState();
        }
    } catch (error) {
        console.error(error);
        showError(error.message || "The player could not be removed.");
    } finally {
        setRequestInProgress(false);
        if (gameState) {
            configureControls();
        }
    }
}


startHandButton.addEventListener("click", async () => {
    if (requestInProgress) {
        return;
    }

    setRequestInProgress(true);
    showError();

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "start_five_card_draw_hand",
            { p_table_id: tableId }
        );

        if (error) {
            throw error;
        }

        renderGameState(data);
    } catch (error) {
        console.error(error);
        showError(error.message || "The hand could not be started.");
    } finally {
        setRequestInProgress(false);
        if (gameState) {
            configureControls();
        }
    }
});


foldButton.addEventListener("click", () => {
    performBettingAction("fold");
});


checkCallButton.addEventListener("click", () => {
    performBettingAction(
        Number(gameState.you.to_call) > 0 ? "call" : "check"
    );
});


allInButton.addEventListener("click", () => {
    performBettingAction("all_in");
});


betRaiseButton.addEventListener("click", () => {
    const amount = Number.parseInt(raiseAmountInput.value, 10);

    if (!Number.isSafeInteger(amount)) {
        showError("Enter a valid whole-number bet.");
        return;
    }

    performBettingAction(
        Number(gameState.hand.current_bet) > 0 ? "raise" : "bet",
        amount
    );
});


submitDrawButton.addEventListener("click", async () => {
    if (requestInProgress) {
        return;
    }

    setRequestInProgress(true);
    showError();

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "draw_five_card_draw_cards",
            {
                p_table_id: tableId,
                p_card_indexes: [...selectedIndexes].sort((a, b) => a - b)
            }
        );

        if (error) {
            throw error;
        }

        selectedIndexes.clear();
        renderGameState(data);
    } catch (error) {
        console.error(error);
        showError(error.message || "The cards could not be replaced.");
    } finally {
        setRequestInProgress(false);
        if (gameState) {
            configureControls();
        }
    }
});


hideCardsButton.addEventListener("click", () => {
    cardsHidden = !cardsHidden;
    sessionStorage.setItem(
        `draw-cards-hidden-${tableId}`,
        String(cardsHidden)
    );
    renderOwnCards();
});


repairTableButton.addEventListener("click", async () => {
    setRequestInProgress(true);
    showError();

    try {
        const repaired = await repairTable();
        if (repaired) {
            renderGameState(repaired);
        }
    } catch (error) {
        console.error(error);
        showError(error.message || "The game could not be repaired.");
    } finally {
        setRequestInProgress(false);
    }
});


leaveGameButton.addEventListener("click", async () => {
    const leavingQueue =
        gameState?.table?.status === "playing"
        && gameState?.you?.queued_for_next_hand;

    const leavingWaitingGame = gameState?.table?.status === "waiting";

    if (!leavingQueue && !leavingWaitingGame) {
        showError("You cannot leave while participating in an active hand.");
        return;
    }

    const confirmed = window.confirm(
        leavingQueue
            ? "Leave the next-hand queue and return the reserved stack?"
            : "Leave this game and return the table stack to your wallet?"
    );

    if (!confirmed) {
        return;
    }

    setRequestInProgress(true);
    showError();

    try {
        const { error } = await window.supabaseClient.rpc(
            leavingQueue ? "leave_poker_queue" : "leave_poker_table",
            { p_table_id: tableId }
        );

        if (error) {
            throw error;
        }

        window.location.href = "poker.html";
    } catch (error) {
        console.error(error);
        showError(error.message || "The game could not be left.");
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


function subscribeToGame() {
    gameChannel = window.supabaseClient
        .channel(`five-card-draw-${tableId}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "poker_tables",
                filter: `id=eq.${tableId}`
            },
            scheduleRefresh
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "poker_seats",
                filter: `table_id=eq.${tableId}`
            },
            scheduleRefresh
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "draw_hands",
                filter: `table_id=eq.${tableId}`
            },
            scheduleRefresh
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "draw_hand_players",
                filter: `table_id=eq.${tableId}`
            },
            scheduleRefresh
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "draw_actions",
                filter: `table_id=eq.${tableId}`
            },
            scheduleRefresh
        )
        .subscribe();
}


window.addEventListener("beforeunload", () => {
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
        subscribeToGame();
    } catch (error) {
        console.error(error);
        tableNameLabel.textContent = "Five-Card Draw failed to load";
        showError(error.message || "The game could not be loaded.");
    }
}


initialiseGame();
