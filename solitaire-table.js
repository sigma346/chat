const boardElement = document.querySelector("#solitaire-board");
const titleElement = document.querySelector("#solitaire-title");
const descriptionElement = document.querySelector(
    "#solitaire-description"
);
const walletElement = document.querySelector("#solitaire-wallet");
const entryElement = document.querySelector("#solitaire-entry");
const entryLabelElement = document.querySelector(
    "#solitaire-entry-label"
);
const payoutElement = document.querySelector("#solitaire-payout");
const movesElement = document.querySelector("#solitaire-moves");
const timeElement = document.querySelector("#solitaire-time");
const messageElement = document.querySelector("#solitaire-message");
const friendlyBanner = document.querySelector(
    "#friendly-solitaire-banner"
);
const rulesCopy = document.querySelector("#solitaire-rules-copy");

const newGameButton = document.querySelector(
    "#new-solitaire-game-button"
);
const undoButton = document.querySelector("#undo-solitaire-button");
const hintButton = document.querySelector("#hint-solitaire-button");
const restartButton = document.querySelector(
    "#restart-solitaire-button"
);
const abandonButton = document.querySelector(
    "#abandon-solitaire-button"
);
const closeTableButton = document.querySelector(
    "#close-solitaire-table-button"
);

const resultOverlay = document.querySelector(
    "#solitaire-result-overlay"
);
const resultKicker = document.querySelector(
    "#solitaire-result-kicker"
);
const resultTitle = document.querySelector(
    "#solitaire-result-title"
);
const resultCopy = document.querySelector(
    "#solitaire-result-copy"
);
const overlayNewGameButton = document.querySelector(
    "#overlay-new-game-button"
);
const dismissResultButton = document.querySelector(
    "#dismiss-result-button"
);

const tableId = new URLSearchParams(window.location.search).get("id");
const suitOrder = ["S", "H", "D", "C"];
const suitSymbols = {
    S: "♠",
    H: "♥",
    D: "♦",
    C: "♣"
};
const rankLabels = {
    1: "A",
    11: "J",
    12: "Q",
    13: "K"
};

let currentUser = null;
let solitaireData = null;
let selectedSource = null;
let actionPending = false;
let timerHandle = null;
let dismissedResultGameId = null;
let hintTimer = null;
let pendingBoardAnimation = "deal";
let currentBoardAnimation = "none";
let currentCardRenderIndex = 0;
let renderedGameId = null;
let previousRenderedState = null;
let revealedTableauColumns = new Set();


function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}


function showMessage(message = "", error = false) {
    messageElement.textContent = message;
    messageElement.classList.toggle("error-message", error);
}


function rankLabel(rank) {
    return rankLabels[Number(rank)] ?? String(rank);
}


function cardColour(card) {
    return card?.suit === "H" || card?.suit === "D"
        ? "red"
        : "black";
}


function formatElapsed(milliseconds) {
    const seconds = Math.max(
        0,
        Math.floor(milliseconds / 1000)
    );
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
        return [hours, minutes, remainingSeconds]
            .map((value) => String(value).padStart(2, "0"))
            .join(":");
    }

    return [minutes, remainingSeconds]
        .map((value) => String(value).padStart(2, "0"))
        .join(":");
}


function updateTimer() {
    const game = solitaireData?.game;

    if (!game?.started_at) {
        timeElement.textContent = "00:00";
        return;
    }

    const start = new Date(game.started_at).getTime();
    const end = game.completed_at
        ? new Date(game.completed_at).getTime()
        : Date.now();

    timeElement.textContent = formatElapsed(end - start);
}


function sourceKey(source) {
    if (!source) {
        return "";
    }

    return [
        source.kind,
        source.from_index ?? "",
        source.card_index ?? ""
    ].join(":");
}


function destinationKey(destination) {
    if (!destination) {
        return "";
    }

    return [
        destination.kind,
        destination.to_index ?? ""
    ].join(":");
}


function sameSource(first, second) {
    return sourceKey(first) === sourceKey(second);
}


function publicState() {
    return solitaireData?.state ?? null;
}


function isKlondike() {
    return solitaireData?.table?.game_type === "solitaire_klondike";
}


function isSpider() {
    return solitaireData?.table?.game_type === "solitaire_spider";
}


function activeGame() {
    return solitaireData?.game?.status === "active";
}


