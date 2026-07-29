const tableNameLabel =
    document.querySelector("#table-name");

const tableDetailsLabel =
    document.querySelector("#table-details");

const tableStatusLabel =
    document.querySelector("#table-status");

const playerCountLabel =
    document.querySelector("#player-count");

const currentUsernameLabel =
    document.querySelector("#current-username");

const currentBalanceLabel =
    document.querySelector("#current-balance");

const pokerSeatGrid =
    document.querySelector("#poker-seat-grid");

const leaveMatchButton =
    document.querySelector("#leave-match-button");

const tableMessage =
    document.querySelector("#table-message");

const logoutButton =
    document.querySelector("#logout-button");


const tableId =
    new URLSearchParams(window.location.search)
        .get("id");


let currentUser = null;
let currentProfile = null;
let currentTable = null;

let tableChannel = null;
let refreshTimer = null;


function formatChips(value) {
    return new Intl.NumberFormat("en-GB").format(value);
}


function shortUserId(userId) {
    return userId
        .replaceAll("-", "")
        .slice(0, 6)
        .toUpperCase();
}


function showTableMessage(
    message = "",
    type = "error"
) {
    tableMessage.textContent = message;
    tableMessage.className =
        `form-message ${type}`.trim();
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


async function loadPokerTable() {
    if (!tableId) {
        throw new Error(
            "No poker match ID was supplied."
        );
    }


    const {
        data: pokerTable,
        error: tableError
    } = await window.supabaseClient
        .from("poker_tables")
        .select(
            "id, host_id, name, small_blind, big_blind, min_buy_in, max_buy_in, max_players, status"
        )
        .eq("id", tableId)
        .maybeSingle();


    if (tableError) {
        throw tableError;
    }


    if (!pokerTable) {
        throw new Error(
            "This poker match no longer exists."
        );
    }


    currentTable = pokerTable;


    const {
        data: seats,
        error: seatError
    } = await window.supabaseClient
        .from("poker_seats")
        .select(
            "table_id, seat_number, user_id, stack, joined_at"
        )
        .eq("table_id", tableId)
        .order("seat_number", {
            ascending: true
        });


    if (seatError) {
        throw seatError;
    }


    const userIds = [
        ...new Set(
            seats.map(
                (seat) => seat.user_id
            )
        )
    ];


    let profiles = [];


    if (userIds.length > 0) {
        const {
            data,
            error
        } = await window.supabaseClient
            .from("profiles")
            .select("id, username")
            .in("id", userIds);


        if (error) {
            throw error;
        }


        profiles = data ?? [];
    }


    const profileById =
        new Map(
            profiles.map(
                (profile) => [
                    profile.id,
                    profile
                ]
            )
        );


    renderPokerTable(
        pokerTable,
        seats,
        profileById
    );
}


function renderPokerTable(
    pokerTable,
    seats,
    profileById
) {
    tableNameLabel.textContent =
        pokerTable.name;


    tableDetailsLabel.textContent =
        `Blinds ${formatChips(pokerTable.small_blind)} / ${formatChips(pokerTable.big_blind)} · Buy-in ${formatChips(pokerTable.min_buy_in)}–${formatChips(pokerTable.max_buy_in)}`;


    tableStatusLabel.textContent =
        pokerTable.status;


    playerCountLabel.textContent =
        `${seats.length}/${pokerTable.max_players}`;


    const ownSeat =
        seats.find(
            (seat) =>
                seat.user_id === currentUser.id
        );


    if (
        ownSeat &&
        pokerTable.status === "waiting"
    ) {
        leaveMatchButton.classList.remove("hidden");
    } else {
        leaveMatchButton.classList.add("hidden");
    }


    pokerSeatGrid.replaceChildren();


    for (
        let seatNumber = 1;
        seatNumber <= pokerTable.max_players;
        seatNumber += 1
    ) {
        const seat =
            seats.find(
                (candidate) =>
                    candidate.seat_number ===
                    seatNumber
            );


        const seatElement =
            document.createElement("article");

        seatElement.className = "poker-seat";


        const seatNumberLabel =
            document.createElement("span");

        seatNumberLabel.className =
            "seat-number";

        seatNumberLabel.textContent =
            `Seat ${seatNumber}`;


        seatElement.append(seatNumberLabel);


        if (!seat) {
            seatElement.classList.add("empty-seat");


            const emptyLabel =
                document.createElement("strong");

            emptyLabel.textContent = "Empty";


            const emptyDescription =
                document.createElement("span");

            emptyDescription.textContent =
                "Waiting for player";


            seatElement.append(
                emptyLabel,
                emptyDescription
            );


            pokerSeatGrid.append(seatElement);

            continue;
        }


        const profile =
            profileById.get(seat.user_id);


        const username =
            profile?.username ??
            "Unknown player";


        if (seat.user_id === currentUser.id) {
            seatElement.classList.add("own-seat");
        }


        if (seat.user_id === pokerTable.host_id) {
            seatElement.classList.add("host-seat");
        }


        const playerHeading =
            document.createElement("div");

        playerHeading.className =
            "seat-player-heading";


        const usernameLabel =
            document.createElement("strong");

        usernameLabel.textContent = username;


        const userIdLabel =
            document.createElement("span");

        userIdLabel.className = "user-id";

        userIdLabel.textContent =
            `#${shortUserId(seat.user_id)}`;


        playerHeading.append(
            usernameLabel,
            userIdLabel
        );


        if (seat.user_id === pokerTable.host_id) {
            const hostBadge =
                document.createElement("span");

            hostBadge.className = "host-badge";
            hostBadge.textContent = "Host";

            playerHeading.append(hostBadge);
        }


        const stackLabel =
            document.createElement("span");

        stackLabel.className = "seat-stack";

        stackLabel.textContent =
            `${formatChips(seat.stack)} chips`;


        seatElement.append(
            playerHeading,
            stackLabel
        );


        pokerSeatGrid.append(seatElement);
    }
}


async function refreshAccountBalance() {
    const {
        data: profile,
        error
    } = await window.supabaseClient
        .from("profiles")
        .select("chips")
        .eq("id", currentUser.id)
        .maybeSingle();


    if (error) {
        throw error;
    }


    if (profile) {
        currentBalanceLabel.textContent =
            formatChips(profile.chips);
    }
}


function scheduleTableRefresh() {
    window.clearTimeout(refreshTimer);


    refreshTimer = window.setTimeout(
        async () => {
            try {
                await Promise.all([
                    loadPokerTable(),
                    refreshAccountBalance()
                ]);
            } catch (error) {
                console.error(error);

                showTableMessage(
                    error.message ||
                    "The poker match could not be refreshed."
                );
            }
        },
        150
    );
}


function subscribeToTableChanges() {
    tableChannel =
        window.supabaseClient
            .channel(
                `poker-table-${tableId}`
            )

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "poker_tables",
                    filter: `id=eq.${tableId}`
                },
                scheduleTableRefresh
            )

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "poker_seats",
                    filter: `table_id=eq.${tableId}`
                },
                scheduleTableRefresh
            )

            .subscribe();
}


leaveMatchButton.addEventListener(
    "click",
    async () => {
        const confirmed = window.confirm(
            "Leave this match and return your table stack to your wallet?"
        );


        if (!confirmed) {
            return;
        }


        leaveMatchButton.disabled = true;
        showTableMessage();


        try {
            const {
                error
            } = await window.supabaseClient
                .rpc(
                    "leave_poker_table",
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

            showTableMessage(
                error.message ||
                "The poker match could not be left."
            );

            leaveMatchButton.disabled = false;
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
        if (tableChannel) {
            window.supabaseClient.removeChannel(
                tableChannel
            );
        }
    }
);


async function initialisePokerTable() {
    try {
        const accountLoaded =
            await loadCurrentAccount();


        if (!accountLoaded) {
            return;
        }


        await loadPokerTable();

        subscribeToTableChanges();

    } catch (error) {
        console.error(error);

        tableNameLabel.textContent =
            "Match unavailable";

        tableDetailsLabel.textContent = "";

        showTableMessage(
            error.message ||
            "The poker match could not be loaded."
        );
    }
}


initialisePokerTable();