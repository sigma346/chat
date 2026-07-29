const currentUsernameLabel =
    document.querySelector("#current-username");

const walletBalanceLabel =
    document.querySelector("#wallet-balance");

const activeMatchPanel =
    document.querySelector("#active-match-panel");

const activeMatchList =
    document.querySelector("#active-match-list");

const createGameForm =
    document.querySelector("#create-game-form");

const gameTypeInput =
    document.querySelector("#game-type-input");

const gameNameInput =
    document.querySelector("#game-name-input");

const pokerSettings =
    document.querySelector("#poker-settings");

const blackjackSettings =
    document.querySelector("#blackjack-settings");

const smallBlindInput =
    document.querySelector("#small-blind-input");

const bigBlindInput =
    document.querySelector("#big-blind-input");

const blackjackMinimumBetInput =
    document.querySelector("#blackjack-min-bet-input");

const blackjackMaximumBetInput =
    document.querySelector("#blackjack-max-bet-input");

const minimumBuyInInput =
    document.querySelector("#minimum-buy-in-input");

const maximumBuyInInput =
    document.querySelector("#maximum-buy-in-input");

const maximumPlayersInput =
    document.querySelector("#maximum-players-input");

const creatorBuyInInput =
    document.querySelector("#creator-buy-in-input");

const createGameButton =
    document.querySelector("#create-game-button");

const createGameMessage =
    document.querySelector("#create-game-message");

const gameList =
    document.querySelector("#game-list");

const gameListMessage =
    document.querySelector("#game-list-message");

const refreshGamesButton =
    document.querySelector("#refresh-games-button");

let currentUser = null;
let walletChips = 0;
let lobbyChannel = null;
let refreshTimer = null;
let loadingGames = false;


function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}


function showCreateMessage(message = "") {
    createGameMessage.textContent = message;
}


function showListMessage(message = "") {
    gameListMessage.textContent = message;
}


function gamePageFor(gameTable) {
    return gameTable.game_type === "blackjack"
        ? "blackjack-table.html"
        : "poker-table.html";
}


function gameLabel(gameType) {
    return gameType === "blackjack"
        ? "Blackjack"
        : "Texas Hold'em";
}


function rebuildPlayerOptions() {
    const blackjackSelected =
        gameTypeInput.value === "blackjack";

    const minimum = blackjackSelected ? 1 : 2;
    const maximum = blackjackSelected ? 7 : 9;
    const preferred = blackjackSelected ? 5 : 6;

    maximumPlayersInput.replaceChildren();

    for (
        let playerCount = minimum;
        playerCount <= maximum;
        playerCount += 1
    ) {
        const option = document.createElement("option");
        option.value = String(playerCount);
        option.textContent =
            `${playerCount} player${playerCount === 1 ? "" : "s"}`;

        if (playerCount === preferred) {
            option.selected = true;
        }

        maximumPlayersInput.append(option);
    }
}


function updateGameTypeFields() {
    const blackjackSelected =
        gameTypeInput.value === "blackjack";

    pokerSettings.classList.toggle(
        "hidden",
        blackjackSelected
    );

    blackjackSettings.classList.toggle(
        "hidden",
        !blackjackSelected
    );

    smallBlindInput.required = !blackjackSelected;
    bigBlindInput.required = !blackjackSelected;

    blackjackMinimumBetInput.required = blackjackSelected;
    blackjackMaximumBetInput.required = blackjackSelected;

    rebuildPlayerOptions();
}


function parseWholeNumber(input, fieldName) {
    const value = Number.parseInt(input.value, 10);

    if (!Number.isSafeInteger(value)) {
        throw new Error(`${fieldName} must be a whole number.`);
    }

    return value;
}


function createInformationItem(label, value) {
    const item = document.createElement("div");

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    const valueElement = document.createElement("strong");
    valueElement.textContent = value;

    item.append(labelElement, valueElement);
    return item;
}