function cssPixelVariable(name, fallback) {
    const value = Number.parseFloat(
        window.getComputedStyle(document.documentElement)
            .getPropertyValue(name)
    );

    return Number.isFinite(value) ? value : fallback;
}


function overlapMeasurements() {
    return {
        faceUp: cssPixelVariable("--sol-overlap", 29),
        faceDown: cssPixelVariable("--sol-face-down-overlap", 15),
        cardHeight: cssPixelVariable("--sol-card-height", 109)
    };
}


function klondikeSequenceValid(pile, startIndex) {
    const moving = pile.slice(startIndex);

    if (!moving.length || moving.some((card) => !card.face_up)) {
        return false;
    }

    for (let index = 0; index < moving.length - 1; index += 1) {
        const card = moving[index];
        const next = moving[index + 1];

        if (
            Number(card.rank) !== Number(next.rank) + 1
            || cardColour(card) === cardColour(next)
        ) {
            return false;
        }
    }

    return true;
}


function spiderSequenceValid(pile, startIndex) {
    const moving = pile.slice(startIndex);

    if (!moving.length || moving.some((card) => !card.face_up)) {
        return false;
    }

    for (let index = 0; index < moving.length - 1; index += 1) {
        const card = moving[index];
        const next = moving[index + 1];

        if (
            Number(card.rank) !== Number(next.rank) + 1
            || card.suit !== next.suit
        ) {
            return false;
        }
    }

    return true;
}


function canDragSource(source) {
    const state = publicState();

    if (!activeGame() || !state || !source) {
        return false;
    }

    if (source.kind === "waste") {
        return state.waste?.length > 0;
    }

    if (source.kind === "foundation") {
        const suit = suitOrder[source.from_index];
        return (state.foundations?.[suit]?.length ?? 0) > 0;
    }

    if (source.kind !== "tableau") {
        return false;
    }

    const pile = state.tableau?.[source.from_index] ?? [];

    return isKlondike()
        ? klondikeSequenceValid(pile, source.card_index)
        : spiderSequenceValid(pile, source.card_index);
}


function faceDownCount(pile = []) {
    return pile.filter((card) => !card?.face_up).length;
}


function calculateRevealedColumns(previousState, nextState) {
    const revealed = new Set();
    const previousTableau = previousState?.tableau ?? [];
    const nextTableau = nextState?.tableau ?? [];

    nextTableau.forEach((pile, columnIndex) => {
        if (
            faceDownCount(previousTableau[columnIndex] ?? [])
            > faceDownCount(pile)
        ) {
            revealed.add(columnIndex);
        }
    });

    return revealed;
}


function applyCardAnimation(cardElement, card, source = null) {
    const delay = Math.min(currentCardRenderIndex, 36) * 14;
    cardElement.style.setProperty("--card-delay", `${delay}ms`);
    currentCardRenderIndex += 1;

    if (currentBoardAnimation === "deal") {
        cardElement.classList.add("card-deal-in");
        return;
    }

    if (
        currentBoardAnimation === "draw_stock"
        && source?.kind === "waste"
    ) {
        cardElement.classList.add("card-draw-in");
    }

    if (
        currentBoardAnimation === "move"
        && source?.kind === "tableau"
        && revealedTableauColumns.has(source.from_index)
        && card?.face_up
    ) {
        const pile = publicState()?.tableau?.[source.from_index] ?? [];
        const firstFaceUpIndex = pile.findIndex(
            (pileCard) => pileCard?.face_up
        );

        if (source.card_index === firstFaceUpIndex) {
            cardElement.classList.add("card-flip-in");
        }
    }
}


