const tableId =
    new URLSearchParams(window.location.search).get("id");

const tableNameLabel =
    document.querySelector("#table-name");

const tableDescription =
    document.querySelector("#table-description");

const currentUsernameLabel =
    document.querySelector("#current-username");

const walletBalanceLabel =
    document.querySelector("#wallet-balance");

const playerCountLabel =
    document.querySelector("#player-count-label");

const entryStakeLabel =
    document.querySelector("#entry-stake-label");

const stockCountLabel =
    document.querySelector("#stock-count-label");

const potLabel =
    document.querySelector("#pot-label");

const playRuleLabel =
    document.querySelector("#play-rule-label");

const stockDisplayCount =
    document.querySelector("#stock-display-count");

const pileDisplay =
    document.querySelector("#pile-display");

const pileDisplayCount =
    document.querySelector("#pile-display-count");

const playerGrid =
    document.querySelector("#shithead-player-grid");

const turnDescription =
    document.querySelector("#turn-description");

const turnDetail =
    document.querySelector("#turn-detail");

const winnerMessage =
    document.querySelector("#winner-message");

const ownAreaTitle =
    document.querySelector("#own-area-title");

const sourceBadge =
    document.querySelector("#source-badge");

const ownHand =
    document.querySelector("#own-hand");

const ownFaceUp =
    document.querySelector("#own-face-up");

const ownFaceDown =
    document.querySelector("#own-face-down");

const waitingControls =
    document.querySelector("#waiting-controls");

const waitingText =
    document.querySelector("#waiting-text");

const startGameButton =
    document.querySelector("#start-game-button");

const playControls =
    document.querySelector("#play-controls");

const actionHeading =
    document.querySelector("#action-heading");

const actionInstruction =
    document.querySelector("#action-instruction");

const playSelectedButton =
    document.querySelector("#play-selected-button");

const playFaceDownButton =
    document.querySelector("#play-face-down-button");

const pickUpButton =
    document.querySelector("#pick-up-button");

const leaveGameButton =
    document.querySelector("#leave-game-button");

const cancelGameButton =
    document.querySelector("#cancel-game-button");

const turnMessage =
    document.querySelector("#turn-message");

const tableError =
    document.querySelector("#table-error");

let currentUser = null;
let currentState = null;
let selectedCards = new Set();
let selectedFaceDownIndex = null;
let tableChannel = null;
let pollTimer = null;
let refreshTimer = null;
let loadingState = false;
let actionInProgress = false;


function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}


function setTableError(message = "") {
    tableError.textContent = message;
}


function setTurnMessage(message = "") {
    turnMessage.textContent = message;
}


function rankText(card) {
    return String(card ?? "").slice(0, -1);
}


function rankValue(card) {
    const rank = rankText(card);

    const values = {
        "2": 2,
        "3": 3,
        "4": 4,
        "5": 5,
        "6": 6,
        "7": 7,
        "8": 8,
        "9": 9,
        "10": 10,
        "J": 11,
        "Q": 12,
        "K": 13,
        "A": 14
    };

    return values[rank] ?? 0;
}


function suitSymbol(card) {
    const suit = String(card ?? "").slice(-1);

    return {
        C: "♣",
        D: "♦",
        H: "♥",
        S: "♠"
    }[suit] ?? "?";
}


function isRedCard(card) {
    const suit = String(card ?? "").slice(-1);
    return suit === "D" || suit === "H";
}


function sourceLabel(source) {
    const labels = {
        waiting: "Waiting",
        hand: "Hand",
        face_up: "Face up",
        face_down: "Face down",
        finished: "Finished"
    };

    return labels[source] ?? "Waiting";
}


function cardIsPlayable(card) {
    const game = currentState?.game;

    if (!game || game.status !== "playing") {
        return false;
    }

    const value = rankValue(card);

    if (value === 2 || value === 10) {
        return true;
    }

    const rule = String(game.rule ?? "Any card");

    if (rule === "Any card") {
        return true;
    }

    if (rule === "7 or lower") {
        return value <= 7;
    }

    const requiredRank =
        rule.replace(" or higher", "").trim();

    const requiredValue = rankValue(
        `${requiredRank}S`
    );

    return value >= requiredValue;
}


