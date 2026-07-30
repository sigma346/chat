const leaderboardBody = document.querySelector("#leaderboard-body");
const leaderboardTitle = document.querySelector("#leaderboard-title");
const leaderboardKicker = document.querySelector("#leaderboard-kicker");
const leaderboardDescription = document.querySelector(
    "#leaderboard-description"
);
const leaderboardUpdatedAt = document.querySelector(
    "#leaderboard-updated-at"
);
const leaderboardMessage = document.querySelector(
    "#leaderboard-message"
);
const valueColumnHeading = document.querySelector(
    "#value-column-heading"
);
const playsColumnHeading = document.querySelector(
    "#plays-column-heading"
);
const refreshButton = document.querySelector(
    "#refresh-leaderboard-button"
);

const leaderboardDefinitions = {
    chips: {
        title: "Total chips",
        kicker: "COMPETITIVE BANKROLL",
        valueHeading: "Total chips",
        description:
            "Wallet chips plus chips held in competitive card games, including chips committed to active hands."
    },
    poker: {
        title: "Texas Hold'em profit",
        kicker: "LIFETIME GAME PROFIT",
        valueHeading: "Profit",
        description:
            "Total payouts minus chips committed across completed competitive Hold'em hands."
    },
    five_card_draw: {
        title: "Five-Card Draw profit",
        kicker: "LIFETIME GAME PROFIT",
        valueHeading: "Profit",
        description:
            "Total payouts minus chips committed across completed competitive Draw hands."
    },
    blackjack: {
        title: "Blackjack profit",
        kicker: "LIFETIME GAME PROFIT",
        valueHeading: "Profit",
        description:
            "Total Blackjack returns minus bets across completed competitive rounds."
    },
    hearts: {
        title: "Hearts profit",
        kicker: "LIFETIME GAME PROFIT",
        valueHeading: "Profit",
        description:
            "Net entry-stake profit from completed competitive Hearts matches."
    },
    solitaire_klondike: {
        title: "Klondike Solitaire profit",
        kicker: "LIFETIME GAME PROFIT",
        valueHeading: "Profit",
        description:
            "Win returns minus entry fees across completed competitive Klondike deals."
    },
    solitaire_spider: {
        title: "Spider Solitaire profit",
        kicker: "LIFETIME GAME PROFIT",
        valueHeading: "Profit",
        description:
            "Win returns minus entry fees across completed competitive Spider deals."
    },
    recovery: {
        title: "Asteroid Salvage earnings",
        kicker: "LIFETIME GAME EARNINGS",
        valueHeading: "Earnings",
        description:
            "Total chips earned from successful Asteroid Salvage recovery runs."
    },
    plinko: {
        title: "Plinko profit",
        kicker: "LIFETIME GAME PROFIT",
        valueHeading: "Profit",
        description:
            "Total Plinko payouts minus all Plinko bets."
    },
    penguin_cross: {
        title: "Penguin Cross profit",
        kicker: "LIFETIME GAME PROFIT",
        valueHeading: "Profit",
        description:
            "Total Penguin Cross cash-out returns minus entry bets across completed crossings."
    },
    horse_racing: {
        title: "Horse Racing profit",
        kicker: "LIFETIME GAME PROFIT",
        valueHeading: "Profit",
        description:
            "Total global horse-race payouts minus all horse-race bets."
    },
    roulette: {
        title: "Roulette profit",
        kicker: "LIFETIME GAME PROFIT",
        valueHeading: "Profit",
        description:
            "Total Community Roulette payouts minus all submitted bet slips."
    }
};

let currentUser = null;
let selectedLeaderboard = "chips";
let refreshInterval = null;


function formatChips(value, signed = false) {
    const amount = Number(value ?? 0);
    const formatted = new Intl.NumberFormat("en-AU").format(
        Math.abs(amount)
    );

    if (!signed) {
        return formatted;
    }

    if (amount > 0) {
        return `+${formatted}`;
    }

    if (amount < 0) {
        return `−${formatted}`;
    }

    return "0";
}


function rankLabel(rank) {
    const numericRank = Number(rank);

    if (numericRank === 1) {
        return "1st";
    }

    if (numericRank === 2) {
        return "2nd";
    }

    if (numericRank === 3) {
        return "3rd";
    }

    return `${numericRank}th`;
}


function setLoading() {
    leaderboardBody.innerHTML = `
        <tr>
            <td colspan="5" class="leaderboard-empty">
                Loading leaderboard...
            </td>
        </tr>
    `;
}


function setError(message) {
    leaderboardBody.innerHTML = `
        <tr>
            <td colspan="5" class="leaderboard-empty leaderboard-error">
                ${message}
            </td>
        </tr>
    `;
}