function createCardElement(card, source = null) {
    const cardElement = document.createElement("div");
    cardElement.className = "playing-card";

    if (!card?.face_up) {
        cardElement.classList.add("face-down");
        cardElement.setAttribute("aria-label", "Face-down card");
        applyCardAnimation(cardElement, card, source);
        return cardElement;
    }

    if (cardColour(card) === "red") {
        cardElement.classList.add("red-card");
    }

    const displayRank = rankLabel(card.rank);
    const displaySuit = suitSymbols[card.suit] ?? "?";

    const topCorner = document.createElement("span");
    topCorner.className = "card-corner";
    topCorner.innerHTML = `<span>${displayRank}</span><span>${displaySuit}</span>`;

    const bottomCorner = document.createElement("span");
    bottomCorner.className = "card-corner bottom";
    bottomCorner.innerHTML = `<span>${displayRank}</span><span>${displaySuit}</span>`;

    const centreSuit = document.createElement("span");
    centreSuit.className = "card-suit-large";
    centreSuit.textContent = displaySuit;

    cardElement.append(topCorner, centreSuit, bottomCorner);
    cardElement.setAttribute(
        "aria-label",
        `${displayRank} of ${card.suit}`
    );

    if (source) {
        cardElement.dataset.sourceKey = sourceKey(source);

        if (sameSource(source, selectedSource)) {
            cardElement.classList.add("selected-card");
        }

        if (canDragSource(source)) {
            cardElement.draggable = true;
            cardElement.classList.add("draggable-card");

            cardElement.addEventListener("dragstart", (event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(
                    "application/json",
                    JSON.stringify(source)
                );
                selectedSource = source;
            });
        }

        cardElement.addEventListener("click", (event) => {
            event.stopPropagation();
            handleCardClick(source);
        });

        if (isKlondike()) {
            cardElement.addEventListener("dblclick", (event) => {
                event.stopPropagation();
                moveSourceToFoundation(source);
            });
        }
    }

    applyCardAnimation(cardElement, card, source);
    return cardElement;
}


function addDropHandlers(element, destination) {
    element.dataset.destinationKey = destinationKey(destination);

    element.addEventListener("dragover", (event) => {
        if (!activeGame()) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        element.classList.add("drop-ready");
    });

    element.addEventListener("dragleave", () => {
        element.classList.remove("drop-ready");
    });

    element.addEventListener("drop", (event) => {
        event.preventDefault();
        element.classList.remove("drop-ready");

        try {
            const source = JSON.parse(
                event.dataTransfer.getData("application/json")
            );
            moveSelectedSource(source, destination);
        } catch (error) {
            console.error(error);
        }
    });
}


function createEmptySlot(symbol = "") {
    const slot = document.createElement("div");
    slot.className = "card-slot";
    slot.textContent = symbol;
    return slot;
}


function createTableauPile(pile, columnIndex) {
    const pileElement = document.createElement("div");
    pileElement.className = "tableau-pile";
    const destination = {
        kind: "tableau",
        to_index: columnIndex
    };

    addDropHandlers(pileElement, destination);

    const emptySlot = createEmptySlot(
        isKlondike() ? "K" : ""
    );
    emptySlot.classList.add("empty-tableau-slot");
    pileElement.append(emptySlot);

    pileElement.addEventListener("click", () => {
        if (selectedSource) {
            moveSelectedSource(selectedSource, destination);
        }
    });

    const measurements = overlapMeasurements();
    let top = 0;

    pile.forEach((card, cardIndex) => {
        const source = {
            kind: "tableau",
            from_index: columnIndex,
            card_index: cardIndex
        };
        const cardElement = createCardElement(card, source);

        if (
            currentBoardAnimation === "deal_stock"
            && cardIndex === pile.length - 1
        ) {
            cardElement.classList.remove("card-deal-in");
            cardElement.classList.add("card-row-deal");
        }

        cardElement.style.top = `${top}px`;
        cardElement.style.zIndex = String(cardIndex + 1);
        pileElement.append(cardElement);

        if (cardIndex < pile.length - 1) {
            top += card.face_up
                ? measurements.faceUp
                : measurements.faceDown;
        }
    });

    pileElement.style.minHeight = `${Math.max(
        470,
        top + measurements.cardHeight
    )}px`;

    return pileElement;
}


