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

const opponentSeatElement =
    document.querySelector("#opponent-seat");

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

const tableError =
    document.querySelector("#table-error");

const logoutButton =
    document.querySelector("#logout-button");


let gameState = null;
let tableChannel = null;
let refreshTimer = null;
let requestInProgress = false;


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
        leaveMatchButton
    ];

    for (const button of buttons) {
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
    if (rank === "T") {
        return "10";
    }

    return rank;
}


function createPlayingCard(
    cardCode,
    faceDown = false
) {
    const cardElement =
        document.createElement("div");

    cardElement.className = "playing-card";


    if (faceDown || !cardCode) {
        cardElement.classList.add("face-down");
        cardElement.textContent = "♠";

        return cardElement;
    }


    const rank = cardCode.slice(0, 1);
    const suit = cardCode.slice(1, 2);

    const redSuit =
        suit === "H" || suit === "D";


    if (redSuit) {
        cardElement.classList.add("red-card");
    }


    const topCorner =
        document.createElement("span");

    topCorner.className = "card-corner";
    topCorner.textContent =
        `${rankLabel(rank)}${suitSymbol(suit)}`;


    const centreSuit =
        document.createElement("span");

    centreSuit.className = "card-suit";
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
        const card = suppliedCards[index];

        container.append(
            createPlayingCard(
                card,
                !card && faceDownMissing
            )
        );
    }
}


function playerStatusText(player) {
    if (!gameState?.hand) {
        return "Waiting";
    }

    if (player.folded) {
        return "Folded";
    }

    if (player.all_in) {
        return "All in";
    }

    if (
        gameState.hand.current_turn_seat
        === player.seat_number
    ) {
        return "Thinking";
    }

    if (player.last_action) {
        return player.last_action
            .replaceAll("_", " ");
    }

    return "In hand";
}


