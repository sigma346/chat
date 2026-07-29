const tableId =
    new URLSearchParams(window.location.search).get("id");

const tableNameLabel =
    document.querySelector("#table-name");

const tableDescriptionLabel =
    document.querySelector("#table-description");

const walletBalanceLabel =
    document.querySelector("#wallet-balance");

const tableStackLabel =
    document.querySelector("#table-stack");

const queuePanel =
    document.querySelector("#queue-panel");

const queueList =
    document.querySelector("#queue-list");

const roundStatusLabel =
    document.querySelector("#round-status");

const roundNumberLabel =
    document.querySelector("#round-number");

const betLimitsLabel =
    document.querySelector("#bet-limits");

const dealerCardsElement =
    document.querySelector("#dealer-cards");

const dealerTotalLabel =
    document.querySelector("#dealer-total");

const playerListElement =
    document.querySelector("#blackjack-player-list");

const roundResultElement =
    document.querySelector("#round-result");

const betControls =
    document.querySelector("#bet-controls");

const betInput =
    document.querySelector("#bet-input");

const setBetButton =
    document.querySelector("#set-bet-button");

const clearBetButton =
    document.querySelector("#clear-bet-button");

const actionControls =
    document.querySelector("#action-controls");

const hitButton =
    document.querySelector("#hit-button");

const standButton =
    document.querySelector("#stand-button");

const doubleButton =
    document.querySelector("#double-button");

const startRoundButton =
    document.querySelector("#start-round-button");

const turnMessage =
    document.querySelector("#turn-message");

const leaveGameButton =
    document.querySelector("#leave-game-button");

const blackjackMessage =
    document.querySelector("#blackjack-message");

let state = null;
let gameChannel = null;
let refreshTimer = null;
let requestInProgress = false;


function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}


function showMessage(message = "") {
    blackjackMessage.textContent = message;
}


function setBusy(value) {
    requestInProgress = value;

    const buttons = [
        setBetButton,
        clearBetButton,
        hitButton,
        standButton,
        doubleButton,
        startRoundButton,
        leaveGameButton
    ];

    for (const button of buttons) {
        button.disabled = value;
    }

    for (
        const button
        of document.querySelectorAll(".blackjack-kick-button")
    ) {
        button.disabled = value;
    }

    betInput.disabled = value;
}


function suitSymbol(suit) {
    switch (suit) {
        case "S": return "♠";
        case "H": return "♥";
        case "D": return "♦";
        case "C": return "♣";
        default: return "";
    }
}


function rankLabel(rank) {
    return rank === "T" ? "10" : rank;
}


function createCard(cardCode) {
    const card = document.createElement("div");
    card.className = "blackjack-card";

    if (!cardCode) {
        card.classList.add("face-down");
        card.textContent = "♠";
        return card;
    }

    const rank = cardCode.slice(0, 1);
    const suit = cardCode.slice(1, 2);

    if (suit === "H" || suit === "D") {
        card.classList.add("red-card");
    }

    const corner = document.createElement("span");
    corner.className = "blackjack-card-corner";
    corner.textContent = `${rankLabel(rank)}${suitSymbol(suit)}`;

    const centre = document.createElement("span");
    centre.className = "blackjack-card-centre";
    centre.textContent = suitSymbol(suit);

    card.append(corner, centre);
    return card;
}


function renderCards(container, cards) {
    container.replaceChildren();

    for (const cardCode of cards ?? []) {
        container.append(createCard(cardCode));
    }
}


function playerStatus(player) {
    if (player.queued_for_next_round) {
        return "Queued for next round";
    }

    if (!player.in_round) {
        if (Number(player.selected_bet) > 0) {
            return `Bet ready: ${formatChips(player.selected_bet)}`;
        }

        return Number(player.stack) > 0
            ? "Sitting out"
            : "No chips";
    }

    if (player.result) {
        return player.result;
    }

    if (player.is_turn) {
        return "Playing";
    }

    return player.status ?? "Waiting";
}