function renderKlondikeBoard(state) {
    const root = document.createElement("div");
    root.className = "klondike-board";

    const topRow = document.createElement("div");
    topRow.className = "klondike-top-row";

    const stockPile = document.createElement("div");
    stockPile.className = "card-pile stock-pile";

    if (Number(state.stock_count) > 0) {
        stockPile.append(createCardElement({ face_up: false }));
    } else {
        stockPile.append(createEmptySlot("↻"));
    }

    const stockCount = document.createElement("span");
    stockCount.className = "stock-count-badge";
    stockCount.textContent = String(state.stock_count ?? 0);
    stockPile.append(stockCount);

    const stockLabel = document.createElement("span");
    stockLabel.className = "stock-label";
    stockLabel.textContent = Number(state.draw_count) === 3
        ? "Draw 3"
        : "Draw 1";
    stockPile.append(stockLabel);

    stockPile.addEventListener("click", () => {
        if (activeGame()) {
            performAction({ type: "draw_stock" });
        }
    });

    const wastePile = document.createElement("div");
    wastePile.className = "card-pile waste-pile";
    const waste = state.waste ?? [];

    if (waste.length > 0) {
        const source = {
            kind: "waste",
            from_index: 0,
            card_index: waste.length - 1
        };
        wastePile.append(
            createCardElement(waste[waste.length - 1], source)
        );
    } else {
        wastePile.append(createEmptySlot());
    }

    const spacer = document.createElement("div");

    topRow.append(stockPile, wastePile, spacer);

    for (let foundationIndex = 0; foundationIndex < 4; foundationIndex += 1) {
        const suit = suitOrder[foundationIndex];
        const pile = state.foundations?.[suit] ?? [];
        const foundation = document.createElement("div");
        foundation.className = "card-pile foundation-pile";
        const destination = {
            kind: "foundation",
            to_index: foundationIndex
        };

        addDropHandlers(foundation, destination);

        if (pile.length > 0) {
            const source = {
                kind: "foundation",
                from_index: foundationIndex,
                card_index: pile.length - 1
            };
            foundation.append(
                createCardElement(pile[pile.length - 1], source)
            );
        } else {
            foundation.append(createEmptySlot(suitSymbols[suit]));
        }

        foundation.addEventListener("click", () => {
            if (selectedSource) {
                moveSelectedSource(selectedSource, destination);
            }
        });

        topRow.append(foundation);
    }

    const tableau = document.createElement("div");
    tableau.className = "tableau-grid klondike-tableau";

    (state.tableau ?? []).forEach((pile, columnIndex) => {
        tableau.append(createTableauPile(pile, columnIndex));
    });

    root.append(topRow, tableau);
    boardElement.replaceChildren(root);
}


function renderSpiderBoard(state) {
    const root = document.createElement("div");
    root.className = "spider-board";

    const topRow = document.createElement("div");
    topRow.className = "spider-top-row";

    const stockPile = document.createElement("div");
    stockPile.className = "card-pile stock-pile";

    if (Number(state.stock_count) > 0) {
        stockPile.append(createCardElement({ face_up: false }));
    } else {
        stockPile.append(createEmptySlot("✓"));
    }

    const remainingDeals = Math.floor(
        Number(state.stock_count ?? 0) / 10
    );
    const stockCount = document.createElement("span");
    stockCount.className = "stock-count-badge";
    stockCount.textContent = `${remainingDeals}×`;
    stockPile.append(stockCount);

    const stockLabel = document.createElement("span");
    stockLabel.className = "stock-label";
    stockLabel.textContent = "Deal row";
    stockPile.append(stockLabel);

    stockPile.addEventListener("click", () => {
        if (activeGame()) {
            performAction({ type: "deal_stock" });
        }
    });

    const completedRuns = document.createElement("div");
    completedRuns.className = "spider-completed-runs";

    const completedCount = Number(state.completed_runs ?? 0);

    for (let index = 0; index < 8; index += 1) {
        const token = document.createElement("div");
        token.className = "completed-run-token";
        token.textContent = index < completedCount ? "♠" : "·";
        token.title = index < completedCount
            ? "Completed King-to-Ace run"
            : "Incomplete run";
        completedRuns.append(token);
    }

    topRow.append(stockPile, completedRuns);

    const tableau = document.createElement("div");
    tableau.className = "tableau-grid spider-tableau";

    (state.tableau ?? []).forEach((pile, columnIndex) => {
        tableau.append(createTableauPile(pile, columnIndex));
    });

    root.append(topRow, tableau);
    boardElement.replaceChildren(root);
}


