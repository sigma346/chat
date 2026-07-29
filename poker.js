const currentUsernameLabel =
    document.querySelector("#current-username");

const currentBalanceLabel =
    document.querySelector("#current-balance");

const activeMatchPanel =
    document.querySelector("#active-match-panel");

const activeMatchList =
    document.querySelector("#active-match-list");

const createMatchForm =
    document.querySelector("#create-match-form");

const createMatchButton =
    document.querySelector("#create-match-button");

const createMatchMessage =
    document.querySelector("#create-match-message");

const matchList =
    document.querySelector("#match-list");

const lobbyMessage =
    document.querySelector("#lobby-message");

const refreshMatchesButton =
    document.querySelector("#refresh-matches-button");

const logoutButton =
    document.querySelector("#logout-button");


let currentUser = null;
let currentProfile = null;

let activeTableIds = new Set();
let lobbyChannel = null;
let refreshTimer = null;


function formatChips(value) {
    return new Intl.NumberFormat("en-GB").format(value);
}


function showMessage(element, message = "", type = "error") {
    element.textContent = message;
    element.className =
        `form-message ${type}`.trim();
}


function readPositiveInteger(inputElement) {
    const value = Number.parseInt(
        inputElement.value,
        10
    );

    if (!Number.isSafeInteger(value) || value <= 0) {
        return null;
    }

    return value;
}


async function loadCurrentAccount() {
    const {
        data: {
            user
        },
        error: userError
    } = await window.supabaseClient.auth.getUser();


    if (userError || !user) {
        window.location.href = "login.html";
        return false;
    }


    currentUser = user;


    const {
        data: profile,
        error: profileError
    } = await window.supabaseClient
        .from("profiles")
        .select("id, username, chips")
        .eq("id", user.id)
        .maybeSingle();


    if (profileError) {
        throw profileError;
    }


    if (!profile) {
        throw new Error(
            "Your player profile could not be found."
        );
    }


    currentProfile = profile;

    currentUsernameLabel.textContent =
        profile.username;

    currentBalanceLabel.textContent =
        formatChips(profile.chips);

    return true;
}


async function refreshCurrentBalance() {
    const {
        data: profile,
        error
    } = await window.supabaseClient
        .from("profiles")
        .select("username, chips")
        .eq("id", currentUser.id)
        .maybeSingle();


    if (error) {
        throw error;
    }


    if (!profile) {
        return;
    }


    currentProfile = {
        ...currentProfile,
        ...profile
    };

    currentUsernameLabel.textContent =
        profile.username;

    currentBalanceLabel.textContent =
        formatChips(profile.chips);
}