function createPlayerCard(player) {
    const card = document.createElement("article");
    card.className = "blackjack-player-card";

    if (player.is_turn) {
        card.classList.add("active-turn");
    }

    if (player.queued_for_next_round) {
        card.classList.add("queued-player");
    }

    const heading = document.createElement("div");
    heading.className = "blackjack-player-heading";

    const nameGroup = document.createElement("div");

    const username = document.createElement("strong");
    username.textContent = player.username;

    const seat = document.createElement("span");
    seat.textContent = `Seat ${player.seat_number}`;

    nameGroup.append(username, seat);

    const badges = document.createElement("div");
    badges.className = "blackjack-badges";

    if (player.is_host) {
        const hostBadge = document.createElement("span");
        hostBadge.textContent = "Host";
        badges.append(hostBadge);
    }

    if (player.queued_for_next_round) {
        const queueBadge = document.createElement("span");
        queueBadge.textContent = "Next round";
        badges.append(queueBadge);
    }

    heading.append(nameGroup, badges);

    const information = document.createElement("div");
    information.className = "blackjack-player-information";

    const stack = document.createElement("span");
    stack.textContent = `${formatChips(player.stack)} chips`;

    const status = document.createElement("span");
    status.textContent = playerStatus(player);

    information.append(stack, status);

    const hand = document.createElement("div");
    hand.className = "blackjack-card-row small";
    renderCards(hand, player.cards ?? []);

    const handInformation = document.createElement("div");
    handInformation.className = "blackjack-hand-information";

    if (player.in_round) {
        handInformation.textContent =
            `Total ${player.total} · Bet ${formatChips(player.bet)}`;
    }

    card.append(
        heading,
        information,
        hand,
        handInformation
    );

    const currentUserIsHost =
        state.table.host_id === state.you.user_id;

    if (currentUserIsHost && player.user_id !== state.you.user_id) {
        const kickButton = document.createElement("button");
        kickButton.type = "button";
        kickButton.className =
            "blackjack-kick-button danger-button";
        kickButton.textContent = player.pending_removal
            ? "Removal pending"
            : "Kick";
        kickButton.disabled =
            requestInProgress || player.pending_removal;

        kickButton.addEventListener("click", () => {
            kickPlayer(player);
        });

        card.append(kickButton);
    }

    return card;
}


function renderQueue(players) {
    const queuedPlayers = players.filter(
        (player) => player.queued_for_next_round
    );

    queueList.replaceChildren();

    if (queuedPlayers.length === 0) {
        queuePanel.classList.add("hidden");
        return;
    }

    queuePanel.classList.remove("hidden");

    for (const player of queuedPlayers) {
        const item = document.createElement("span");
        item.className = "blackjack-queue-chip";
        item.textContent =
            `${player.username} · ${formatChips(player.stack)} chips`;
        queueList.append(item);
    }
}


function configureControls() {
    betControls.classList.add("hidden");
    actionControls.classList.add("hidden");
    startRoundButton.classList.add("hidden");
    turnMessage.textContent = "";

    if (state.you.queued_for_next_round) {
        turnMessage.textContent =
            "You are watching this round and will be active next round.";
        return;
    }

    if (state.table.status === "waiting" && state.you.can_set_bet) {
        betControls.classList.remove("hidden");

        betInput.min = state.table.minimum_bet;
        betInput.max = Math.min(
            Number(state.table.maximum_bet),
            Number(state.you.stack)
        );

        if (
            !betInput.value
            || Number(betInput.value) < Number(betInput.min)
            || Number(betInput.value) > Number(betInput.max)
        ) {
            betInput.value = state.you.selected_bet > 0
                ? state.you.selected_bet
                : Math.min(
                    Number(state.table.maximum_bet),
                    Number(state.you.stack),
                    Number(state.table.minimum_bet)
                );
        }

        turnMessage.textContent = state.you.selected_bet > 0
            ? `Your ${formatChips(state.you.selected_bet)} chip bet is ready.`
            : "Set a bet or sit out this round.";
    }

    if (state.you.can_start) {
        startRoundButton.classList.remove("hidden");
    }

    if (state.you.is_turn) {
        actionControls.classList.remove("hidden");
        turnMessage.textContent = "Your turn";
        doubleButton.disabled =
            requestInProgress || !state.you.can_double;
    } else if (state.table.status === "playing") {
        turnMessage.textContent = "Waiting for the current player.";
    }
}


function renderState(nextState) {
    state = nextState;
    showMessage();

    tableNameLabel.textContent = state.table.name;
    tableDescriptionLabel.textContent =
        `${state.table.max_players} seats · Dealer stands on soft 17 · Blackjack pays 3:2`;

    walletBalanceLabel.textContent =
        formatChips(state.you.wallet_chips);

    tableStackLabel.textContent =
        formatChips(state.you.stack);

    betLimitsLabel.textContent =
        `${formatChips(state.table.minimum_bet)}–${formatChips(state.table.maximum_bet)}`;

    roundStatusLabel.textContent =
        state.table.status === "playing"
            ? "In progress"
            : "Waiting";

    roundNumberLabel.textContent =
        state.round?.round_number ?? 0;

    dealerTotalLabel.textContent =
        state.round?.dealer_total != null
            ? `· ${state.round.dealer_total}`
            : "";

    renderCards(
        dealerCardsElement,
        state.round?.dealer_cards ?? []
    );

    roundResultElement.textContent =
        state.round?.winner_text ?? "";

    playerListElement.replaceChildren();

    for (const player of state.players) {
        playerListElement.append(
            createPlayerCard(player)
        );
    }

    renderQueue(state.players);

    const leavingQueue =
        state.table.status === "playing"
        && state.you.queued_for_next_round;

    const canLeave =
        state.table.status === "waiting"
        || leavingQueue;

    leaveGameButton.disabled =
        requestInProgress || !canLeave;

    leaveGameButton.textContent = leavingQueue
        ? "Leave queue"
        : "Leave game";

    configureControls();
}