function renderRules() {
    const table = solitaireData?.table;
    const game = solitaireData?.game;

    if (!table || !game) {
        rulesCopy.innerHTML = "<p>No active rules were found.</p>";
        return;
    }

    const fairness = table.friendly_mode
        ? "This is a friendly practice table, so there is no entry deduction, payout or XP."
        : `The deal costs ${formatChips(game.entry_fee)} chips. A win returns ${formatChips(game.payout_on_win)} chips and awards ${Number(game.xp_reward)} XP. The return is calibrated around a ${(Number(game.target_win_bps) / 100).toFixed(0)}% target win rate.`;

    if (isKlondike()) {
        rulesCopy.innerHTML = `
            <p>
                Build the seven tableau columns downward in alternating colours.
                Empty columns accept Kings. Move Aces through Kings to the four
                suit foundations to win.
            </p>
            <ul>
                <li>The stock uses ${Number(table.solitaire_option) === 3 ? "Draw 3" : "Draw 1"} with unlimited passes.</li>
                <li>Double-click a top card to send it to a legal foundation.</li>
                <li>Undo and restart are available while the deal is active.</li>
                <li>${fairness}</li>
            </ul>
        `;
        return;
    }

    rulesCopy.innerHTML = `
        <p>
            Build tableau cards downward by rank. Only a complete descending
            sequence of the same suit can move together. A King-to-Ace run of
            one suit is removed automatically; complete eight runs to win.
        </p>
        <ul>
            <li>This deal uses ${table.solitaire_option} suit${Number(table.solitaire_option) === 1 ? "" : "s"}.</li>
            <li>A stock row can be dealt only when every tableau column contains a card.</li>
            <li>Empty columns accept any card or valid same-suit sequence.</li>
            <li>${fairness}</li>
        </ul>
    `;
}


function renderResultOverlay() {
    const game = solitaireData?.game;
    const table = solitaireData?.table;

    if (
        !game
        || game.status === "active"
        || dismissedResultGameId === game.id
    ) {
        resultOverlay.classList.add("hidden");
        return;
    }

    resultOverlay.classList.remove("hidden");

    if (game.status === "won") {
        resultKicker.textContent = "DEAL WON";
        resultTitle.textContent = `You completed ${game.variant_label}`;
        resultCopy.textContent = table.friendly_mode
            ? "Practice deal complete. No wallet chips or XP changed."
            : `The server returned ${formatChips(game.payout_on_win)} chips and awarded ${Number(game.xp_reward)} XP.`;
    } else {
        resultKicker.textContent = "DEAL ENDED";
        resultTitle.textContent = "The deal was abandoned";
        resultCopy.textContent = table.friendly_mode
            ? "The practice deal ended with no wallet changes."
            : `The ${formatChips(game.entry_fee)}-chip entry fee was not returned.`;
    }
}


function renderControls() {
    const active = activeGame();
    const game = solitaireData?.game;

    newGameButton.classList.toggle("hidden", active || !game);
    newGameButton.disabled = actionPending;
    overlayNewGameButton.disabled = actionPending;

    undoButton.disabled =
        actionPending
        || !active
        || Number(game?.move_count ?? 0) <= 0;
    hintButton.disabled = actionPending || !active;
    restartButton.disabled =
        actionPending
        || !active
        || Number(game?.move_count ?? 0) <= 0;
    abandonButton.disabled = actionPending || !active;
    closeTableButton.disabled = actionPending;
}


function renderState() {
    if (!solitaireData?.table) {
        return;
    }

    const table = solitaireData.table;
    const game = solitaireData.game;
    const state = solitaireData.state;

    titleElement.textContent = game?.variant_label
        ?? (isKlondike() ? "Klondike Solitaire" : "Spider Solitaire");
    descriptionElement.textContent = table.friendly_mode
        ? "Private practice table. Resume whenever you like."
        : "Private competitive deal with a server-frozen win return.";

    walletElement.textContent = `${formatChips(solitaireData.wallet_chips)} chips`;
    entryLabelElement.textContent = table.friendly_mode
        ? "Practice entry"
        : "Entry fee";
    entryElement.textContent = `${formatChips(game?.entry_fee ?? table.entry_fee)} chips`;
    payoutElement.textContent = table.friendly_mode
        ? "Practice"
        : `${formatChips(game?.payout_on_win ?? 0)} chips`;
    movesElement.textContent = formatChips(game?.move_count ?? 0);

    friendlyBanner.classList.toggle(
        "hidden",
        !table.friendly_mode
    );

    const gameChanged = Boolean(
        game?.id
        && game.id !== renderedGameId
    );

    currentBoardAnimation = gameChanged
        ? "deal"
        : (pendingBoardAnimation ?? "none");
    currentCardRenderIndex = 0;
    revealedTableauColumns = calculateRevealedColumns(
        previousRenderedState,
        state
    );

    boardElement.classList.remove(
        "loading-board",
        "board-soft-settle",
        "board-restart"
    );

    if (["move", "undo", "draw_stock", "deal_stock"].includes(
        currentBoardAnimation
    )) {
        boardElement.classList.add("board-soft-settle");
    } else if (currentBoardAnimation === "restart") {
        boardElement.classList.add("board-restart");
    }

    if (!state) {
        boardElement.innerHTML = `
            <div class="solitaire-loading">
                No deal is currently attached to this table.
            </div>
        `;
    } else if (isKlondike()) {
        renderKlondikeBoard(state);
    } else {
        renderSpiderBoard(state);
    }

    renderRules();
    renderControls();
    renderResultOverlay();
    updateTimer();

    renderedGameId = game?.id ?? null;
    previousRenderedState = state
        ? JSON.parse(JSON.stringify(state))
        : null;
    pendingBoardAnimation = null;
    currentBoardAnimation = "none";
}