function createCardElement(
    card,
    {
        selectable = false,
        selected = false,
        mini = false,
        blocked = false,
        onClick = null
    } = {}
) {
    const element = document.createElement(
        selectable ? "button" : "div"
    );

    if (selectable) {
        element.type = "button";
        element.disabled = blocked;
    }

    element.className = "shithead-card";

    if (isRedCard(card)) {
        element.classList.add("red");
    }

    if (selectable) {
        element.classList.add("selectable");
    }

    if (selected) {
        element.classList.add("selected");
    }

    if (mini) {
        element.classList.add("mini");
    }

    if (blocked) {
        element.classList.add("blocked");
    }

    element.dataset.card = card;

    const rank = document.createElement("span");
    rank.className = "shithead-card-rank";
    rank.textContent = rankText(card);

    const suit = document.createElement("span");
    suit.className = "shithead-card-suit";
    suit.textContent = suitSymbol(card);

    const corner = document.createElement("span");
    corner.className = "shithead-card-corner";
    corner.textContent = rankText(card);

    element.append(rank, suit, corner);

    if (selectable && onClick) {
        element.addEventListener("click", onClick);
    }

    return element;
}


function createFaceDownCard(
    index,
    {
        selectable = false,
        selected = false,
        mini = false
    } = {}
) {
    const element = document.createElement(
        selectable ? "button" : "div"
    );

    if (selectable) {
        element.type = "button";
    }

    element.className = "shithead-face-down-card";

    if (mini) {
        element.style.flexBasis = "30px";
        element.style.width = "30px";
        element.style.height = "42px";
        element.style.padding = "0.18rem";
    }

    if (selected) {
        element.classList.add("selected");
    }

    const back = document.createElement("span");
    back.className = "shithead-card-back";
    back.textContent = mini ? "" : "SH";
    element.append(back);

    if (selectable) {
        element.addEventListener("click", () => {
            selectedFaceDownIndex =
                selectedFaceDownIndex === index
                    ? null
                    : index;

            renderOwnArea();
        });
    }

    return element;
}


function createEmptyZone(message) {
    const empty = document.createElement("span");
    empty.className = "shithead-empty-zone";
    empty.textContent = message;
    return empty;
}


function myPlayer() {
    return currentState?.players?.find(
        (player) => player.user_id === currentUser?.id
    ) ?? null;
}


function toggleSelectedCard(card) {
    if (selectedCards.has(card)) {
        selectedCards.delete(card);
        renderOwnArea();
        return;
    }

    const selectedRanks = new Set(
        Array.from(selectedCards).map(rankText)
    );

    if (
        selectedRanks.size > 0
        && !selectedRanks.has(rankText(card))
    ) {
        selectedCards.clear();
    }

    selectedCards.add(card);
    renderOwnArea();
}