function createMatchCard(
    pokerTable,
    seatsAtTable
) {
    const card = document.createElement("article");
    card.className = "match-card";


    const heading = document.createElement("div");
    heading.className = "match-card-heading";


    const headingText = document.createElement("div");


    const title = document.createElement("h3");
    title.textContent = pokerTable.name;


    const matchIsPlaying =
        pokerTable.status === "playing";


    const status =
        document.createElement("span");

    status.className =
        matchIsPlaying
            ? "match-status playing"
            : "match-status waiting";

    status.textContent =
        matchIsPlaying
            ? "In progress"
            : "Waiting";


    headingText.append(title);
    heading.append(headingText, status);


    const information = document.createElement("dl");
    information.className = "match-information";


    const queuedPlayerCount =
        seatsAtTable.filter(
            (seat) =>
                seat.queued_for_next_hand
        ).length;


    const informationItems = [
        [
            "Seats",
            `${seatsAtTable.length}/${pokerTable.max_players}`
        ],

        [
            "Blinds",
            `${formatChips(pokerTable.small_blind)} / ${formatChips(pokerTable.big_blind)}`
        ],

        [
            "Buy-in",
            `${formatChips(pokerTable.min_buy_in)}–${formatChips(pokerTable.max_buy_in)}`
        ]
    ];


    if (matchIsPlaying) {
        informationItems.push([
            "Next-hand queue",
            queuedPlayerCount === 1
                ? "1 player"
                : `${queuedPlayerCount} players`
        ]);
    }


    for (const [label, value] of informationItems) {
        const wrapper = document.createElement("div");

        const term = document.createElement("dt");
        term.textContent = label;

        const description =
            document.createElement("dd");

        description.textContent = value;

        wrapper.append(term, description);
        information.append(wrapper);
    }


    const actions = document.createElement("div");
    actions.className = "match-card-actions";


    const ownSeat = seatsAtTable.find(
        (seat) => seat.user_id === currentUser.id
    );


    if (ownSeat) {
        const openButton =
            document.createElement("button");

        openButton.type = "button";
        openButton.textContent = "Open match";

        openButton.addEventListener(
            "click",
            () => {
                window.location.href =
                    `poker-table.html?id=${encodeURIComponent(pokerTable.id)}`;
            }
        );

        actions.append(openButton);
    } else {
        const buyInWrapper =
            document.createElement("div");

        buyInWrapper.className =
            "join-buy-in-wrapper";


        const buyInLabel =
            document.createElement("label");

        buyInLabel.textContent =
            matchIsPlaying
                ? "Next-hand buy-in"
                : "Buy-in";


        const buyInInput =
            document.createElement("input");

        buyInInput.type = "number";
        buyInInput.min = pokerTable.min_buy_in;
        buyInInput.max = pokerTable.max_buy_in;
        buyInInput.step = "1";
        buyInInput.value = pokerTable.min_buy_in;


        const joinButton =
            document.createElement("button");

        joinButton.type = "button";

        joinButton.textContent =
            matchIsPlaying
                ? "Join next hand"
                : "Join";


        const tableIsFull =
            seatsAtTable.length >=
            pokerTable.max_players;


        if (tableIsFull) {
            joinButton.disabled = true;
            joinButton.textContent = "Full";
        }


        joinButton.addEventListener(
            "click",
            async () => {
                const buyIn =
                    readPositiveInteger(buyInInput);


                if (buyIn === null) {
                    showMessage(
                        lobbyMessage,
                        "Enter a valid whole-number buy-in."
                    );

                    return;
                }


                joinButton.disabled = true;
                showMessage(lobbyMessage);


                try {
                    const {
                        error
                    } = await window.supabaseClient
                        .rpc(
                            "join_poker_table",
                            {
                                p_table_id:
                                    pokerTable.id,

                                p_buy_in:
                                    buyIn
                            }
                        );


                    if (error) {
                        throw error;
                    }


                    window.location.href =
                        `poker-table.html?id=${encodeURIComponent(pokerTable.id)}`;

                } catch (error) {
                    console.error(error);

                    showMessage(
                        lobbyMessage,
                        error.message ||
                        "The match could not be joined."
                    );

                    joinButton.disabled = false;
                }
            }
        );


        buyInWrapper.append(
            buyInLabel,
            buyInInput
        );

        actions.append(
            buyInWrapper,
            joinButton
        );
    }


    card.append(
        heading,
        information,
        actions
    );

    return card;
}


async function loadMatches() {
    showMessage(lobbyMessage);


    const [
        tableResult,
        seatResult
    ] = await Promise.all([
        window.supabaseClient
            .from("poker_tables")
            .select(
                "id, host_id, name, small_blind, big_blind, min_buy_in, max_buy_in, max_players, status, created_at"
            )
            .in("status", [
                "waiting",
                "playing"
            ])
            .order("created_at", {
                ascending: false
            }),

        window.supabaseClient
            .from("poker_seats")
            .select(
                "table_id, seat_number, user_id, stack, queued_for_next_hand"
            )
    ]);


    if (tableResult.error) {
        throw tableResult.error;
    }


    if (seatResult.error) {
        throw seatResult.error;
    }


    const pokerTables =
        tableResult.data ?? [];

    const pokerSeats =
        seatResult.data ?? [];


    const ownSeats = pokerSeats.filter(
        (seat) => seat.user_id === currentUser.id
    );


    activeTableIds = new Set(
        ownSeats.map(
            (seat) => seat.table_id
        )
    );


    activeMatchList.replaceChildren();


    if (ownSeats.length === 0) {
        activeMatchPanel.classList.add("hidden");
    } else {
        activeMatchPanel.classList.remove("hidden");


        for (const ownSeat of ownSeats) {
            const activeTable =
                pokerTables.find(
                    (table) =>
                        table.id === ownSeat.table_id
                );


            if (!activeTable) {
                continue;
            }


            const link =
                document.createElement("a");

            link.className =
                "active-match-link";

            link.href =
                `poker-table.html?id=${encodeURIComponent(activeTable.id)}`;


            const name =
                document.createElement("strong");

            name.textContent =
                activeTable.name;


            const details =
                document.createElement("span");

            const matchStateText =
                ownSeat.queued_for_next_hand
                    ? "Queued for next hand"

                    : activeTable.status === "playing"
                        ? "In progress"
                        : "Waiting";


            details.textContent =
                `${matchStateText} · ${formatChips(ownSeat.stack)} chips`;


            link.append(
                name,
                details
            );


            activeMatchList.append(link);
        }
    }


    /*
        Creating another table is allowed, provided the account
        still has enough wallet chips.
    */

    createMatchButton.disabled = false;



    matchList.replaceChildren();


    const availableTables =
        pokerTables.filter(
            (table) =>
                table.status === "waiting"
                || table.status === "playing"
        );


    if (availableTables.length === 0) {
        const empty =
            document.createElement("p");

        empty.className = "empty-match-list";

        empty.textContent =
            "There are no available poker matches.";

        matchList.append(empty);

        return;
    }


    /*
        Waiting games appear first, followed by games that are
        already in progress.
    */

    availableTables.sort(
        (firstTable, secondTable) => {
            if (
                firstTable.status
                === secondTable.status
            ) {
                return 0;
            }

            return firstTable.status === "waiting"
                ? -1
                : 1;
        }
    );


    for (const pokerTable of availableTables) {
        const seatsAtTable =
            pokerSeats.filter(
                (seat) =>
                    seat.table_id === pokerTable.id
            );


        const card = createMatchCard(
            pokerTable,
            seatsAtTable
        );


        matchList.append(card);
    }
}