async function loadSolitaireState() {
    if (!tableId) {
        throw new Error("The Solitaire table ID is missing from the URL.");
    }

    const { data, error } = await window.supabaseClient.rpc(
        "get_solitaire_state",
        { p_table_id: tableId }
    );

    if (error) {
        throw error;
    }

    solitaireData = data;
    selectedSource = null;
    renderState();
}


async function performAction(action) {
    if (actionPending) {
        return;
    }

    actionPending = true;
    selectedSource = null;
    pendingBoardAnimation = action.type;
    boardElement.classList.add("action-pending");
    showMessage();
    renderControls();

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "play_solitaire_action",
            {
                p_table_id: tableId,
                p_action: action
            }
        );

        if (error) {
            throw error;
        }

        solitaireData = data;
        renderState();
    } catch (error) {
        console.error(error);
        showMessage(
            error.message || "The Solitaire move was rejected.",
            true
        );
        renderState();
    } finally {
        actionPending = false;
        boardElement.classList.remove("action-pending");
        renderControls();
    }
}


async function startAnotherDeal() {
    if (actionPending) {
        return;
    }

    actionPending = true;
    dismissedResultGameId = null;
    pendingBoardAnimation = "deal";
    boardElement.classList.add("action-pending");
    showMessage();
    renderControls();

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "start_solitaire_game",
            { p_table_id: tableId }
        );

        if (error) {
            throw error;
        }

        solitaireData = data;
        renderState();
    } catch (error) {
        console.error(error);
        showMessage(
            error.message || "A new Solitaire deal could not be started.",
            true
        );
    } finally {
        actionPending = false;
        boardElement.classList.remove("action-pending");
        renderControls();
    }
}


function sourceCanMoveToTableau(source, destinationIndex) {
    const state = publicState();

    if (!state || !source) {
        return false;
    }

    let movingCard = null;

    if (source.kind === "tableau") {
        movingCard = state.tableau[source.from_index]?.[source.card_index];
    } else if (source.kind === "waste") {
        movingCard = state.waste?.at(-1);
    } else if (source.kind === "foundation") {
        const suit = suitOrder[source.from_index];
        movingCard = state.foundations?.[suit]?.at(-1);
    }

    if (!movingCard) {
        return false;
    }

    const destinationPile = state.tableau[destinationIndex] ?? [];
    const destinationCard = destinationPile.at(-1);

    if (!destinationCard) {
        return isKlondike()
            ? Number(movingCard.rank) === 13
            : true;
    }

    if (isKlondike()) {
        return (
            Number(destinationCard.rank) === Number(movingCard.rank) + 1
            && cardColour(destinationCard) !== cardColour(movingCard)
        );
    }

    return Number(destinationCard.rank) === Number(movingCard.rank) + 1;
}


function moveSelectedSource(source, destination) {
    if (!source || !destination || !canDragSource(source)) {
        return;
    }

    if (
        destination.kind === "tableau"
        && !sourceCanMoveToTableau(source, destination.to_index)
    ) {
        showMessage("Those cards cannot move to that column.", true);
        return;
    }

    performAction({
        type: "move",
        from_kind: source.kind,
        from_index: source.from_index ?? 0,
        card_index: source.card_index ?? 0,
        to_kind: destination.kind,
        to_index: destination.to_index
    });
}