function renderPlayerGrid() {
    playerGrid.replaceChildren();

    const players = currentState?.players ?? [];

    for (const player of players) {
        const card = document.createElement("article");
        card.className = "shithead-player";
        card.dataset.userId = player.user_id;

        if (player.is_turn) {
            card.classList.add("is-turn");
        }

        if (player.is_me) {
            card.classList.add("is-me");
        }

        const heading = document.createElement("div");
        heading.className = "shithead-player-heading";

        const identity = document.createElement("div");

        const username = document.createElement("strong");
        username.textContent = player.username;
        username.dataset.profileUsername =
            player.username;
        username.dataset.userId =
            player.user_id;

        const seat = document.createElement("span");
        seat.textContent = `Seat ${player.seat_number}`;

        identity.append(username, seat);
        heading.append(identity);

        if (player.is_turn) {
            const turn = document.createElement("span");
            turn.className = "shithead-turn-chip";
            turn.textContent = "Turn";
            heading.append(turn);
        }

        const counts = document.createElement("div");
        counts.className = "shithead-player-counts";

        const hand = document.createElement("span");
        hand.innerHTML =
            `<strong>${Number(
                player.hand_count ?? 0
            )}</strong>Hand`;

        const faceUp = document.createElement("span");
        faceUp.innerHTML =
            `<strong>${Array.isArray(
                player.face_up
            ) ? player.face_up.length : 0}</strong>Up`;

        const faceDown = document.createElement("span");
        faceDown.innerHTML =
            `<strong>${Number(
                player.face_down_count ?? 0
            )}</strong>Down`;

        counts.append(hand, faceUp, faceDown);

        const visibleCards = document.createElement("div");
        visibleCards.className = "shithead-mini-face-up";

        for (const visibleCard of player.face_up ?? []) {
            visibleCards.append(
                createCardElement(
                    visibleCard,
                    { mini: true }
                )
            );
        }

        for (
            let index = 0;
            index < Number(player.face_down_count ?? 0);
            index += 1
        ) {
            visibleCards.append(
                createFaceDownCard(
                    index + 1,
                    { mini: true }
                )
            );
        }

        card.append(
            heading,
            counts,
            visibleCards
        );

        playerGrid.append(card);
    }
}


function renderPile() {
    pileDisplay.replaceChildren();

    const game = currentState?.game;

    if (!game || !game.pile_top) {
        const empty = document.createElement("span");
        empty.className = "shithead-empty-pile";
        empty.textContent = "Empty";
        pileDisplay.append(empty);
    } else {
        pileDisplay.append(
            createCardElement(game.pile_top)
        );
    }

    const stockCount =
        Number(game?.stock_count ?? 0);

    const pileCount =
        Number(game?.pile_count ?? 0);

    stockCountLabel.textContent =
        String(stockCount);

    stockDisplayCount.textContent =
        `${stockCount} card${stockCount === 1 ? "" : "s"}`;

    pileDisplayCount.textContent =
        `${pileCount} card${pileCount === 1 ? "" : "s"}`;

    playRuleLabel.textContent =
        game?.rule ?? "Any card";
}


function renderOwnArea() {
    ownHand.replaceChildren();
    ownFaceUp.replaceChildren();
    ownFaceDown.replaceChildren();

    const player = myPlayer();
    const game = currentState?.game;
    const source = currentState?.my_source ?? "waiting";

    sourceBadge.textContent =
        sourceLabel(source);

    if (!game) {
        ownAreaTitle.textContent =
            "Cards are dealt when the host starts.";
    } else if (game.status === "finished") {
        ownAreaTitle.textContent =
            "Game finished";
    } else if (source === "waiting") {
        ownAreaTitle.textContent =
            `${game.current_turn_username ?? "Another player"} is playing`;
    } else if (source === "hand") {
        ownAreaTitle.textContent =
            "Play from your hand";
    } else if (source === "face_up") {
        ownAreaTitle.textContent =
            "Your hand is gone. Use face-up cards.";
    } else if (source === "face_down") {
        ownAreaTitle.textContent =
            "Blind-card time. Choose carefully.";
    } else {
        ownAreaTitle.textContent =
            "No cards remaining";
    }

    const handCards =
        Array.isArray(player?.hand)
            ? player.hand
            : [];

    const faceUpCards =
        Array.isArray(player?.face_up)
            ? player.face_up
            : [];

    const faceDownCount =
        Number(player?.face_down_count ?? 0);

    if (handCards.length === 0) {
        ownHand.append(
            createEmptyZone("No cards in hand")
        );
    } else {
        for (const card of handCards) {
            const selectable =
                source === "hand"
                && game?.status === "playing";

            ownHand.append(
                createCardElement(
                    card,
                    {
                        selectable,
                        selected:
                            selectedCards.has(card),
                        blocked:
                            selectable
                            && !cardIsPlayable(card),
                        onClick: () =>
                            toggleSelectedCard(card)
                    }
                )
            );
        }
    }

    if (faceUpCards.length === 0) {
        ownFaceUp.append(
            createEmptyZone("No face-up cards")
        );
    } else {
        for (const card of faceUpCards) {
            const selectable =
                source === "face_up"
                && game?.status === "playing";

            ownFaceUp.append(
                createCardElement(
                    card,
                    {
                        selectable,
                        selected:
                            selectedCards.has(card),
                        blocked:
                            selectable
                            && !cardIsPlayable(card),
                        onClick: () =>
                            toggleSelectedCard(card)
                    }
                )
            );
        }
    }

    if (faceDownCount === 0) {
        ownFaceDown.append(
            createEmptyZone("No face-down cards")
        );
    } else {
        for (
            let index = 1;
            index <= faceDownCount;
            index += 1
        ) {
            ownFaceDown.append(
                createFaceDownCard(
                    index,
                    {
                        selectable:
                            source === "face_down"
                            && game?.status === "playing",
                        selected:
                            selectedFaceDownIndex === index
                    }
                )
            );
        }
    }

    const standardTurn =
        source === "hand"
        || source === "face_up";

    const blindTurn =
        source === "face_down";

    playSelectedButton.classList.toggle(
        "hidden",
        !standardTurn
    );

    playFaceDownButton.classList.toggle(
        "hidden",
        !blindTurn
    );

    playSelectedButton.disabled =
        actionInProgress
        || !standardTurn
        || selectedCards.size === 0;

    playFaceDownButton.disabled =
        actionInProgress
        || !blindTurn
        || selectedFaceDownIndex === null;

    pickUpButton.disabled =
        actionInProgress
        || !currentState?.can_pick_up;
}


