const walletLabel = document.querySelector("#penguin-wallet");
const setupPanel = document.querySelector("#penguin-setup-panel");
const gamePanel = document.querySelector("#penguin-game-panel");
const resultPanel = document.querySelector("#penguin-result-panel");
const betInput = document.querySelector("#penguin-bet-input");
const startButton = document.querySelector("#start-penguin-button");
const stepButton = document.querySelector("#penguin-step-button");
const cashoutButton = document.querySelector("#penguin-cashout-button");
const playAgainButton = document.querySelector("#penguin-play-again-button");
const refreshButton = document.querySelector("#penguin-refresh-button");
const iceTrack = document.querySelector("#penguin-ice-track");
const crossingStage = document.querySelector("#penguin-crossing-stage");
const splash = document.querySelector("#penguin-splash");
const gameTitle = document.querySelector("#penguin-game-title");
const actionText = document.querySelector("#penguin-action-text");
const currentBet = document.querySelector("#penguin-current-bet");
const currentMultiplier = document.querySelector("#penguin-current-multiplier");
const currentCashout = document.querySelector("#penguin-current-cashout");
const multiplierGrid = document.querySelector("#penguin-multiplier-grid");
const historyList = document.querySelector("#penguin-history-list");
const messageElement = document.querySelector("#penguin-message");
const resultIcon = document.querySelector("#penguin-result-icon");
const resultKicker = document.querySelector("#penguin-result-kicker");
const resultTitle = document.querySelector("#penguin-result-title");
const resultDescription = document.querySelector("#penguin-result-description");

let penguinState = null;
let currentUser = null;
let requestInProgress = false;
let lastOutcome = null;

function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(Number(value ?? 0));
}

function formatMultiplier(bps) {
    return `${(Number(bps ?? 10000) / 10000).toFixed(4)}×`;
}

function formatDate(value) {
    if (!value) {
        return "Unknown time";
    }

    return new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}

function showMessage(message = "", type = "error") {
    messageElement.textContent = message;
    messageElement.className = `form-message ${type}`.trim();
}

function setBusy(busy) {
    requestInProgress = busy;
    startButton.disabled = busy;
    refreshButton.disabled = busy;

    const game = penguinState?.active_game;
    stepButton.disabled = busy || !game;
    cashoutButton.disabled = busy || !game || Number(game.current_step) < 1;
}

function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function tileForStep(step) {
    return iceTrack.querySelector(`[data-step="${Number(step)}"]`);
}

function createPenguinMarker() {
    const marker = document.createElement("span");
    marker.className = "penguin-marker";
    marker.setAttribute("aria-label", "Penguin");
    marker.textContent = "🐧";
    return marker;
}

function renderMultiplierGrid() {
    multiplierGrid.replaceChildren();

    const multipliers = Array.isArray(penguinState?.multipliers)
        ? penguinState.multipliers
        : [];

    for (const item of multipliers) {
        const card = document.createElement("div");
        card.className = "penguin-multiplier-card";

        const step = document.createElement("span");
        step.textContent = `Step ${Number(item.step)}`;

        const multiplier = document.createElement("strong");
        multiplier.textContent = formatMultiplier(item.multiplier_bps);

        const chance = document.createElement("small");
        chance.textContent = `${Number(item.survival_percent).toFixed(2)}% reach chance`;

        card.append(step, multiplier, chance);
        multiplierGrid.append(card);
    }
}

function renderIceTrack(game) {
    iceTrack.replaceChildren();
    crossingStage
        .querySelectorAll(".penguin-at-start")
        .forEach((element) => element.remove());

    const stepNow = Number(game?.current_step ?? 0);
    const multipliers = Array.isArray(penguinState?.multipliers)
        ? penguinState.multipliers
        : [];

    for (let step = 1; step <= 10; step += 1) {
        const multiplier = multipliers.find(
            (item) => Number(item.step) === step
        );

        const tile = document.createElement("div");
        tile.className = "penguin-ice-tile";
        tile.dataset.step = String(step);

        if (step <= stepNow) {
            tile.classList.add("crossed");
        } else if (step === stepNow + 1) {
            tile.classList.add("next-tile");
        }

        const number = document.createElement("span");
        number.className = "ice-tile-number";
        number.textContent = String(step);

        const value = document.createElement("small");
        value.textContent = multiplier
            ? formatMultiplier(multiplier.multiplier_bps)
            : "";

        tile.append(number, value);

        if (step === stepNow && stepNow > 0) {
            tile.append(createPenguinMarker());
        }

        iceTrack.append(tile);
    }

    if (stepNow === 0) {
        const marker = createPenguinMarker();
        marker.classList.add("penguin-at-start");
        crossingStage.append(marker);
    } else {
        crossingStage
            .querySelectorAll(".penguin-at-start")
            .forEach((element) => element.remove());
    }
}