function handleCardClick(source) {
    if (!activeGame() || !source) {
        return;
    }

    if (!selectedSource) {
        if (canDragSource(source)) {
            selectedSource = source;
            renderState();
        }
        return;
    }

    if (sameSource(selectedSource, source)) {
        selectedSource = null;
        renderState();
        return;
    }

    if (isKlondike() && source.kind === "foundation") {
        moveSelectedSource(selectedSource, {
            kind: "foundation",
            to_index: source.from_index
        });
        return;
    }

    if (
        source.kind === "tableau"
        && sourceCanMoveToTableau(
            selectedSource,
            source.from_index
        )
    ) {
        moveSelectedSource(selectedSource, {
            kind: "tableau",
            to_index: source.from_index
        });
        return;
    }

    if (canDragSource(source)) {
        selectedSource = source;
        renderState();
    }
}


function moveSourceToFoundation(source) {
    if (!isKlondike() || !source || !activeGame()) {
        return;
    }

    const state = publicState();
    let card = null;

    if (source.kind === "tableau") {
        const pile = state.tableau[source.from_index] ?? [];

        if (source.card_index !== pile.length - 1) {
            return;
        }

        card = pile.at(-1);
    } else if (source.kind === "waste") {
        card = state.waste?.at(-1);
    } else if (source.kind === "foundation") {
        return;
    }

    if (!card) {
        return;
    }

    const foundationIndex = suitOrder.indexOf(card.suit);
    const foundation = state.foundations?.[card.suit] ?? [];

    if (Number(card.rank) !== foundation.length + 1) {
        return;
    }

    moveSelectedSource(source, {
        kind: "foundation",
        to_index: foundationIndex
    });
}


function findKlondikeHint() {
    const state = publicState();

    const sources = [];

    if (state.waste?.length) {
        sources.push({
            kind: "waste",
            from_index: 0,
            card_index: state.waste.length - 1
        });
    }

    state.tableau.forEach((pile, columnIndex) => {
        if (pile.length && pile.at(-1)?.face_up) {
            sources.push({
                kind: "tableau",
                from_index: columnIndex,
                card_index: pile.length - 1
            });
        }
    });

    for (const source of sources) {
        let card;

        if (source.kind === "waste") {
            card = state.waste.at(-1);
        } else {
            card = state.tableau[source.from_index].at(-1);
        }

        const foundation = state.foundations[card.suit] ?? [];

        if (Number(card.rank) === foundation.length + 1) {
            return {
                source,
                destination: {
                    kind: "foundation",
                    to_index: suitOrder.indexOf(card.suit)
                },
                message: "Move this card to its foundation."
            };
        }
    }

    const movableSources = [];

    state.tableau.forEach((pile, columnIndex) => {
        pile.forEach((card, cardIndex) => {
            const source = {
                kind: "tableau",
                from_index: columnIndex,
                card_index: cardIndex
            };

            if (canDragSource(source)) {
                movableSources.push(source);
            }
        });
    });

    if (state.waste?.length) {
        movableSources.unshift({
            kind: "waste",
            from_index: 0,
            card_index: state.waste.length - 1
        });
    }

    for (const source of movableSources) {
        for (let destinationIndex = 0; destinationIndex < 7; destinationIndex += 1) {
            if (
                source.kind === "tableau"
                && source.from_index === destinationIndex
            ) {
                continue;
            }

            if (sourceCanMoveToTableau(source, destinationIndex)) {
                return {
                    source,
                    destination: {
                        kind: "tableau",
                        to_index: destinationIndex
                    },
                    message: "This sequence can move to another tableau column."
                };
            }
        }
    }

    if (Number(state.stock_count) > 0 || state.waste?.length) {
        return {
            source: null,
            destination: null,
            message: Number(state.stock_count) > 0
                ? "Draw from the stock."
                : "Recycle the waste pile into the stock."
        };
    }

    return null;
}