function createGameCard(gameTable, seatsAtTable) {
    const currentSeat = seatsAtTable.find(
        (seat) => seat.user_id === currentUser.id
    );

    const gameIsFull =
        seatsAtTable.length >= Number(gameTable.max_players);

    const queuedCount = seatsAtTable.filter(
        (seat) => seat.queued_for_next_hand
    ).length;

    const card = document.createElement("article");
    card.className = "match-card";

    const heading = document.createElement("div");
    heading.className = "match-card-heading";

    const titleGroup = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = gameTable.name;

    const mode = document.createElement("span");
    mode.className = `game-type-badge ${gameTable.game_type}`;
    mode.textContent = gameLabel(gameTable.game_type);

    titleGroup.append(title, mode);

    const status = document.createElement("span");
    status.className =
        `match-status ${gameTable.status === "playing" ? "playing" : "waiting"}`;
    status.textContent =
        gameTable.status === "playing"
            ? "In progress"
            : "Waiting";

    heading.append(titleGroup, status);

    const information = document.createElement("div");
    information.className = "match-information";

    information.append(
        createInformationItem(
            "Seats",
            `${seatsAtTable.length}/${gameTable.max_players}`
        ),
        createInformationItem(
            "Buy-in",
            `${formatChips(gameTable.min_buy_in)}–${formatChips(gameTable.max_buy_in)}`
        )
    );

    if (gameTable.game_type === "blackjack") {
        information.append(
            createInformationItem(
                "Bet limits",
                `${formatChips(gameTable.blackjack_min_bet)}–${formatChips(gameTable.blackjack_max_bet)}`
            )
        );
    } else {
        information.append(
            createInformationItem(
                "Blinds",
                `${formatChips(gameTable.small_blind)} / ${formatChips(gameTable.big_blind)}`
            )
        );
    }

    if (gameTable.status === "playing") {
        information.append(
            createInformationItem(
                "Next round queue",
                `${queuedCount} player${queuedCount === 1 ? "" : "s"}`
            )
        );
    }

    const controls = document.createElement("div");
    controls.className = "match-card-controls";

    if (currentSeat) {
        const openButton = document.createElement("a");
        openButton.className = "button-link";
        openButton.href =
            `${gamePageFor(gameTable)}?id=${encodeURIComponent(gameTable.id)}`;
        openButton.textContent = currentSeat.queued_for_next_hand
            ? "Open queue"
            : "Open game";

        controls.append(openButton);
    } else {
        const buyInGroup = document.createElement("div");
        buyInGroup.className = "join-buy-in-group";

        const label = document.createElement("label");
        label.textContent = gameTable.status === "playing"
            ? "Next-round buy-in"
            : "Buy-in";

        const input = document.createElement("input");
        input.type = "number";
        input.min = gameTable.min_buy_in;
        input.max = gameTable.max_buy_in;
        input.step = "1";
        input.value = String(
            Math.min(
                Number(gameTable.max_buy_in),
                Math.max(
                    Number(gameTable.min_buy_in),
                    1000
                )
            )
        );

        buyInGroup.append(label, input);

        const joinButton = document.createElement("button");
        joinButton.type = "button";
        joinButton.textContent = gameTable.status === "playing"
            ? "Join next round"
            : "Join";

        if (gameIsFull) {
            joinButton.disabled = true;
            joinButton.textContent = "Full";
        }

        joinButton.addEventListener("click", async () => {
            const buyIn = Number.parseInt(input.value, 10);

            if (!Number.isSafeInteger(buyIn)) {
                showListMessage("Enter a valid whole-number buy-in.");
                return;
            }

            joinButton.disabled = true;
            showListMessage();

            try {
                const { error } = await window.supabaseClient.rpc(
                    "join_poker_table",
                    {
                        p_table_id: gameTable.id,
                        p_buy_in: buyIn
                    }
                );

                if (error) {
                    throw error;
                }

                window.location.href =
                    `${gamePageFor(gameTable)}?id=${encodeURIComponent(gameTable.id)}`;
            } catch (error) {
                console.error(error);
                showListMessage(
                    error.message || "The game could not be joined."
                );
                joinButton.disabled = false;
            }
        });

        controls.append(buyInGroup, joinButton);
    }

    card.append(heading, information, controls);
    return card;
}


function renderActiveGames(gameTables, seats) {
    const ownSeats = seats.filter(
        (seat) => seat.user_id === currentUser.id
    );

    activeMatchList.replaceChildren();

    if (ownSeats.length === 0) {
        activeMatchPanel.classList.add("hidden");
        return;
    }

    activeMatchPanel.classList.remove("hidden");

    for (const ownSeat of ownSeats) {
        const gameTable = gameTables.find(
            (table) => table.id === ownSeat.table_id
        );

        if (!gameTable) {
            continue;
        }

        const link = document.createElement("a");
        link.className = "active-match-link";
        link.href =
            `${gamePageFor(gameTable)}?id=${encodeURIComponent(gameTable.id)}`;

        const title = document.createElement("strong");
        title.textContent = gameTable.name;

        const details = document.createElement("span");
        const stateText = ownSeat.queued_for_next_hand
            ? "Queued for next round"
            : gameTable.status === "playing"
                ? "In progress"
                : "Waiting";

        details.textContent =
            `${gameLabel(gameTable.game_type)} · ${stateText} · ${formatChips(ownSeat.stack)} chips`;

        link.append(title, details);
        activeMatchList.append(link);
    }
}


function renderGameList(gameTables, seats) {
    gameList.replaceChildren();

    const availableGames = gameTables
        .filter(
            (table) =>
                table.status === "waiting"
                || table.status === "playing"
        )
        .sort((first, second) => {
            if (first.status !== second.status) {
                return first.status === "waiting" ? -1 : 1;
            }

            return first.name.localeCompare(second.name);
        });

    if (availableGames.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-match-list";
        empty.textContent = "There are no available card games.";
        gameList.append(empty);
        return;
    }

    for (const gameTable of availableGames) {
        const seatsAtTable = seats.filter(
            (seat) => seat.table_id === gameTable.id
        );

        gameList.append(
            createGameCard(gameTable, seatsAtTable)
        );
    }
}