function renderRows(rows) {
    leaderboardBody.replaceChildren();

    if (!rows.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.className = "leaderboard-empty";
        cell.textContent = "No completed games have been recorded yet.";
        row.append(cell);
        leaderboardBody.append(row);
        return;
    }

    const profitMode = selectedLeaderboard !== "chips";

    for (const item of rows) {
        const row = document.createElement("tr");

        if (item.user_id === currentUser.id) {
            row.classList.add("current-player-row");
        }

        const rankCell = document.createElement("td");
        const rankBadge = document.createElement("span");
        rankBadge.className = `leaderboard-rank rank-${Number(item.rank)}`;
        rankBadge.textContent = rankLabel(item.rank);
        rankCell.append(rankBadge);

        const playerCell = document.createElement("td");
        const player = document.createElement("div");
        player.className = "leaderboard-player";

        const username = document.createElement("strong");
        username.textContent = item.username;

        const ownLabel = document.createElement("span");
        ownLabel.textContent = item.user_id === currentUser.id
            ? "You"
            : "Player";

        player.append(username, ownLabel);
        playerCell.append(player);

        const levelCell = document.createElement("td");
        const level = document.createElement("span");
        level.className = "leaderboard-level";
        level.textContent = `Lv. ${Number(item.level ?? 1)}`;
        levelCell.append(level);

        const valueCell = document.createElement("td");
        valueCell.className = "leaderboard-value";

        const rawValue = profitMode
            ? Number(item.profit ?? 0)
            : Number(item.total_chips ?? 0);

        valueCell.textContent = profitMode
            ? `${formatChips(rawValue, true)} chips`
            : `${formatChips(rawValue)} chips`;

        if (profitMode) {
            valueCell.classList.add(
                rawValue > 0
                    ? "positive"
                    : rawValue < 0
                        ? "negative"
                        : "neutral"
            );
        }

        row.append(rankCell, playerCell, levelCell, valueCell);

        const playsCell = document.createElement("td");
        playsCell.className = "leaderboard-plays";
        playsCell.textContent = formatChips(item.plays ?? 0);

        if (profitMode) {
            row.append(playsCell);
        }

        leaderboardBody.append(row);
    }
}


function updateHeading() {
    const definition = leaderboardDefinitions[selectedLeaderboard];
    const profitMode = selectedLeaderboard !== "chips";

    leaderboardTitle.textContent = definition.title;
    leaderboardKicker.textContent = definition.kicker;
    leaderboardDescription.textContent = definition.description;
    valueColumnHeading.textContent = definition.valueHeading;
    playsColumnHeading.classList.toggle("hidden", !profitMode);

    document
        .querySelectorAll(".leaderboard-tab")
        .forEach((button) => {
            const active =
                button.dataset.leaderboard === selectedLeaderboard;

            button.classList.toggle("active", active);
            button.setAttribute(
                "aria-selected",
                String(active)
            );
        });
}


async function loadLeaderboard() {
    setLoading();
    leaderboardMessage.textContent = "";
    refreshButton.disabled = true;

    try {
        let result;

        if (selectedLeaderboard === "chips") {
            result = await window.supabaseClient.rpc(
                "get_chip_leaderboard",
                {
                    p_limit: 50
                }
            );
        } else if (
            selectedLeaderboard === "solitaire_klondike"
            || selectedLeaderboard === "solitaire_spider"
        ) {
            result = await window.supabaseClient.rpc(
                "get_solitaire_profit_leaderboard",
                {
                    p_game: selectedLeaderboard === "solitaire_klondike"
                        ? "klondike"
                        : "spider",
                    p_limit: 50
                }
            );
        } else if (selectedLeaderboard === "penguin_cross") {
            result = await window.supabaseClient.rpc(
                "get_penguin_cross_profit_leaderboard",
                {
                    p_limit: 50
                }
            );
        } else {
            result = await window.supabaseClient.rpc(
                "get_game_profit_leaderboard",
                {
                    p_game: selectedLeaderboard,
                    p_limit: 50
                }
            );
        }

        if (result.error) {
            throw result.error;
        }

        renderRows(result.data ?? []);

        leaderboardUpdatedAt.textContent =
            `Updated ${new Intl.DateTimeFormat(
                "en-AU",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                }
            ).format(new Date())}`;
    } catch (error) {
        setError(error.message);
    } finally {
        refreshButton.disabled = false;
    }
}


function selectLeaderboard(value) {
    if (!leaderboardDefinitions[value]) {
        return;
    }

    selectedLeaderboard = value;
    updateHeading();
    loadLeaderboard();
}


async function initialiseLeaderboards() {
    const {
        data: { user },
        error
    } = await window.supabaseClient.auth.getUser();

    if (error) {
        setError(error.message);
        return;
    }

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    updateHeading();
    await loadLeaderboard();

    refreshInterval = window.setInterval(
        loadLeaderboard,
        30000
    );
}


document
    .querySelectorAll(".leaderboard-tab")
    .forEach((button) => {
        button.addEventListener("click", () => {
            selectLeaderboard(button.dataset.leaderboard);
        });
    });

refreshButton.addEventListener("click", loadLeaderboard);

window.addEventListener("beforeunload", () => {
    if (refreshInterval) {
        window.clearInterval(refreshInterval);
    }
});

initialiseLeaderboards();