function findSpiderHint() {
    const state = publicState();

    for (let sourceColumn = 0; sourceColumn < 10; sourceColumn += 1) {
        const pile = state.tableau[sourceColumn] ?? [];

        for (let cardIndex = 0; cardIndex < pile.length; cardIndex += 1) {
            const source = {
                kind: "tableau",
                from_index: sourceColumn,
                card_index: cardIndex
            };

            if (!canDragSource(source)) {
                continue;
            }

            for (let destinationIndex = 0; destinationIndex < 10; destinationIndex += 1) {
                if (destinationIndex === sourceColumn) {
                    continue;
                }

                if (sourceCanMoveToTableau(source, destinationIndex)) {
                    return {
                        source,
                        destination: {
                            kind: "tableau",
                            to_index: destinationIndex
                        },
                        message: "Move this same-suit sequence to that column."
                    };
                }
            }
        }
    }

    const hasEmptyColumn = state.tableau.some(
        (pile) => pile.length === 0
    );

    if (Number(state.stock_count) >= 10 && !hasEmptyColumn) {
        return {
            source: null,
            destination: null,
            message: "Deal the next row from the stock."
        };
    }

    if (hasEmptyColumn && Number(state.stock_count) >= 10) {
        return {
            source: null,
            destination: null,
            message: "Fill the empty column before dealing another row."
        };
    }

    return null;
}


function showHint() {
    window.clearTimeout(hintTimer);
    document
        .querySelectorAll(".hint-source, .hint-target")
        .forEach((element) => {
            element.classList.remove("hint-source", "hint-target");
        });

    const hint = isKlondike()
        ? findKlondikeHint()
        : findSpiderHint();

    if (!hint) {
        showMessage("No visible legal move was found.");
        return;
    }

    showMessage(hint.message);

    if (hint.source) {
        document
            .querySelector(
                `[data-source-key="${CSS.escape(sourceKey(hint.source))}"]`
            )
            ?.classList.add("hint-source");
    }

    if (hint.destination) {
        document
            .querySelector(
                `[data-destination-key="${CSS.escape(destinationKey(hint.destination))}"]`
            )
            ?.classList.add("hint-target");
    }

    hintTimer = window.setTimeout(() => {
        document
            .querySelectorAll(".hint-source, .hint-target")
            .forEach((element) => {
                element.classList.remove("hint-source", "hint-target");
            });
    }, 1900);
}


newGameButton.addEventListener("click", startAnotherDeal);
overlayNewGameButton.addEventListener("click", startAnotherDeal);

undoButton.addEventListener("click", () => {
    performAction({ type: "undo" });
});

hintButton.addEventListener("click", showHint);

restartButton.addEventListener("click", () => {
    const confirmed = window.confirm(
        "Restart this exact deal from its original layout?"
    );

    if (confirmed) {
        performAction({ type: "restart" });
    }
});

abandonButton.addEventListener("click", () => {
    const confirmed = window.confirm(
        "Give up this deal? Competitive entry chips will not be returned."
    );

    if (confirmed) {
        performAction({ type: "abandon" });
    }
});

closeTableButton.addEventListener("click", async () => {
    const confirmed = window.confirm(
        activeGame()
            ? "Close this table and abandon the active deal?"
            : "Close this Solitaire table? Completed game history will remain on the leaderboards."
    );

    if (!confirmed || actionPending) {
        return;
    }

    actionPending = true;
    boardElement.classList.add("action-pending");
    showMessage("Closing the private table...");
    renderControls();

    try {
        const { error } = await window.supabaseClient.rpc(
            "close_solitaire_table",
            { p_table_id: tableId }
        );

        if (error) {
            throw error;
        }

        window.location.href = "poker.html";
    } catch (error) {
        console.error(error);
        showMessage(
            error.message || "The Solitaire table could not be closed.",
            true
        );
        actionPending = false;
        boardElement.classList.remove("action-pending");
        renderControls();
    }
});

dismissResultButton.addEventListener("click", () => {
    dismissedResultGameId = solitaireData?.game?.id ?? null;
    resultOverlay.classList.add("hidden");
});

window.addEventListener("resize", () => {
    if (solitaireData?.state) {
        renderState();
    }
});

window.addEventListener("beforeunload", () => {
    window.clearInterval(timerHandle);
    window.clearTimeout(hintTimer);
});


async function initialiseSolitaire() {
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
        await loadSolitaireState();

        timerHandle = window.setInterval(updateTimer, 1000);
    } catch (error) {
        console.error(error);
        boardElement.innerHTML = `
            <div class="solitaire-loading">
                ${error.message || "The Solitaire table could not be loaded."}
            </div>
        `;
        showMessage(
            error.message || "The Solitaire table could not be loaded.",
            true
        );
    }
}


initialiseSolitaire();