function renderControls() {
    const table = currentState?.table;
    const game = currentState?.game;
    const players = currentState?.players ?? [];

    if (!table) {
        return;
    }

    const waiting =
        table.status === "waiting"
        && !game;

    waitingControls.classList.toggle(
        "hidden",
        !waiting
    );

    playControls.classList.toggle(
        "hidden",
        !game
        || game.status !== "playing"
    );

    if (waiting) {
        const needed = Math.max(
            0,
            2 - players.length
        );

        waitingText.textContent = needed > 0
            ? `Waiting for ${needed} more player${
                needed === 1 ? "" : "s"
            }.`
            : `${players.length} player${
                players.length === 1 ? "" : "s"
            } seated. The host can start now.`;

        const isHost =
            table.host_id === currentUser.id;

        startGameButton.classList.toggle(
            "hidden",
            !isHost
        );

        startGameButton.disabled =
            actionInProgress
            || players.length < 2;
    }

    if (game?.status === "playing") {
        const myTurn =
            game.current_turn_user_id ===
            currentUser.id;

        actionHeading.textContent = myTurn
            ? "Your turn"
            : `${game.current_turn_username ?? "Player"}'s turn`;

        const source =
            currentState?.my_source;

        if (!myTurn) {
            actionInstruction.textContent =
                `Current rule: ${
                    game.rule ?? "Any card"
                }.`;
        } else if (source === "face_down") {
            actionInstruction.textContent =
                "Choose one face-down card. "
                + "You will not see it until it is played.";
        } else if (source === "face_up") {
            actionInstruction.textContent =
                "Select one or more face-up cards "
                + "of the same rank.";
        } else {
            actionInstruction.textContent =
                "Select one or more hand cards "
                + "of the same rank.";
        }
    }

    leaveGameButton.classList.toggle(
        "hidden",
        table.status !== "waiting"
    );

    cancelGameButton.classList.toggle(
        "hidden",
        !(
            table.host_id === currentUser.id
            && game?.status === "playing"
        )
    );
}


