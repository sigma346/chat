const adminGameState = {
    games: [],
    loading: false,
    tickTimer: null,
    refreshTimer: null
};

const gameTypeLabels = {
    poker: "Texas Hold'em",
    blackjack: "Blackjack",
    five_card_draw: "Five Card Draw",
    hearts: "Hearts",
    shithead: "Shithead",
    penguin_cross: "Penguin Cross",
    solitaire_klondike: "Klondike Solitaire",
    solitaire_spider: "Spider Solitaire"
};

const gamePageByType = {
    poker: "poker-table.html",
    blackjack: "blackjack-table.html",
    five_card_draw: "five-card-draw-table.html",
    hearts: "hearts-table.html",
    shithead: "shithead-table.html",
    penguin_cross: "penguin-cross.html",
    solitaire_klondike: "solitaire-table.html",
    solitaire_spider: "solitaire-table.html"
};

const gamesTable = document.querySelector("#games-table");
const gamesTableBody = document.querySelector("#games-table-body");
const gamesLoading = document.querySelector("#games-loading");
const gamesEmpty = document.querySelector("#games-empty");
const gameSearchInput = document.querySelector("#game-search-input");
const gameTypeFilter = document.querySelector("#game-type-filter");
const gameStatusFilter = document.querySelector("#game-status-filter");
const refreshGamesButton = document.querySelector("#refresh-games-button");
const runCleanupButton = document.querySelector("#run-cleanup-button");
const gameAdminMessage = document.querySelector("#game-admin-message");
const closeGameDialog = document.querySelector("#close-game-dialog");
const closeGameForm = document.querySelector("#close-game-form");

function showGameAdminMessage(message, tone = "success") {
    gameAdminMessage.textContent = message;
    gameAdminMessage.dataset.tone = tone;
    gameAdminMessage.hidden = !message;
}

function formatDate(value, fallback = "Unknown") {
    if (!value) return fallback;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;

    return date.toLocaleString();
}

function formatDuration(seconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));

    if (safeSeconds < 60) return `${safeSeconds}s`;

    const minutes = Math.floor(safeSeconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours < 24) {
        return remainingMinutes > 0
            ? `${hours}h ${remainingMinutes}m`
            : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    return remainingHours > 0
        ? `${days}d ${remainingHours}h`
        : `${days}d`;
}

function secondsUntil(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 0;
    return Math.floor((date.getTime() - Date.now()) / 1000);
}

function formatAutoClose(value) {
    const remaining = secondsUntil(value);

    if (remaining <= 0) {
        return {
            text: "Due for cleanup",
            className: "overdue"
        };
    }

    return {
        text: `in ${formatDuration(remaining)}`,
        className: remaining <= 6 * 60 * 60 ? "soon" : ""
    };
}

function filteredGames() {
    const query = gameSearchInput.value.trim().toLowerCase();
    const type = gameTypeFilter.value;
    const status = gameStatusFilter.value;

    return adminGameState.games.filter((game) => {
        const matchesQuery = !query
            || String(game.game_name || "").toLowerCase().includes(query)
            || String(game.host_username || "").toLowerCase().includes(query);

        return matchesQuery
            && (type === "all" || game.game_type === type)
            && (status === "all" || game.game_status === status);
    });
}

function makeCell() {
    return document.createElement("td");
}

function gameUrl(game) {
    const page = gamePageByType[game.game_type] || "poker.html";
    return `${page}?id=${encodeURIComponent(game.table_id)}`;
}

function openCloseDialog(game) {
    document.querySelector("#close-game-id").value = game.table_id;
    document.querySelector("#close-game-name").textContent = game.game_name;
    document.querySelector("#close-game-reason").value =
        "Closed by an administrator.";
    closeGameDialog.showModal();
    document.querySelector("#close-game-reason").focus();
}

function buildGameRow(game) {
    const row = document.createElement("tr");
    row.dataset.tableId = game.table_id;

    const identityCell = makeCell();
    const identity = document.createElement("div");
    identity.className = "game-identity";

    const name = document.createElement("strong");
    name.textContent = game.game_name;

    const type = document.createElement("small");
    type.textContent = `${gameTypeLabels[game.game_type] || game.game_type}${
        game.friendly_mode ? " · Friendly" : ""
    }`;

    identity.append(name, type);
    identityCell.append(identity);

    const hostCell = makeCell();
    hostCell.textContent = game.host_username || "Unknown";

    const playersCell = makeCell();
    const humanPlayers = Number(game.human_players || 0);
    const botPlayers = Number(game.bot_players || 0);
    playersCell.textContent = botPlayers > 0
        ? `${humanPlayers} human · ${botPlayers} bot${botPlayers === 1 ? "" : "s"}`
        : `${humanPlayers} human${humanPlayers === 1 ? "" : "s"}`;

    const statusCell = makeCell();
    const statusPill = document.createElement("span");
    statusPill.className = `game-status-pill ${game.game_status}`;
    statusPill.textContent = game.game_status;
    statusCell.append(statusPill);

    const activityCell = makeCell();
    const inactive = document.createElement("strong");
    inactive.textContent = `${formatDuration(game.inactive_seconds)} ago`;
    const activityDate = document.createElement("div");
    activityDate.className = "game-time-detail";
    activityDate.textContent = formatDate(game.last_activity_at);
    activityCell.append(inactive, activityDate);

    const autoCloseCell = makeCell();
    const autoClose = document.createElement("span");
    const autoCloseState = formatAutoClose(game.auto_close_at);
    autoClose.className = `game-auto-close ${autoCloseState.className}`.trim();
    autoClose.textContent = autoCloseState.text;
    autoClose.dataset.autoCloseAt = game.auto_close_at;
    autoCloseCell.append(autoClose);

    const actionsCell = makeCell();
    const actions = document.createElement("div");
    actions.className = "game-actions";

    const viewLink = document.createElement("a");
    viewLink.href = gameUrl(game);
    viewLink.textContent = "View";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "danger-button";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => openCloseDialog(game));

    actions.append(viewLink, closeButton);
    actionsCell.append(actions);

    row.append(
        identityCell,
        hostCell,
        playersCell,
        statusCell,
        activityCell,
        autoCloseCell,
        actionsCell
    );

    return row;
}