function renderActiveGame() {
    const game = penguinState?.active_game;

    setupPanel.classList.toggle("hidden", Boolean(game));
    gamePanel.classList.toggle("hidden", !game);

    if (!game) {
        return;
    }

    gameTitle.textContent = `Step ${Number(game.current_step)} of 10`;
    actionText.textContent = game.last_action || "Choose the next move.";
    currentBet.textContent = `${formatChips(game.bet)} chips`;
    currentMultiplier.textContent = formatMultiplier(game.current_multiplier_bps);
    currentCashout.textContent = Number(game.current_step) > 0
        ? `≈ ${formatChips(game.cashout_value)} chips`
        : "Take one step";

    renderIceTrack(game);
    stepButton.textContent = Number(game.current_step) === 9
        ? "Cross final tile"
        : "Take next step";

    cashoutButton.textContent = Number(game.current_step) > 0
        ? `Cash out ≈ ${formatChips(game.cashout_value)}`
        : "Cash out";
}

function historyStatus(game) {
    if (game.status === "broken") {
        return `Ice broke on tile ${Number(game.failed_step)}`;
    }

    if (Number(game.steps) === 10) {
        return "Crossed all ten tiles";
    }

    return `Cashed out after ${Number(game.steps)} steps`;
}

function renderHistory() {
    historyList.replaceChildren();

    const games = Array.isArray(penguinState?.recent_games)
        ? penguinState.recent_games
        : [];

    if (!games.length) {
        const empty = document.createElement("p");
        empty.className = "penguin-history-empty";
        empty.textContent = "No completed crossings yet.";
        historyList.append(empty);
        return;
    }

    for (const game of games) {
        const row = document.createElement("article");
        row.className = "penguin-history-row";

        const summary = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = historyStatus(game);
        const date = document.createElement("span");
        date.textContent = formatDate(game.completed_at ?? game.started_at);
        summary.append(title, date);

        const stake = document.createElement("div");
        stake.className = "history-stat";
        stake.innerHTML = `<span>Bet</span><strong>${formatChips(game.bet)}</strong>`;

        const payout = document.createElement("div");
        payout.className = "history-stat";
        payout.innerHTML = `<span>Return</span><strong>${formatChips(game.payout)}</strong>`;

        const profitValue = Number(game.profit ?? 0);
        const profit = document.createElement("div");
        profit.className = `history-stat history-profit ${
            profitValue > 0 ? "positive" : profitValue < 0 ? "negative" : "neutral"
        }`;
        profit.innerHTML = `<span>Profit</span><strong>${
            profitValue > 0 ? "+" : ""
        }${formatChips(profitValue)}</strong>`;

        row.append(summary, stake, payout, profit);
        historyList.append(row);
    }
}

function renderResult() {
    if (!lastOutcome || penguinState?.active_game) {
        resultPanel.classList.add("hidden");
        return;
    }

    resultPanel.classList.remove("hidden", "result-win", "result-loss");

    if (lastOutcome.type === "broken") {
        resultPanel.classList.add("result-loss");
        resultIcon.textContent = "🌊";
        resultKicker.textContent = "ICE BROKE";
        resultTitle.textContent = `Lost on tile ${Number(lastOutcome.step)}`;
        resultDescription.textContent = "The crossing ended and the entry bet was lost.";
        return;
    }

    if (lastOutcome.type === "cashed_out" || lastOutcome.auto_cashout) {
        resultPanel.classList.add("result-win");
        resultIcon.textContent = Number(lastOutcome.step) === 10 ? "🏁" : "🐧";
        resultKicker.textContent = Number(lastOutcome.step) === 10
            ? "FULL CROSSING"
            : "CASHED OUT";
        resultTitle.textContent = `${formatChips(lastOutcome.payout)} chips returned`;
        resultDescription.textContent = Number(lastOutcome.step) === 10
            ? "The penguin crossed every ice tile and cashed out automatically."
            : `You stopped safely after ${Number(lastOutcome.step)} steps.`;
        return;
    }

    resultPanel.classList.add("hidden");
}