function renderTurnText() {
    const table = currentState?.table;
    const game = currentState?.game;
    const players = currentState?.players ?? [];

    if (!table) {
        return;
    }

    if (!game) {
        turnDescription.textContent =
            "Waiting room";

        turnDetail.textContent =
            players.length < 2
                ? "At least two players are required."
                : "The host can start the game.";

        winnerMessage.textContent = "";
        return;
    }

    if (game.status !== "playing") {
        turnDescription.textContent =
            game.status === "cancelled"
                ? "Game cancelled"
                : "Game over";

        turnDetail.textContent =
            game.status === "cancelled"
                ? "Competitive entry stakes were refunded."
                : "The table has been settled.";

        winnerMessage.textContent =
            game.status === "cancelled"
                ? ""
                : game.winner_username
                    ? table.friendly_mode
                        ? `${game.winner_username} won the friendly game.`
                        : `${game.winner_username} won ${formatChips(
                            game.pot
                        )} chips.`
                    : "Game finished.";

        return;
    }

    turnDescription.textContent =
        game.current_turn_user_id === currentUser.id
            ? "Your turn"
            : `${game.current_turn_username ?? "Player"}'s turn`;

    turnDetail.textContent =
        `${game.rule ?? "Any card"} · `
        + `${Number(game.burned_piles ?? 0)} pile${
            Number(game.burned_piles ?? 0) === 1
                ? ""
                : "s"
        } burned`;

    winnerMessage.textContent = "";
}


function renderState() {
    if (!currentState?.table) {
        return;
    }

    const table = currentState.table;
    const game = currentState.game;
    const players = currentState.players ?? [];
    const me = myPlayer();

    tableNameLabel.textContent = table.name;

    tableDescription.textContent =
        table.friendly_mode
            ? "Friendly practice game. No wallet chips or XP are changed."
            : "Competitive Shithead. First player out wins the pot.";

    currentUsernameLabel.textContent =
        me?.username ?? "Player";

    playerCountLabel.textContent =
        `${players.length}/${table.max_players}`;

    entryStakeLabel.textContent =
        table.friendly_mode
            ? `${formatChips(table.entry_stake)} practice`
            : `${formatChips(table.entry_stake)} chips`;

    potLabel.textContent =
        table.friendly_mode
            ? "Practice"
            : game
                ? `${formatChips(game.pot)} chips`
                : `${formatChips(
                    Number(table.entry_stake)
                    * players.length
                )} pending`;

    selectedCards = new Set(
        Array.from(selectedCards).filter(
            (card) =>
                me?.hand?.includes(card)
                || me?.face_up?.includes(card)
        )
    );

    if (
        selectedFaceDownIndex !== null
        && selectedFaceDownIndex >
            Number(me?.face_down_count ?? 0)
    ) {
        selectedFaceDownIndex = null;
    }

    renderPlayerGrid();
    renderPile();
    renderOwnArea();
    renderControls();
    renderTurnText();
}


async function loadWallet() {
    if (!currentUser) {
        return;
    }

    const { data, error } =
        await window.supabaseClient
            .from("profiles")
            .select("chips")
            .eq("id", currentUser.id)
            .single();

    if (!error && data) {
        walletBalanceLabel.textContent =
            formatChips(data.chips);
    }
}


async function loadState() {
    if (
        loadingState
        || !tableId
        || !currentUser
    ) {
        return;
    }

    loadingState = true;

    try {
        const { data, error } =
            await window.supabaseClient.rpc(
                "get_shithead_state",
                {
                    p_table_id: tableId
                }
            );

        if (error) {
            throw error;
        }

        currentState = data;
        setTableError();
        renderState();

        if (
            currentState?.game?.status ===
            "finished"
        ) {
            await loadWallet();
        }
    } catch (error) {
        console.error(error);

        setTableError(
            error.message
            || "The Shithead table could not be loaded."
        );
    } finally {
        loadingState = false;
    }
}


async function runAction(action, pendingMessage) {
    if (actionInProgress) {
        return;
    }

    actionInProgress = true;
    setTableError();
    setTurnMessage(pendingMessage);
    renderOwnArea();
    renderControls();

    try {
        await action();

        selectedCards.clear();
        selectedFaceDownIndex = null;

        await Promise.all([
            loadState(),
            loadWallet()
        ]);

        setTurnMessage();
    } catch (error) {
        console.error(error);

        setTurnMessage();

        setTableError(
            error.message
            || "That Shithead action failed."
        );
    } finally {
        actionInProgress = false;
        renderOwnArea();
        renderControls();
    }
}


