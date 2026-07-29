const tableId =
    new URLSearchParams(window.location.search)
        .get("id");


const tableNameLabel =
    document.querySelector("#table-name");

const tableDescriptionLabel =
    document.querySelector("#table-description");

const currentUsernameLabel =
    document.querySelector("#current-username");

const walletBalanceLabel =
    document.querySelector("#wallet-balance");

const playerCountLabel =
    document.querySelector("#player-count-label");

const joinQueuePanel =
    document.querySelector("#join-queue-panel");

const joinQueueList =
    document.querySelector("#join-queue-list");

const streetLabel =
    document.querySelector("#street-label");

const potLabel =
    document.querySelector("#pot-label");

const currentBetLabel =
    document.querySelector("#current-bet-label");

const communityCardsElement =
    document.querySelector("#community-cards");

const ownHoleCardsElement =
    document.querySelector("#own-hole-cards");

const hideCardsButton =
    document.querySelector("#hide-cards-button");

const opponentSeatsElement =
    document.querySelector("#opponent-seats");

const ownSeatElement =
    document.querySelector("#own-seat");

const ownStackLabel =
    document.querySelector("#own-stack-label");

const winnerMessage =
    document.querySelector("#winner-message");

const waitingControls =
    document.querySelector("#waiting-controls");

const waitingText =
    document.querySelector("#waiting-text");

const startHandButton =
    document.querySelector("#start-hand-button");

const actionControls =
    document.querySelector("#action-controls");

const foldButton =
    document.querySelector("#fold-button");

const checkCallButton =
    document.querySelector("#check-call-button");

const allInButton =
    document.querySelector("#all-in-button");

const raiseAmountInput =
    document.querySelector("#raise-amount-input");

const betRaiseButton =
    document.querySelector("#bet-raise-button");

const turnMessage =
    document.querySelector("#turn-message");

const actionHistory =
    document.querySelector("#action-history");

const leaveMatchButton =
    document.querySelector("#leave-match-button");

const repairTableButton =
    document.querySelector("#repair-table-button");

const tableError =
    document.querySelector("#table-error");

const logoutButton =
    document.querySelector("#logout-button");


let gameState = null;
let tableChannel = null;
let refreshTimer = null;
let requestInProgress = false;
let repairInProgress = false;

let cardsHidden =
    sessionStorage.getItem(
        `poker-cards-hidden-${tableId}`
    ) === "true";

function formatChips(value) {
    return new Intl.NumberFormat("en-GB").format(
        Number(value ?? 0)
    );
}


function shortUserId(userId) {
    return userId
        .replaceAll("-", "")
        .slice(0, 6)
        .toUpperCase();
}


function showError(message = "") {
    tableError.textContent = message;
}


function setRequestInProgress(value) {
    requestInProgress = value;

    const buttons = [
        startHandButton,
        foldButton,
        checkCallButton,
        allInButton,
        betRaiseButton,
        leaveMatchButton,
        repairTableButton
    ];


    for (const button of buttons) {
        button.disabled = value;
    }


    for (
        const button
        of document.querySelectorAll(
            ".kick-player-button"
        )
    ) {
        button.disabled = value;
    }


    raiseAmountInput.disabled = value;
}

function suitSymbol(suit) {
    switch (suit) {
        case "S":
            return "♠";

        case "H":
            return "♥";

        case "D":
            return "♦";

        case "C":
            return "♣";

        default:
            return "";
    }
}


function rankLabel(rank) {
    return rank === "T"
        ? "10"
        : rank;
}


function createPlayingCard(
    cardCode,
    faceDown = false
) {
    const cardElement =
        document.createElement("div");

    cardElement.className =
        "playing-card";


    if (!cardCode && !faceDown) {
        cardElement.classList.add(
            "card-placeholder"
        );

        return cardElement;
    }


    if (faceDown) {
        cardElement.classList.add(
            "face-down"
        );

        cardElement.textContent = "♠";

        return cardElement;
    }


    const rank =
        cardCode.slice(0, 1);

    const suit =
        cardCode.slice(1, 2);


    if (suit === "H" || suit === "D") {
        cardElement.classList.add(
            "red-card"
        );
    }


    const topCorner =
        document.createElement("span");

    topCorner.className =
        "card-corner";

    topCorner.textContent =
        `${rankLabel(rank)}${suitSymbol(suit)}`;


    const centreSuit =
        document.createElement("span");

    centreSuit.className =
        "card-suit";

    centreSuit.textContent =
        suitSymbol(suit);


    cardElement.append(
        topCorner,
        centreSuit
    );

    return cardElement;
}