function renderState() {
    walletLabel.textContent = `${formatChips(penguinState?.wallet_chips)} chips`;
    renderMultiplierGrid();
    renderActiveGame();
    renderHistory();
    renderResult();
    setBusy(false);
}

async function animateSafeStep(step) {
    const tile = tileForStep(step);
    if (!tile) {
        return;
    }

    tile.classList.add("landing-tile");
    const marker = createPenguinMarker();
    marker.classList.add("penguin-hop");
    tile.append(marker);
    await delay(720);
}

async function animateBrokenStep(step) {
    const tile = tileForStep(step);
    if (!tile) {
        return;
    }

    tile.classList.add("breaking-tile");
    const marker = createPenguinMarker();
    marker.classList.add("penguin-fall");
    tile.append(marker);

    const tileRect = tile.getBoundingClientRect();
    const stageRect = crossingStage.getBoundingClientRect();
    splash.style.left = `${tileRect.left - stageRect.left + tileRect.width / 2}px`;
    splash.classList.add("show");

    await delay(1050);
    splash.classList.remove("show");
}

async function loadState() {
    showMessage("");
    setBusy(true);

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "get_penguin_cross_state"
        );

        if (error) {
            throw error;
        }

        penguinState = data;
        renderState();
    } catch (error) {
        showMessage(error.message);
        setBusy(false);
    }
}

async function runAction(functionName, parameters = {}) {
    if (requestInProgress) {
        return null;
    }

    showMessage("");
    setBusy(true);

    try {
        const { data, error } = await window.supabaseClient.rpc(
            functionName,
            parameters
        );

        if (error) {
            throw error;
        }

        return data;
    } catch (error) {
        showMessage(error.message);
        setBusy(false);
        return null;
    }
}

async function startGame() {
    const bet = Number(betInput.value);

    if (!Number.isSafeInteger(bet) || bet < 10 || bet > 5000) {
        showMessage("Enter a whole-chip bet from 10 to 5,000.");
        return;
    }

    const response = await runAction("start_penguin_cross", {
        p_bet: bet
    });

    if (!response) {
        return;
    }

    lastOutcome = null;
    penguinState = response.state;
    renderState();

    gamePanel.classList.add("game-entering");
    window.setTimeout(() => gamePanel.classList.remove("game-entering"), 700);
}

async function takeStep() {
    const game = penguinState?.active_game;
    if (!game) {
        return;
    }

    const nextStep = Number(game.current_step) + 1;
    const response = await runAction("take_penguin_cross_step", {
        p_game_id: game.id
    });

    if (!response) {
        return;
    }

    lastOutcome = response.outcome;

    if (response.outcome.safe) {
        await animateSafeStep(nextStep);
    } else {
        await animateBrokenStep(nextStep);
    }

    penguinState = response.state;
    renderState();
}

async function cashOut() {
    const game = penguinState?.active_game;
    if (!game || Number(game.current_step) < 1) {
        return;
    }

    const response = await runAction("cash_out_penguin_cross", {
        p_game_id: game.id
    });

    if (!response) {
        return;
    }

    lastOutcome = response.outcome;
    penguinState = response.state;
    renderState();

    resultPanel.classList.add("result-pop");
    window.setTimeout(() => resultPanel.classList.remove("result-pop"), 850);
}

async function initialisePenguinCross() {
    const {
        data: { user },
        error
    } = await window.supabaseClient.auth.getUser();

    if (error) {
        showMessage(error.message);
        return;
    }

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    await loadState();
}

startButton.addEventListener("click", startGame);
stepButton.addEventListener("click", takeStep);
cashoutButton.addEventListener("click", cashOut);
refreshButton.addEventListener("click", loadState);

playAgainButton.addEventListener("click", () => {
    lastOutcome = null;
    resultPanel.classList.add("hidden");
    setupPanel.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.querySelectorAll("[data-bet]").forEach((button) => {
    button.addEventListener("click", () => {
        betInput.value = button.dataset.bet;
    });
});

betInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        startGame();
    }
});

initialisePenguinCross();