function scheduleLobbyRefresh() {
    window.clearTimeout(refreshTimer);

    refreshTimer = window.setTimeout(
        async () => {
            try {
                await Promise.all([
                    refreshCurrentBalance(),
                    loadMatches()
                ]);
            } catch (error) {
                console.error(error);
            }
        },
        150
    );
}


function subscribeToLobbyChanges() {
    lobbyChannel =
        window.supabaseClient
            .channel("poker-lobby-changes")

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


createMatchForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        showMessage(createMatchMessage);


        const name =
            document
                .querySelector("#match-name-input")
                .value
                .trim();


        const smallBlind =
            readPositiveInteger(
                document.querySelector(
                    "#small-blind-input"
                )
            );


        const bigBlind =
            readPositiveInteger(
                document.querySelector(
                    "#big-blind-input"
                )
            );


        const minimumBuyIn =
            readPositiveInteger(
                document.querySelector(
                    "#minimum-buy-in-input"
                )
            );


        const maximumBuyIn =
            readPositiveInteger(
                document.querySelector(
                    "#maximum-buy-in-input"
                )
            );


        const maximumPlayers =
            readPositiveInteger(
                document.querySelector(
                    "#maximum-players-input"
                )
            );


        const hostBuyIn =
            readPositiveInteger(
                document.querySelector(
                    "#host-buy-in-input"
                )
            );


        if (
            !name ||
            smallBlind === null ||
            bigBlind === null ||
            minimumBuyIn === null ||
            maximumBuyIn === null ||
            maximumPlayers === null ||
            hostBuyIn === null
        ) {
            showMessage(
                createMatchMessage,
                "Complete every field using valid whole numbers."
            );

            return;
        }


        createMatchButton.disabled = true;


        try {
            const {
                data: tableId,
                error
            } = await window.supabaseClient
                .rpc(
                    "create_poker_table",
                    {
                        p_name: name,
                        p_small_blind: smallBlind,
                        p_big_blind: bigBlind,
                        p_min_buy_in: minimumBuyIn,
                        p_max_buy_in: maximumBuyIn,
                        p_max_players: maximumPlayers,
                        p_buy_in: hostBuyIn
                    }
                );


            if (error) {
                throw error;
            }


            window.location.href =
                `poker-table.html?id=${encodeURIComponent(tableId)}`;

        } catch (error) {
            console.error(error);

            showMessage(
                createMatchMessage,
                error.message ||
                "The poker match could not be created."
            );

            createMatchButton.disabled = false;
        }
    }
);


refreshMatchesButton.addEventListener(
    "click",
    async () => {
        refreshMatchesButton.disabled = true;

        try {
            await Promise.all([
                refreshCurrentBalance(),
                loadMatches()
            ]);
        } catch (error) {
            console.error(error);

            showMessage(
                lobbyMessage,
                error.message ||
                "The lobby could not be refreshed."
            );
        } finally {
            refreshMatchesButton.disabled = false;
        }
    }
);


logoutButton.addEventListener(
    "click",
    async () => {
        await window.supabaseClient.auth.signOut({
            scope: "local"
        });

        window.location.href = "login.html";
    }
);


window.addEventListener(
    "beforeunload",
    () => {
        if (lobbyChannel) {
            window.supabaseClient.removeChannel(
                lobbyChannel
            );
        }
    }
);


async function initialiseLobby() {
    try {
        const accountLoaded =
            await loadCurrentAccount();


        if (!accountLoaded) {
            return;
        }


        await loadMatches();

        subscribeToLobbyChanges();

    } catch (error) {
        console.error(error);

        showMessage(
            lobbyMessage,
            error.message ||
            "The poker lobby could not be loaded."
        );
    }
}


initialiseLobby();