async function loadState() {
    if (!tableId) {
        throw new Error("No Blackjack table ID was supplied.");
    }

    const { data, error } = await window.supabaseClient.rpc(
        "get_blackjack_state",
        {
            p_table_id: tableId
        }
    );

    if (error) {
        if (error.message?.toLowerCase().includes("not seated")) {
            window.location.href = "poker.html";
            return;
        }

        throw error;
    }

    renderState(data);
}


async function callStateRpc(functionName, parameters) {
    if (requestInProgress) {
        return;
    }

    setBusy(true);
    showMessage();

    try {
        const { data, error } = await window.supabaseClient.rpc(
            functionName,
            parameters
        );

        if (error) {
            throw error;
        }

        renderState(data);
    } catch (error) {
        console.error(error);
        showMessage(
            error.message || "The Blackjack action failed."
        );
    } finally {
        setBusy(false);

        if (state) {
            configureControls();
        }
    }
}


setBetButton.addEventListener("click", () => {
    const bet = Number.parseInt(betInput.value, 10);

    if (!Number.isSafeInteger(bet)) {
        showMessage("Enter a valid whole-number bet.");
        return;
    }

    callStateRpc(
        "set_blackjack_bet",
        {
            p_table_id: tableId,
            p_bet: bet
        }
    );
});


clearBetButton.addEventListener("click", () => {
    callStateRpc(
        "set_blackjack_bet",
        {
            p_table_id: tableId,
            p_bet: 0
        }
    );
});


startRoundButton.addEventListener("click", () => {
    callStateRpc(
        "start_blackjack_round",
        {
            p_table_id: tableId
        }
    );
});


hitButton.addEventListener("click", () => {
    callStateRpc(
        "play_blackjack_action",
        {
            p_table_id: tableId,
            p_action: "hit"
        }
    );
});


standButton.addEventListener("click", () => {
    callStateRpc(
        "play_blackjack_action",
        {
            p_table_id: tableId,
            p_action: "stand"
        }
    );
});


doubleButton.addEventListener("click", () => {
    callStateRpc(
        "play_blackjack_action",
        {
            p_table_id: tableId,
            p_action: "double"
        }
    );
});


async function kickPlayer(player) {
    const confirmed = window.confirm(
        state.table.status === "playing" && player.in_round
            ? `${player.username} will forfeit this round and be removed afterwards.`
            : `${player.username} will be removed and their remaining stack returned to their wallet.`
    );

    if (!confirmed) {
        return;
    }

    callStateRpc(
        "kick_blackjack_player",
        {
            p_table_id: tableId,
            p_user_id: player.user_id
        }
    );
}


leaveGameButton.addEventListener("click", async () => {
    const leavingQueue =
        state?.table?.status === "playing"
        && state?.you?.queued_for_next_round;

    const leavingWaitingGame =
        state?.table?.status === "waiting";

    if (!leavingQueue && !leavingWaitingGame) {
        showMessage("You cannot leave during an active round.");
        return;
    }

    const confirmed = window.confirm(
        leavingQueue
            ? "Leave the next-round queue and return your reserved stack to your wallet?"
            : "Leave this Blackjack game and return your table stack to your wallet?"
    );

    if (!confirmed) {
        return;
    }

    setBusy(true);
    showMessage();

    try {
        const { error } = await window.supabaseClient.rpc(
            leavingQueue
                ? "leave_poker_queue"
                : "leave_poker_table",
            {
                p_table_id: tableId
            }
        );

        if (error) {
            throw error;
        }

        window.location.href = "poker.html";
    } catch (error) {
        console.error(error);
        showMessage(
            error.message || "The Blackjack game could not be left."
        );
        setBusy(false);
    }
});


function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(async () => {
        if (requestInProgress) {
            return;
        }

        try {
            await loadState();
        } catch (error) {
            console.error(error);
            showMessage(error.message || "The game could not refresh.");
        }
    }, 130);
}


function subscribeToGame() {
    gameChannel = window.supabaseClient
        .channel(`blackjack-${tableId}`)
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
                table: "blackjack_rounds",
                filter: `table_id=eq.${tableId}`
            },
            scheduleRefresh
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "blackjack_round_players",
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


async function initialiseBlackjack() {
    try {
        const {
            data: { user },
            error
        } = await window.supabaseClient.auth.getUser();

        if (error || !user) {
            window.location.href = "login.html";
            return;
        }

        await loadState();
        subscribeToGame();
    } catch (error) {
        console.error(error);
        tableNameLabel.textContent = "Blackjack failed to load";
        showMessage(
            error.message || "The Blackjack table could not be loaded."
        );
    }
}


initialiseBlackjack();