function renderCardRow(
    container,
    cards,
    totalCards,
    faceDownMissing = false
) {
    container.replaceChildren();

    const suppliedCards =
        Array.isArray(cards)
            ? cards
            : [];


    for (
        let index = 0;
        index < totalCards;
        index += 1
    ) {
        const card =
            suppliedCards[index];

        container.append(
            createPlayingCard(
                card,
                !card && faceDownMissing
            )
        );
    }
}


function playerStatusText(player) {
    if (player.queued_for_next_hand) {
        return "Queued for next hand";
    }

    if (!player.in_hand) {
        return Number(player.stack) > 0
            ? "Waiting"
            : "Busted";
    }


    if (player.folded) {
        return "Folded";
    }


    if (player.all_in) {
        return "All in";
    }


    if (player.is_turn) {
        return "Thinking";
    }


    if (player.last_action) {
        return player.last_action
            .replaceAll("_", " ");
    }


    return "In hand";
}


function createPlayerSeat(
    player,
    isOwnPlayer
) {
    const container =
        document.createElement("article");

    container.className =
        isOwnPlayer
            ? "live-player-seat own-live-seat"
            : "live-player-seat opponent-seat";


    if (player.is_turn) {
        container.classList.add(
            "active-turn-seat"
        );
    }


    if (player.folded) {
        container.classList.add(
            "folded-seat"
        );
    }


    if (!player.in_hand) {
        container.classList.add(
            "waiting-seat"
        );
    }

    if (player.queued_for_next_hand) {
        container.classList.add(
            "queued-seat"
        );
    }


    const heading =
        document.createElement("div");

    heading.className =
        "live-seat-heading";


    const nameGroup =
        document.createElement("div");


    const username =
        document.createElement("strong");

    username.textContent =
        player.username;


    const userId =
        document.createElement("span");

    userId.className =
        "user-id";

    userId.textContent =
        `#${shortUserId(player.user_id)}`;


    nameGroup.append(
        username,
        userId
    );


    const badges =
        document.createElement("div");

    badges.className =
        "poker-badge-row";


    if (player.is_dealer) {
        const dealerBadge =
            document.createElement("span");

        dealerBadge.className =
            "dealer-badge";

        dealerBadge.textContent = "D";

        badges.append(dealerBadge);
    }


    if (player.is_small_blind) {
        const smallBlindBadge =
            document.createElement("span");

        smallBlindBadge.className =
            "blind-badge";

        smallBlindBadge.textContent =
            "SB";

        badges.append(
            smallBlindBadge
        );
    }


    if (player.is_big_blind) {
        const bigBlindBadge =
            document.createElement("span");

        bigBlindBadge.className =
            "blind-badge";

        bigBlindBadge.textContent =
            "BB";

        badges.append(
            bigBlindBadge
        );
    }


    if (player.is_host) {
        const hostBadge =
            document.createElement("span");

        hostBadge.className =
            "host-badge";

        hostBadge.textContent =
            "Host";

        badges.append(hostBadge);
    }

    if (player.queued_for_next_hand) {
        const queueBadge =
            document.createElement("span");

        queueBadge.className =
            "queue-badge";

        queueBadge.textContent =
            "Next hand";

        badges.append(queueBadge);
    }


    heading.append(
        nameGroup,
        badges
    );


    const information =
        document.createElement("div");

    information.className =
        "live-seat-information";


    const stackText =
        document.createElement("span");

    stackText.textContent =
        `${formatChips(player.stack)} chips`;


    const statusText =
        document.createElement("span");

    statusText.textContent =
        playerStatusText(player);


    information.append(
        stackText,
        statusText
    );


    const betText =
        document.createElement("span");

    betText.className =
        "seat-current-bet";

    betText.textContent =
        Number(player.bet_this_street) > 0
            ? `Bet: ${formatChips(player.bet_this_street)}`
            : "";


    const cardRow =
        document.createElement("div");

    cardRow.className =
        "playing-card-row miniature-card-row";


    if (
        isOwnPlayer
        && cardsHidden
        && player.in_hand
    ) {
        renderCardRow(
            cardRow,
            [],
            2,
            true
        );

    } else if (
        Array.isArray(player.hole_cards)
    ) {
        renderCardRow(
            cardRow,
            player.hole_cards,
            2,
            false
        );

    } else if (player.in_hand) {
        renderCardRow(
            cardRow,
            [],
            2,
            true
        );
    }


    container.append(
        heading,
        information,
        betText,
        cardRow
    );


    const currentUserIsHost =
        gameState.table.host_id
        === gameState.you.user_id;


    if (
        currentUserIsHost
        && !isOwnPlayer
    ) {
        const kickButton =
            document.createElement("button");

        kickButton.type = "button";

        kickButton.className =
            "kick-player-button danger-button";

        kickButton.textContent =
            player.last_action === "kicked"
                ? "Removal pending"
                : "Kick";


        kickButton.disabled =
            requestInProgress
            || player.last_action === "kicked";


        kickButton.addEventListener(
            "click",
            () => {
                kickPlayer(player);
            }
        );


        container.append(kickButton);
    }


    return container;
}