function renderGames() {
    gamesTableBody.replaceChildren();

    const games = filteredGames();

    for (const game of games) {
        gamesTableBody.append(buildGameRow(game));
    }

    gamesLoading.hidden = true;
    gamesTable.hidden = games.length === 0;
    gamesEmpty.hidden = games.length !== 0;

    const all = adminGameState.games;
    const now = Date.now();

    document.querySelector("#open-game-count").textContent = all.length;
    document.querySelector("#playing-game-count").textContent =
        all.filter((game) => game.game_status === "playing").length;
    document.querySelector("#waiting-game-count").textContent =
        all.filter((game) => game.game_status === "waiting").length;
    document.querySelector("#closing-soon-count").textContent =
        all.filter((game) => {
            const autoClose = new Date(game.auto_close_at).getTime();
            return Number.isFinite(autoClose)
                && autoClose > now
                && autoClose - now <= 6 * 60 * 60 * 1000;
        }).length;
}

function updateVisibleCountdowns() {
    document.querySelectorAll("[data-auto-close-at]").forEach((element) => {
        const state = formatAutoClose(element.dataset.autoCloseAt);
        element.textContent = state.text;
        element.className = `game-auto-close ${state.className}`.trim();
    });
}

async function loadGames({ keepMessage = false } = {}) {
    if (adminGameState.loading) return;

    adminGameState.loading = true;
    refreshGamesButton.disabled = true;
    gamesLoading.hidden = false;

    if (!keepMessage) {
        showGameAdminMessage("");
    }

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "get_admin_active_games"
        );

        if (error) throw error;

        adminGameState.games = Array.isArray(data) ? data : [];
        renderGames();
    } catch (error) {
        gamesLoading.hidden = true;
        showGameAdminMessage(
            error.message || "Active games could not be loaded.",
            "error"
        );

        if (/administrator access|required|jwt|not authenticated/i.test(error.message || "")) {
            window.setTimeout(() => {
                window.location.replace("index.html");
            }, 1600);
        }
    } finally {
        adminGameState.loading = false;
        refreshGamesButton.disabled = false;
    }
}

async function runCleanup() {
    if (runCleanupButton.disabled) return;

    runCleanupButton.disabled = true;
    showGameAdminMessage("Checking for inactive games…");

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "admin_run_inactive_game_cleanup"
        );

        if (error) throw error;

        const count = Number(data || 0);
        showGameAdminMessage(
            count === 0
                ? "No games have passed the 48-hour inactivity limit."
                : `Closed ${count} inactive game${count === 1 ? "" : "s"}.`
        );

        await loadGames({ keepMessage: true });
    } catch (error) {
        showGameAdminMessage(
            error.message || "Inactivity cleanup failed.",
            "error"
        );
    } finally {
        runCleanupButton.disabled = false;
    }
}

closeGameForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const tableId = document.querySelector("#close-game-id").value;
    const reason = document.querySelector("#close-game-reason").value.trim();
    const button = document.querySelector("#confirm-close-game-button");

    if (!tableId || reason.length < 3) return;

    button.disabled = true;

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "admin_close_game",
            {
                p_game_id: tableId,
                p_reason: reason
            }
        );

        if (error) throw error;

        closeGameDialog.close();

        if (data?.already_closed) {
            showGameAdminMessage("That game was already closed.");
        } else {
            const refundedPlayers = Number(data?.refunded_players || 0);
            const refundedChips = Number(data?.refunded_chips || 0);
            const refundText = refundedPlayers > 0
                ? ` Refunded ${refundedChips.toLocaleString()} chips to ${refundedPlayers} player${refundedPlayers === 1 ? "" : "s"}.`
                : "";

            showGameAdminMessage(
                `${data?.name || "Game"} was closed.${refundText}`
            );
        }

        await loadGames({ keepMessage: true });
    } catch (error) {
        showGameAdminMessage(
            error.message || "The game could not be closed.",
            "error"
        );
    } finally {
        button.disabled = false;
    }
});

document.querySelector("#cancel-close-game-button").addEventListener(
    "click",
    () => closeGameDialog.close()
);

document.querySelector("#close-game-dialog-x").addEventListener(
    "click",
    () => closeGameDialog.close()
);

closeGameDialog.addEventListener("click", (event) => {
    if (event.target === closeGameDialog) {
        closeGameDialog.close();
    }
});

refreshGamesButton.addEventListener("click", () => loadGames());
runCleanupButton.addEventListener("click", runCleanup);
gameSearchInput.addEventListener("input", renderGames);
gameTypeFilter.addEventListener("change", renderGames);
gameStatusFilter.addEventListener("change", renderGames);

adminGameState.tickTimer = window.setInterval(updateVisibleCountdowns, 1000);
adminGameState.refreshTimer = window.setInterval(
    () => loadGames({ keepMessage: true }),
    30000
);

window.addEventListener("pagehide", () => {
    window.clearInterval(adminGameState.tickTimer);
    window.clearInterval(adminGameState.refreshTimer);
});

loadGames();