startGameButton.addEventListener(
    "click",
    () => runAction(
        async () => {
            const { error } =
                await window.supabaseClient.rpc(
                    "start_shithead_game",
                    {
                        p_table_id: tableId
                    }
                );

            if (error) {
                throw error;
            }
        },
        "Dealing cards..."
    )
);


playSelectedButton.addEventListener(
    "click",
    () => {
        const cards =
            Array.from(selectedCards);

        if (cards.length === 0) {
            return;
        }

        runAction(
            async () => {
                const { error } =
                    await window.supabaseClient.rpc(
                        "play_shithead_cards",
                        {
                            p_table_id: tableId,
                            p_cards: cards
                        }
                    );

                if (error) {
                    throw error;
                }
            },
            `Playing ${cards.length} card${
                cards.length === 1 ? "" : "s"
            }...`
        );
    }
);


playFaceDownButton.addEventListener(
    "click",
    () => {
        if (selectedFaceDownIndex === null) {
            return;
        }

        const index = selectedFaceDownIndex;

        runAction(
            async () => {
                const { data, error } =
                    await window.supabaseClient.rpc(
                        "play_shithead_face_down",
                        {
                            p_table_id: tableId,
                            p_index: index
                        }
                    );

                if (error) {
                    throw error;
                }

                if (data === false) {
                    setTurnMessage(
                        "Bad blind card. You picked up the pile."
                    );
                }
            },
            "Flipping the blind card..."
        );
    }
);


pickUpButton.addEventListener(
    "click",
    () => runAction(
        async () => {
            const { error } =
                await window.supabaseClient.rpc(
                    "pick_up_shithead_pile",
                    {
                        p_table_id: tableId
                    }
                );

            if (error) {
                throw error;
            }
        },
        "Picking up the pile..."
    )
);


leaveGameButton.addEventListener(
    "click",
    () => runAction(
        async () => {
            const { error } =
                await window.supabaseClient.rpc(
                    "leave_poker_table",
                    {
                        p_table_id: tableId
                    }
                );

            if (error) {
                throw error;
            }

            window.location.href = "poker.html";
        },
        "Leaving table..."
    )
);


cancelGameButton.addEventListener(
    "click",
    () => {
        const confirmed = window.confirm(
            "Cancel this Shithead game and refund "
            + "all competitive entry stakes?"
        );

        if (!confirmed) {
            return;
        }

        runAction(
            async () => {
                const { error } =
                    await window.supabaseClient.rpc(
                        "cancel_shithead_game",
                        {
                            p_table_id: tableId
                        }
                    );

                if (error) {
                    throw error;
                }
            },
            "Cancelling and refunding..."
        );
    }
);


function scheduleStateRefresh() {
    window.clearTimeout(refreshTimer);

    refreshTimer = window.setTimeout(
        loadState,
        120
    );
}


function subscribeToTable() {
    tableChannel = window.supabaseClient
        .channel(`shithead-table-${tableId}`)
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "poker_tables",
                filter: `id=eq.${tableId}`
            },
            scheduleStateRefresh
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "poker_seats",
                filter: `table_id=eq.${tableId}`
            },
            scheduleStateRefresh
        )
        .subscribe();

    const poll = async () => {
        await loadState();

        pollTimer = window.setTimeout(
            poll,
            2500
        );
    };

    pollTimer = window.setTimeout(
        poll,
        2500
    );
}


window.addEventListener(
    "beforeunload",
    () => {
        window.clearTimeout(pollTimer);
        window.clearTimeout(refreshTimer);

        if (tableChannel) {
            window.supabaseClient.removeChannel(
                tableChannel
            );
        }
    }
);


async function initialiseShithead() {
    if (!tableId) {
        setTableError(
            "No Shithead table ID was supplied."
        );
        return;
    }

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

        await Promise.all([
            loadState(),
            loadWallet()
        ]);

        subscribeToTable();
    } catch (error) {
        console.error(error);

        setTableError(
            error.message
            || "Shithead could not be initialised."
        );
    }
}


initialiseShithead();