function renderSeats(players) {
    opponentSeatsElement.replaceChildren();
    ownSeatElement.replaceChildren();


    const ownPlayer =
        players.find(
            (player) =>
                player.user_id
                === gameState.you.user_id
        );


    const opponents =
        players.filter(
            (player) =>
                player.user_id
                !== gameState.you.user_id
        );


    for (const opponent of opponents) {
        opponentSeatsElement.append(
            createPlayerSeat(
                opponent,
                false
            )
        );
    }


    if (opponents.length === 0) {
        const emptySeat =
            document.createElement("article");

        emptySeat.className =
            "live-player-seat empty-live-seat";

        emptySeat.textContent =
            "Waiting for more players";

        opponentSeatsElement.append(
            emptySeat
        );
    }


    if (!ownPlayer) {
        ownSeatElement.className =
            "live-player-seat own-live-seat empty-live-seat";

        ownSeatElement.textContent =
            "Your seat is unavailable";

        return;
    }


    const renderedOwnSeat =
        createPlayerSeat(
            ownPlayer,
            true
        );


    ownSeatElement.className =
        renderedOwnSeat.className;


    for (
        const child
        of [...renderedOwnSeat.childNodes]
    ) {
        ownSeatElement.append(child);
    }
}


function renderActionHistory(actions) {
    actionHistory.replaceChildren();


    if (!actions || actions.length === 0) {
        const emptyItem =
            document.createElement("li");

        emptyItem.className =
            "empty-action-history";

        emptyItem.textContent =
            "No actions yet.";

        actionHistory.append(
            emptyItem
        );

        return;
    }


    for (const action of actions) {
        const item =
            document.createElement("li");


        const playerName =
            document.createElement("strong");

        playerName.textContent =
            action.username;


        const actionText =
            document.createElement("span");

        const readableAction =
            action.action.replaceAll(
                "_",
                " "
            );


        actionText.textContent =
            Number(action.amount) > 0
                ? `${readableAction} ${formatChips(action.amount)}`
                : readableAction;


        item.append(
            playerName,
            actionText
        );

        actionHistory.append(item);
    }
}