function renderPlayerSeat(
    container,
    player,
    isOwnPlayer
) {
    container.replaceChildren();


    if (!player) {
        container.className =
            "live-player-seat empty-live-seat";

        container.textContent =
            "Waiting for player";

        return;
    }


    container.className =
        isOwnPlayer
            ? "live-player-seat own-live-seat"
            : "live-player-seat opponent-seat";


    if (
        gameState?.hand?.current_turn_seat
        === player.seat_number
    ) {
        container.classList.add("active-turn-seat");
    }


    if (player.folded) {
        container.classList.add("folded-seat");
    }


    const heading =
        document.createElement("div");

    heading.className = "live-seat-heading";


    const nameGroup =
        document.createElement("div");


    const username =
        document.createElement("strong");

    username.textContent = player.username;


    const userId =
        document.createElement("span");

    userId.className = "user-id";

    userId.textContent =
        `#${shortUserId(player.user_id)}`;


    nameGroup.append(username, userId);


    const badges =
        document.createElement("div");

    badges.className = "poker-badge-row";


    if (player.is_dealer) {
        const dealerBadge =
            document.createElement("span");

        dealerBadge.className = "dealer-badge";
        dealerBadge.textContent = "D";

        badges.append(dealerBadge);
    }


    if (player.is_small_blind) {
        const smallBlindBadge =
            document.createElement("span");

        smallBlindBadge.className = "blind-badge";
        smallBlindBadge.textContent = "SB";

        badges.append(smallBlindBadge);
    }


    if (player.is_big_blind) {
        const bigBlindBadge =
            document.createElement("span");

        bigBlindBadge.className = "blind-badge";
        bigBlindBadge.textContent = "BB";

        badges.append(bigBlindBadge);
    }


    heading.append(nameGroup, badges);


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

    betText.className = "seat-current-bet";

    betText.textContent =
        player.bet_this_street > 0
            ? `Bet: ${formatChips(player.bet_this_street)}`
            : "";


    const cardRow =
        document.createElement("div");

    cardRow.className =
        "playing-card-row miniature-card-row";


    if (isOwnPlayer) {
        renderCardRow(
            cardRow,
            player.hole_cards,
            2,
            false
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

    } else if (gameState?.hand) {
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

        actionHistory.append(emptyItem);

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
            action.action.replaceAll("_", " ");


        actionText.textContent =
            action.amount > 0
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
    const hand = gameState.hand;
    const you = gameState.you;


    waitingControls.classList.add("hidden");
    actionControls.classList.add("hidden");

    startHandButton.classList.add("hidden");

    turnMessage.textContent = "";


    if (
        !hand
        || hand.status === "complete"
        || gameState.table.status === "waiting"
    ) {
        waitingControls.classList.remove("hidden");


        if (you.can_start) {
            startHandButton.classList.remove("hidden");

            waitingText.textContent =
                hand?.status === "complete"
                    ? "The hand is complete. Start the next hand when ready."
                    : "Both players are ready.";

        } else {
            const activePlayers =
                gameState.players.filter(
                    (player) => player.stack > 0
                ).length;


            if (activePlayers < 2) {
                waitingText.textContent =
                    "Waiting for a second player with chips.";

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
            "Waiting for the other player.";

        return;
    }


    actionControls.classList.remove("hidden");

    turnMessage.textContent =
        "Your turn";


    foldButton.disabled = requestInProgress;


    if (you.to_call > 0) {
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


    if (
        !raiseAmountInput.value
        || Number(raiseAmountInput.value)
            < Number(raiseAmountInput.min)

        || Number(raiseAmountInput.value)
            > maximumAmount
    ) {
        raiseAmountInput.value =
            Math.min(
                minimumAmount,
                maximumAmount
            );
    }


    betRaiseButton.disabled =
        requestInProgress
        || maximumAmount <= Number(hand.current_bet);

    allInButton.disabled =
        requestInProgress
        || Number(you.stack) <= 0;
}


function renderGameState(state) {
    gameState = state;


    tableNameLabel.textContent =
        state.table.name;


    tableDescriptionLabel.textContent =
        `Blinds ${formatChips(state.table.small_blind)} / ${formatChips(state.table.big_blind)}`;


    currentUsernameLabel.textContent =
        state.you.username;


    walletBalanceLabel.textContent =
        formatChips(state.you.wallet_chips);


    ownStackLabel.textContent =
        `${formatChips(state.you.stack)} chips`;


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


    renderCardRow(
        ownHoleCardsElement,
        state.you.hole_cards ?? [],
        2,
        Boolean(state.hand)
    );


    const ownPlayer =
        state.players.find(
            (player) =>
                player.user_id
                === state.you.user_id
        );


    const opponent =
        state.players.find(
            (player) =>
                player.user_id
                !== state.you.user_id
        );


    renderPlayerSeat(
        ownSeatElement,
        ownPlayer,
        true
    );


    renderPlayerSeat(
        opponentSeatElement,
        opponent,
        false
    );


    renderActionHistory(
        state.actions
    );


    const canLeave =
        state.table.status === "waiting";


    leaveMatchButton.disabled =
        requestInProgress || !canLeave;


    leaveMatchButton.title =
        canLeave
            ? ""
            : "You cannot leave during an active hand.";


    configureActions();
}


async function loadGameState() {
    if (!tableId) {
        throw new Error(
            "No poker match ID was supplied."
        );
    }


    const {
        data,
        error
    } = await window.supabaseClient.rpc(
        "get_heads_up_poker_state",
        {
            p_table_id: tableId
        }
    );


    if (error) {
        throw error;
    }


    renderGameState(data);
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
            "play_heads_up_action",
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
                "start_heads_up_hand",
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
            Number(gameState.hand.current_bet) > 0
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


leaveMatchButton.addEventListener(
    "click",
    async () => {
        if (
            gameState?.table?.status
            !== "waiting"
        ) {
            showError(
                "You cannot leave during an active hand."
            );

            return;
        }


        const confirmed =
            window.confirm(
                "Leave this match and return your table stack to your wallet?"
            );


        if (!confirmed) {
            return;
        }


        setRequestInProgress(true);
        showError();


        try {
            const {
                error
            } = await window.supabaseClient.rpc(
                "leave_poker_table",
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
    window.clearTimeout(refreshTimer);


    refreshTimer = window.setTimeout(
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
                `heads-up-poker-${tableId}`
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
        const {
            data: {
                user
            }
        } =
            await window.supabaseClient.auth
                .getUser();


        if (!user) {
            window.location.href =
                "login.html";

            return;
        }


        await loadGameState();

        subscribeToGameChanges();

    } catch (error) {
        console.error(error);

        tableNameLabel.textContent =
            "Poker match unavailable";

        showError(
            error.message ||
            "The poker game could not be loaded."
        );
    }
}


initialisePokerGame();