async function loadGames() {
    if (loadingGames) {
        return;
    }

    loadingGames = true;
    refreshGamesButton.disabled = true;
    showListMessage();

    try {
        const [
            profileResult,
            tablesResult,
            seatsResult
        ] = await Promise.all([
            window.supabaseClient
                .from("profiles")
                .select("username, chips")
                .eq("id", currentUser.id)
                .single(),

            window.supabaseClient
                .from("poker_tables")
                .select(
                    "id, host_id, name, status, game_type, small_blind, big_blind, blackjack_min_bet, blackjack_max_bet, min_buy_in, max_buy_in, max_players, created_at"
                )
                .in("status", ["waiting", "playing"])
                .order("created_at", { ascending: false }),

            window.supabaseClient
                .from("poker_seats")
                .select(
                    "table_id, seat_number, user_id, stack, queued_for_next_hand"
                )
        ]);

        if (profileResult.error) {
            throw profileResult.error;
        }

        if (tablesResult.error) {
            throw tablesResult.error;
        }

        if (seatsResult.error) {
            throw seatsResult.error;
        }

        currentUsernameLabel.textContent =
            profileResult.data.username;

        walletChips = Number(profileResult.data.chips);
        walletBalanceLabel.textContent = formatChips(walletChips);

        const gameTables = tablesResult.data ?? [];
        const seats = seatsResult.data ?? [];

        renderActiveGames(gameTables, seats);
        renderGameList(gameTables, seats);
    } catch (error) {
        console.error(error);
        showListMessage(
            error.message || "The card-game lobby could not be loaded."
        );

        gameList.replaceChildren();

        const empty = document.createElement("p");
        empty.className = "empty-match-list";
        empty.textContent = "Games failed to load.";
        gameList.append(empty);
    } finally {
        loadingGames = false;
        refreshGamesButton.disabled = false;
    }
}


createGameForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    createGameButton.disabled = true;
    showCreateMessage();

    try {
        const gameType = gameTypeInput.value;
        const minimumBuyIn = parseWholeNumber(
            minimumBuyInInput,
            "Minimum buy-in"
        );
        const maximumBuyIn = parseWholeNumber(
            maximumBuyInInput,
            "Maximum buy-in"
        );
        const creatorBuyIn = parseWholeNumber(
            creatorBuyInInput,
            "Your buy-in"
        );
        const maximumPlayers = parseWholeNumber(
            maximumPlayersInput,
            "Maximum players"
        );

        const smallBlind = gameType === "poker"
            ? parseWholeNumber(smallBlindInput, "Small blind")
            : 1;

        const bigBlind = gameType === "poker"
            ? parseWholeNumber(bigBlindInput, "Big blind")
            : 2;

        const blackjackMinimumBet = gameType === "blackjack"
            ? parseWholeNumber(
                blackjackMinimumBetInput,
                "Minimum Blackjack bet"
            )
            : 0;

        const blackjackMaximumBet = gameType === "blackjack"
            ? parseWholeNumber(
                blackjackMaximumBetInput,
                "Maximum Blackjack bet"
            )
            : 0;

        const { data: tableId, error } =
            await window.supabaseClient.rpc(
                "create_game_table",
                {
                    p_game_type: gameType,
                    p_name: gameNameInput.value,
                    p_small_blind: smallBlind,
                    p_big_blind: bigBlind,
                    p_blackjack_min_bet: blackjackMinimumBet,
                    p_blackjack_max_bet: blackjackMaximumBet,
                    p_min_buy_in: minimumBuyIn,
                    p_max_buy_in: maximumBuyIn,
                    p_max_players: maximumPlayers,
                    p_buy_in: creatorBuyIn
                }
            );

        if (error) {
            throw error;
        }

        const page = gameType === "blackjack"
            ? "blackjack-table.html"
            : "poker-table.html";

        window.location.href =
            `${page}?id=${encodeURIComponent(tableId)}`;
    } catch (error) {
        console.error(error);
        showCreateMessage(
            error.message || "The game could not be created."
        );
        createGameButton.disabled = false;
    }
});


gameTypeInput.addEventListener(
    "change",
    updateGameTypeFields
);

refreshGamesButton.addEventListener(
    "click",
    loadGames
);


function scheduleLobbyRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(loadGames, 150);
}


function subscribeToLobby() {
    lobbyChannel = window.supabaseClient
        .channel("card-game-lobby")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "poker_tables"
            },
            scheduleLobbyRefresh
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "poker_seats"
            },
            scheduleLobbyRefresh
        )
        .subscribe();
}


window.addEventListener("beforeunload", () => {
    if (lobbyChannel) {
        window.supabaseClient.removeChannel(lobbyChannel);
    }
});


async function initialiseLobby() {
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
        updateGameTypeFields();
        await loadGames();
        subscribeToLobby();
    } catch (error) {
        console.error(error);
        showListMessage(
            error.message || "The card-game lobby could not start."
        );
    }
}


initialiseLobby();