function configureActions() {
    const hand =
        gameState.hand;

    const you =
        gameState.you;


    waitingControls.classList.add(
        "hidden"
    );

    actionControls.classList.add(
        "hidden"
    );

    startHandButton.classList.add(
        "hidden"
    );

    turnMessage.textContent = "";

    /*
        A queued player can watch the active hand but cannot
        perform actions until the following hand starts.
    */

    if (
        you.queued_for_next_hand
        && gameState.table.status === "playing"
    ) {
        waitingControls.classList.remove(
            "hidden"
        );

        waitingText.textContent =
            "You are queued for the next hand. Your reserved table stack is ready.";

        turnMessage.textContent =
            "Watching the current hand";

        return;
    }


    if (
        !hand
        || hand.status === "complete"
        || gameState.table.status === "waiting"
    ) {
        waitingControls.classList.remove(
            "hidden"
        );


        if (you.can_start) {
            startHandButton.classList.remove(
                "hidden"
            );

            waitingText.textContent =
                hand?.status === "complete"
                    ? "The hand is complete. Start the next hand when everyone is ready."
                    : `${gameState.table.active_player_count} players are ready.`;

        } else if (
            gameState.table.active_player_count < 2
        ) {
            waitingText.textContent =
                "At least two players need chips before a hand can start.";

        } else if (
            gameState.table.host_id
            !== you.user_id
        ) {
            waitingText.textContent =
                "Waiting for the host to start the hand.";

        } else {
            waitingText.textContent =
                "The hand cannot currently be started.";
        }

        return;
    }


    if (you.folded) {
        turnMessage.textContent =
            "You folded. Waiting for the hand to finish.";

        return;
    }


    if (you.all_in) {
        turnMessage.textContent =
            "You are all in.";

        return;
    }


    if (!you.is_turn) {
        turnMessage.textContent =
            "Waiting for another player.";

        return;
    }


    actionControls.classList.remove(
        "hidden"
    );


    turnMessage.textContent =
        you.can_raise
            ? "Your turn"
            : "Your turn. Betting was not fully reopened, so you may only call or fold.";


    if (Number(you.to_call) > 0) {
        const actualCallAmount =
            Math.min(
                Number(you.to_call),
                Number(you.stack)
            );

        checkCallButton.textContent =
            actualCallAmount
                === Number(you.stack)
                ? `Call all in ${formatChips(actualCallAmount)}`
                : `Call ${formatChips(actualCallAmount)}`;
    } else {
        checkCallButton.textContent =
            "Check";
    }


    const handHasBet =
        Number(hand.current_bet) > 0;


    betRaiseButton.textContent =
        handHasBet
            ? "Raise to"
            : "Bet";


    const minimumAmount =
        Number(you.minimum_raise_to);

    const maximumAmount =
        Number(you.maximum_total_bet);


    raiseAmountInput.min =
        Math.min(
            minimumAmount,
            maximumAmount
        );

    raiseAmountInput.max =
        maximumAmount;


    const currentInputValue =
        Number(
            raiseAmountInput.value
        );


    if (
        !Number.isFinite(currentInputValue)
        || currentInputValue <
            Number(raiseAmountInput.min)
        || currentInputValue >
            maximumAmount
    ) {
        raiseAmountInput.value =
            Math.min(
                minimumAmount,
                maximumAmount
            );
    }


    const allInWouldRaise =
        maximumAmount >
        Number(hand.current_bet);


    betRaiseButton.disabled =
        requestInProgress
        || !you.can_raise
        || maximumAmount <=
            Number(hand.current_bet);


    raiseAmountInput.disabled =
        requestInProgress
        || !you.can_raise;


    allInButton.disabled =
        requestInProgress
        || Number(you.stack) <= 0
        || (
            !you.can_raise
            && allInWouldRaise
        );
}


function renderJoinQueue(state) {
    const queuedPlayers =
        state.players.filter(
            (player) =>
                player.queued_for_next_hand
        );


    joinQueueList.replaceChildren();


    if (queuedPlayers.length === 0) {
        joinQueuePanel.classList.add(
            "hidden"
        );

        return;
    }


    joinQueuePanel.classList.remove(
        "hidden"
    );


    for (const player of queuedPlayers) {
        const queuePlayer =
            document.createElement("div");

        queuePlayer.className =
            "queue-player-chip";


        const name =
            document.createElement("strong");

        name.textContent =
            player.username;


        const playerId =
            document.createElement("span");

        playerId.className =
            "user-id";

        playerId.textContent =
            `#${shortUserId(player.user_id)}`;


        const stack =
            document.createElement("span");

        stack.className =
            "queue-player-stack";

        stack.textContent =
            `${formatChips(player.stack)} chips`;


        queuePlayer.append(
            name,
            playerId,
            stack
        );


        joinQueueList.append(
            queuePlayer
        );
    }
}

function renderGameState(state) {
    gameState = state;

    renderJoinQueue(state);


    tableNameLabel.textContent =
        state.table.name;


    tableDescriptionLabel.textContent =
        `Blinds ${formatChips(state.table.small_blind)} / ${formatChips(state.table.big_blind)}`;


    currentUsernameLabel.textContent =
        state.you.username;


    walletBalanceLabel.textContent =
        formatChips(
            state.you.wallet_chips
        );


    ownStackLabel.textContent =
        `${formatChips(state.you.stack)} chips`;


    playerCountLabel.textContent =
        `${state.table.seated_player_count}/${state.table.max_players}`;


    streetLabel.textContent =
        state.hand
            ? state.hand.street
            : "waiting";


    potLabel.textContent =
        formatChips(
            state.hand?.pot ?? 0
        );


    currentBetLabel.textContent =
        formatChips(
            state.hand?.current_bet ?? 0
        );


    winnerMessage.textContent =
        state.hand?.winner_text ?? "";


    renderCardRow(
        communityCardsElement,
        state.hand?.community_cards ?? [],
        5,
        false
    );


    const ownCards =
        state.you.hole_cards ?? [];


    if (
        cardsHidden
        && ownCards.length > 0
    ) {
        renderCardRow(
            ownHoleCardsElement,
            [],
            2,
            true
        );
    } else {
        renderCardRow(
            ownHoleCardsElement,
            ownCards,
            2,
            Boolean(state.hand)
        );
    }


    updateHideCardsButton();


    renderSeats(
        state.players
    );


    renderActionHistory(
        state.actions
    );


    const isQueuedDuringHand =
        state.table.status === "playing"
        && state.you.queued_for_next_hand;


    const canLeave =
        state.table.status === "waiting"
        || isQueuedDuringHand;


    leaveMatchButton.disabled =
        requestInProgress || !canLeave;


    leaveMatchButton.textContent =
        isQueuedDuringHand
            ? "Leave queue"
            : "Leave match";


    leaveMatchButton.title =
        canLeave
            ? ""

            : "You cannot leave while participating in an active hand.";


    configureActions();
}




async function repairPokerTable() {
    if (repairInProgress) {
        return null;
    }

    repairInProgress = true;

    try {
        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "repair_poker_table",
            {
                p_table_id: tableId
            }
        );

        if (error) {
            throw error;
        }

        /*
            The current player may have been kicked or
            removed during the repair.
        */

        if (data?.removed) {
            window.location.href = "poker.html";
            return null;
        }

        return data;
    } finally {
        repairInProgress = false;
    }
}

function updateHideCardsButton() {
    const hasCards =
        Array.isArray(
            gameState?.you?.hole_cards
        )

        && gameState.you.hole_cards.length > 0;


    hideCardsButton.disabled =
        !hasCards;


    hideCardsButton.textContent =
        cardsHidden
            ? "Show cards"
            : "Hide cards";
}


function pokerStateNeedsRepair(state) {
    if (
        state?.table?.status !== "playing"
        || state?.hand?.status !== "betting"
    ) {
        return false;
    }


    const currentTurnSeat =
        state.hand.current_turn_seat;


    if (currentTurnSeat === null) {
        return true;
    }


    const currentPlayer =
        state.players.find(
            (player) =>
                player.seat_number
                === currentTurnSeat
        );


    return (
        !currentPlayer
        || !currentPlayer.in_hand
        || currentPlayer.folded
        || currentPlayer.all_in
    );
}


async function repairPokerTable() {
    if (repairInProgress) {
        return null;
    }


    repairInProgress = true;


    try {
        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "repair_poker_table",
            {
                p_table_id: tableId
            }
        );


        if (error) {
            throw error;
        }


        if (data?.removed) {
            window.location.href =
                "poker.html";

            return null;
        }


        return data;

    } finally {
        repairInProgress = false;
    }
}


async function kickPlayer(player) {


    const playerIsQueued =
    player.queued_for_next_hand;


    const handIsActive =
        gameState.table.status === "playing";


    const confirmationMessage =
        playerIsQueued
            ? `${player.username} will be removed from the next-hand queue and their reserved stack will return to their wallet.`

            : handIsActive
                ? `${player.username} will be folded immediately and removed after this hand.`

                : `${player.username} will be removed and their table stack returned to their wallet.`;


    const confirmed =
        window.confirm(
            confirmationMessage
        );


    if (!confirmed) {
        return;
    }


    setRequestInProgress(true);
    showError();


    try {
        const rpcFunction =
            playerIsQueued
                ? "kick_queued_poker_player"
                : "kick_poker_player";


        const {
            error
        } = await window.supabaseClient.rpc(
            rpcFunction,
            {
                p_table_id: tableId,
                p_user_id: player.user_id
            }
        );


        if (error) {
            throw error;
        }


        /*
            Load a fresh player-specific state instead of relying
            on two RPC functions with different return formats.
        */

        await loadGameState();


        if (error) {
            throw error;
        }


        // renderGameState(data);

    } catch (error) {
        console.error(error);

        showError(
            error.message ||
            "The player could not be kicked."
        );

    } finally {
        setRequestInProgress(false);

        if (gameState) {
            configureActions();
        }
    }
}

async function loadGameState() {
    if (!tableId) {
        throw new Error(
            "No poker match ID was supplied."
        );
    }


    const [
        gameStateResult,
        seatQueueResult
    ] = await Promise.all([
        window.supabaseClient.rpc(
            "get_poker_state",
            {
                p_table_id: tableId
            }
        ),

        window.supabaseClient
            .from("poker_seats")
            .select(
                "user_id, queued_for_next_hand"
            )
            .eq("table_id", tableId)
    ]);


    if (gameStateResult.error) {
        if (
            gameStateResult.error.message
                ?.toLowerCase()
                .includes("not seated")
        ) {
            window.location.href =
                "poker.html";

            return;
        }

        throw gameStateResult.error;
    }


    if (seatQueueResult.error) {
        throw seatQueueResult.error;
    }


    const state =
        gameStateResult.data;


    const queuedUserIds =
        new Set(
            seatQueueResult.data

                .filter(
                    (seat) =>
                        seat.queued_for_next_hand
                )

                .map(
                    (seat) =>
                        seat.user_id
                )
        );


    state.players =
        state.players.map(
            (player) => ({
                ...player,

                queued_for_next_hand:
                    queuedUserIds.has(
                        player.user_id
                    )
            })
        );


    state.you.queued_for_next_hand =
        queuedUserIds.has(
            state.you.user_id
        );


    if (pokerStateNeedsRepair(state)) {
        const repairedState =
            await repairPokerTable();


        if (repairedState) {
            /*
                Reload once more so the repaired state also
                receives current queue information.
            */

            window.setTimeout(
                loadGameState,
                50
            );
        }

        return;
    }


    renderGameState(state);
}

async function performPokerAction(
    action,
    amount = null
) {
    if (requestInProgress) {
        return;
    }


    setRequestInProgress(true);
    showError();


    try {
        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "play_poker_action",
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

        showError(
            error.message ||
            "The poker action could not be completed."
        );

    } finally {
        setRequestInProgress(false);

        if (gameState) {
            configureActions();
        }
    }
}


startHandButton.addEventListener(
    "click",
    async () => {
        if (requestInProgress) {
            return;
        }


        setRequestInProgress(true);
        showError();


        try {
            const {
                data,
                error
            } = await window.supabaseClient.rpc(
                "start_poker_hand",
                {
                    p_table_id: tableId
                }
            );


            if (error) {
                throw error;
            }


            renderGameState(data);

        } catch (error) {
            console.error(error);

            showError(
                error.message ||
                "The hand could not be started."
            );

        } finally {
            setRequestInProgress(false);

            if (gameState) {
                configureActions();
            }
        }
    }
);


foldButton.addEventListener(
    "click",
    () => {
        performPokerAction("fold");
    }
);


checkCallButton.addEventListener(
    "click",
    () => {
        const action =
            Number(gameState.you.to_call) > 0
                ? "call"
                : "check";

        performPokerAction(action);
    }
);


betRaiseButton.addEventListener(
    "click",
    () => {
        const amount =
            Number.parseInt(
                raiseAmountInput.value,
                10
            );


        if (!Number.isSafeInteger(amount)) {
            showError(
                "Enter a valid whole-number bet."
            );

            return;
        }


        const action =
            Number(
                gameState.hand.current_bet
            ) > 0
                ? "raise"
                : "bet";


        performPokerAction(
            action,
            amount
        );
    }
);


allInButton.addEventListener(
    "click",
    () => {
        performPokerAction("all_in");
    }
);

hideCardsButton.addEventListener(
    "click",
    () => {
        cardsHidden =
            !cardsHidden;


        sessionStorage.setItem(
            `poker-cards-hidden-${tableId}`,
            String(cardsHidden)
        );


        if (gameState) {
            renderGameState(
                gameState
            );
        }
    }
);


repairTableButton.addEventListener(
    "click",
    async () => {
        setRequestInProgress(true);
        showError();


        try {
            const repairedState =
                await repairPokerTable();


            if (repairedState) {
                renderGameState(
                    repairedState
                );
            }

        } catch (error) {
            console.error(error);

            showError(
                error.message ||
                "The poker table could not be repaired."
            );

        } finally {
            setRequestInProgress(false);

            if (gameState) {
                configureActions();
            }
        }
    }
);

leaveMatchButton.addEventListener(
    "click",
    async () => {
        const leavingQueue =
            gameState?.table?.status === "playing"
            && gameState?.you?.queued_for_next_hand;


        const leavingWaitingTable =
            gameState?.table?.status === "waiting";


        if (
            !leavingQueue
            && !leavingWaitingTable
        ) {
            showError(
                "You cannot leave while participating in an active hand."
            );

            return;
        }


        const confirmationText =
            leavingQueue
                ? "Leave the next-hand queue and return your reserved table stack to your wallet?"

                : "Leave this match and return your table stack to your wallet?";


        const confirmed =
            window.confirm(
                confirmationText
            );


        if (!confirmed) {
            return;
        }


        setRequestInProgress(true);
        showError();


        try {
            const rpcFunction =
                leavingQueue
                    ? "leave_poker_queue"
                    : "leave_poker_table";


            const {
                error
            } = await window.supabaseClient.rpc(
                rpcFunction,
                {
                    p_table_id: tableId
                }
            );


            if (error) {
                throw error;
            }


            window.location.href =
                "poker.html";

        } catch (error) {
            console.error(error);

            showError(
                error.message ||
                "The poker match could not be left."
            );

            setRequestInProgress(false);
        }
    }
);


logoutButton.addEventListener(
    "click",
    async () => {
        await window.supabaseClient.auth.signOut({
            scope: "local"
        });

        window.location.href =
            "login.html";
    }
);


function scheduleRefresh() {
    window.clearTimeout(
        refreshTimer
    );


    refreshTimer =
        window.setTimeout(
            async () => {
                if (requestInProgress) {
                    return;
                }

                try {
                    await loadGameState();
                } catch (error) {
                    console.error(error);
                }
            },
            120
        );
}


function subscribeToGameChanges() {
    tableChannel =
        window.supabaseClient
            .channel(
                `multiplayer-poker-${tableId}`
            )

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
                    table: "poker_hands",
                    filter: `table_id=eq.${tableId}`
                },
                scheduleRefresh
            )

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "poker_hand_players",
                    filter: `table_id=eq.${tableId}`
                },
                scheduleRefresh
            )

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "poker_actions",
                    filter: `table_id=eq.${tableId}`
                },
                scheduleRefresh
            )

            .subscribe();
}


window.addEventListener(
    "beforeunload",
    () => {
        if (tableChannel) {
            window.supabaseClient.removeChannel(
                tableChannel
            );
        }
    }
);


async function initialisePokerGame() {
    try {
        showError("");

        const {
            data: {
                user
            },
            error: userError
        } =
            await window.supabaseClient.auth
                .getUser();

        if (userError) {
            throw userError;
        }

        if (!user) {
            window.location.href =
                "login.html";

            return;
        }

        await loadGameState();

        subscribeToGameChanges();

    } catch (error) {
        console.error(
            "Poker initialization failed:",
            error
        );

        tableNameLabel.textContent =
            "Match failed to load";

        tableDescriptionLabel.textContent =
            "The poker page encountered an error.";

        showError(
            error.message ||
            "The poker game could not be loaded."
        );
    }
}


initialisePokerGame();