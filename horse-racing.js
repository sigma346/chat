const walletBalanceLabel =
    document.querySelector("#wallet-balance");

const liveRaceSection =
    document.querySelector("#live-race-section");

const liveRaceTitle =
    document.querySelector("#live-race-title");

const liveRaceTimer =
    document.querySelector("#live-race-timer");

const liveRaceLanes =
    document.querySelector("#live-race-lanes");

const liveRaceResult =
    document.querySelector("#live-race-result");

const bettingRaceSection =
    document.querySelector("#betting-race-section");

const nextRaceCountdown =
    document.querySelector("#next-race-countdown");

const nextRaceTime =
    document.querySelector("#next-race-time");

const betAmountInput =
    document.querySelector("#bet-amount-input");

const quickBetButtons =
    document.querySelectorAll(".quick-bet-button");

const bettingHorseGrid =
    document.querySelector("#betting-horse-grid");

const myBetSummary =
    document.querySelector("#my-bet-summary");

const lastRaceSection =
    document.querySelector("#last-race-section");

const lastRaceResult =
    document.querySelector("#last-race-result");

const messageElement =
    document.querySelector("#horse-racing-message");


let raceState = null;
let serverOffsetMilliseconds = 0;
let selectedHorseId = null;
let requestInProgress = false;
let realtimeChannel = null;
let refreshTimeout = null;
let animationFrameId = null;
let transitionRefreshPending = false;

let activeRaceId = null;
let activeRaceCurves = null;


function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}


function formatRaceDate(value) {
    if (!value) {
        return "Schedule unavailable";
    }

    return new Intl.DateTimeFormat(
        "en-AU",
        {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(new Date(value));
}


function formatDuration(milliseconds) {
    const totalSeconds = Math.max(
        Math.ceil(milliseconds / 1000),
        0
    );

    const hours = Math.floor(
        totalSeconds / 3600
    );

    const minutes = Math.floor(
        (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


function currentServerTime() {
    return Date.now() + serverOffsetMilliseconds;
}


function showMessage(
    message = "",
    type = "error"
) {
    messageElement.textContent = message;
    messageElement.className =
        `form-message ${type}`.trim();
}


function createSeededRandom(seed) {
    let state = Number(seed) >>> 0;

    return function seededRandom() {
        state += 0x6D2B79F5;

        let value = state;

        value = Math.imul(
            value ^ value >>> 15,
            value | 1
        );

        value ^=
            value
            + Math.imul(
                value ^ value >>> 7,
                value | 61
            );

        return (
            (
                value ^ value >>> 14
            ) >>> 0
        ) / 4294967296;
    };
}


function shuffledCopy(values, random) {
    const result = [...values];

    for (
        let index = result.length - 1;
        index > 0;
        index -= 1
    ) {
        const target = Math.floor(
            random() * (index + 1)
        );

        [
            result[index],
            result[target]
        ] = [
            result[target],
            result[index]
        ];
    }

    return result;
}


function createRaceCurves(race) {
    const random = createSeededRandom(
        Number(race.animation_seed)
    );

    const horses = [...race.horses]
        .sort(
            (firstHorse, secondHorse) =>
                firstHorse.lane - secondHorse.lane
        );

    const losingTargets = shuffledCopy(
        [98.4, 96.6, 94.7],
        random
    );

    let losingTargetIndex = 0;
    const curves = new Map();

    for (const horse of horses) {
        const targetProgress =
            Number(horse.lane)
                === Number(race.winner_lane)
                ? 100
                : losingTargets[
                    losingTargetIndex++
                ];

        const rawProgress = [0];
        let cumulativeProgress = 0;

        for (
            let second = 1;
            second <= 60;
            second += 1
        ) {
            let speed =
                0.72 + random() * 1.1;

            /*
                Random slowdowns and bursts create visible
                lead changes while every client still sees
                the same race.
            */

            if (random() < 0.14) {
                speed *= 0.16 + random() * 0.2;
            }

            if (random() < 0.09) {
                speed *= 1.8 + random() * 0.8;
            }

            const rhythm =
                1
                + Math.sin(
                    second * 0.52
                    + horse.lane * 1.7
                ) * 0.12;

            speed *= rhythm;

            cumulativeProgress += Math.max(
                speed,
                0.05
            );

            rawProgress.push(
                cumulativeProgress
            );
        }

        const scale =
            targetProgress
            / cumulativeProgress;

        curves.set(
            horse.id,
            rawProgress.map(
                (value) => value * scale
            )
        );
    }

    return curves;
}


function progressAtTime(
    curve,
    elapsedSeconds
) {
    if (!curve || curve.length < 61) {
        return 0;
    }

    if (elapsedSeconds <= 0) {
        return 0;
    }

    if (elapsedSeconds >= 60) {
        return curve[60];
    }

    const lowerSecond = Math.floor(
        elapsedSeconds
    );

    const upperSecond = Math.min(
        lowerSecond + 1,
        60
    );

    const fraction =
        elapsedSeconds - lowerSecond;

    return (
        curve[lowerSecond]
        + (
            curve[upperSecond]
            - curve[lowerSecond]
        ) * fraction
    );
}


function createBettorList(horse) {
    const list = document.createElement("div");
    list.className = "horse-bettor-list";

    const bets = Array.isArray(horse.bets)
        ? horse.bets
        : [];

    if (bets.length === 0) {
        const empty = document.createElement("span");
        empty.className = "empty-bettor-list";
        empty.textContent = "No bets yet";
        list.append(empty);
        return list;
    }

    for (const bet of bets) {
        const item = document.createElement("div");
        item.className = "horse-bettor-item";

        const username = document.createElement("strong");
        username.textContent = bet.username;

        const amount = document.createElement("span");
        amount.textContent =
            `${formatChips(bet.amount)} chips`;

        item.append(username, amount);
        list.append(item);
    }

    return list;
}


function createHorseSummaryHeader(horse) {
    const heading = document.createElement("div");
    heading.className = "horse-summary-heading";

    const identity = document.createElement("div");

    const lane = document.createElement("span");
    lane.className = "horse-lane-label";
    lane.textContent = `Lane ${horse.lane}`;

    const name = document.createElement("strong");
    name.textContent = horse.name;

    identity.append(lane, name);

    const pool = document.createElement("div");
    pool.className = "horse-pool-total";

    const poolLabel = document.createElement("span");
    poolLabel.textContent = "Total backed";

    const poolAmount = document.createElement("strong");
    poolAmount.textContent =
        `${formatChips(horse.total_bet)} chips`;

    pool.append(poolLabel, poolAmount);
    heading.append(identity, pool);

    return heading;
}


function renderBettingRace(race) {
    bettingHorseGrid.replaceChildren();
    selectedHorseId = null;

    if (!race) {
        bettingRaceSection.classList.add("hidden");
        return;
    }

    bettingRaceSection.classList.remove("hidden");

    nextRaceTime.textContent =
        `Starts ${formatRaceDate(race.starts_at)}`;

    const ownBet = race.my_bet;

    const canAffordMinimum =
        Number(raceState.wallet_chips)
        >= Number(raceState.minimum_bet);

    betAmountInput.min =
        Number(raceState.minimum_bet);

    betAmountInput.max = Math.min(
        Number(raceState.maximum_bet),
        Number(raceState.wallet_chips)
    );

    betAmountInput.disabled =
        Boolean(ownBet)
        || requestInProgress
        || !canAffordMinimum;

    for (const quickBetButton of quickBetButtons) {
        const quickAmount = Number(
            quickBetButton.dataset.bet
        );

        quickBetButton.disabled =
            Boolean(ownBet)
            || requestInProgress
            || quickAmount > Number(raceState.wallet_chips)
            || quickAmount > Number(raceState.maximum_bet);
    }

    myBetSummary.classList.toggle(
        "hidden",
        !ownBet
    );

    if (ownBet) {
        myBetSummary.innerHTML = "";

        const text = document.createElement("span");
        text.textContent = "Your bet";

        const value = document.createElement("strong");
        value.textContent =
            `${formatChips(ownBet.amount)} chips on ${ownBet.horse_name}`;

        myBetSummary.append(text, value);
    } else {
        myBetSummary.replaceChildren();
    }

    for (const horse of race.horses) {
        const card = document.createElement("article");
        card.className = "betting-horse-card";
        card.dataset.horseId = horse.id;

        card.append(
            createHorseSummaryHeader(horse),
            createBettorList(horse)
        );

        const button = document.createElement("button");
        button.type = "button";
        button.className = "back-horse-button";

        if (ownBet) {
            const isOwnHorse =
                ownBet.horse_id === horse.id;

            button.textContent = isOwnHorse
                ? "Your horse"
                : "Bet locked";

            button.disabled = true;

            if (isOwnHorse) {
                card.classList.add("own-bet-horse");
            }
        } else {
            button.textContent = canAffordMinimum
                ? "Select horse"
                : "Not enough chips";

            button.disabled =
                requestInProgress
                || !canAffordMinimum;

            button.addEventListener(
                "click",
                async () => {
                    if (selectedHorseId === horse.id) {
                        await placeBet(
                            race.id,
                            horse.id
                        );

                        return;
                    }

                    selectedHorseId = horse.id;

                    for (
                        const horseCard
                        of bettingHorseGrid.querySelectorAll(
                            ".betting-horse-card"
                        )
                    ) {
                        const isSelected =
                            horseCard.dataset.horseId
                            === horse.id;

                        horseCard.classList.toggle(
                            "selected-horse",
                            isSelected
                        );

                        const horseButton =
                            horseCard.querySelector(
                                ".back-horse-button"
                            );

                        if (horseButton) {
                            horseButton.textContent =
                                isSelected
                                    ? "Place bet"
                                    : "Select horse";
                        }
                    }
                }
            );
        }

        card.append(button);
        bettingHorseGrid.append(card);
    }
}


function renderLiveRace(race) {
    cancelAnimationFrame(animationFrameId);
    liveRaceLanes.replaceChildren();
    liveRaceResult.textContent = "";

    if (!race) {
        liveRaceSection.classList.add("hidden");
        activeRaceId = null;
        activeRaceCurves = null;
        return;
    }

    liveRaceSection.classList.remove("hidden");
    liveRaceTitle.textContent =
        `Race starting ${formatRaceDate(race.starts_at)}`;

    activeRaceId = race.id;
    activeRaceCurves = createRaceCurves(race);

    for (const horse of race.horses) {
        const lane = document.createElement("article");
        lane.className = "live-horse-lane";
        lane.dataset.horseId = horse.id;

        const header = createHorseSummaryHeader(horse);

        const track = document.createElement("div");
        track.className = "horse-progress-track";

        const fill = document.createElement("div");
        fill.className = "horse-progress-fill";

        const marker = document.createElement("span");
        marker.className = "horse-progress-marker";
        marker.textContent = "🐎";

        const progressText = document.createElement("span");
        progressText.className = "horse-progress-text";
        progressText.textContent = "0.0%";

        fill.append(marker);
        track.append(fill, progressText);

        lane.append(
            header,
            track,
            createBettorList(horse)
        );

        liveRaceLanes.append(lane);
    }

    animateLiveRace(race);
}


function animateLiveRace(race) {
    function frame() {
        if (
            !raceState?.live_race
            || raceState.live_race.id !== race.id
        ) {
            return;
        }

        const elapsedMilliseconds =
            currentServerTime()
            - Date.parse(race.starts_at);

        const elapsedSeconds =
            Math.max(
                Math.min(
                    elapsedMilliseconds / 1000,
                    60
                ),
                0
            );

        const remainingMilliseconds =
            Date.parse(race.ends_at)
            - currentServerTime();

        liveRaceTimer.textContent =
            formatDuration(remainingMilliseconds);

        let winningHorse = null;

        for (const horse of race.horses) {
            const lane = liveRaceLanes.querySelector(
                `[data-horse-id="${horse.id}"]`
            );

            if (!lane) {
                continue;
            }

            const curve = activeRaceCurves?.get(
                horse.id
            );

            const progress = progressAtTime(
                curve,
                elapsedSeconds
            );

            const fill = lane.querySelector(
                ".horse-progress-fill"
            );

            const progressText = lane.querySelector(
                ".horse-progress-text"
            );

            if (fill) {
                fill.style.width =
                    `${Math.min(progress, 100)}%`;
            }

            if (progressText) {
                progressText.textContent =
                    `${progress.toFixed(1)}%`;
            }

            if (
                Number(horse.lane)
                === Number(race.winner_lane)
            ) {
                winningHorse = horse;
            }
        }

        if (elapsedSeconds >= 60) {
            if (winningHorse) {
                liveRaceResult.textContent =
                    `${winningHorse.name} crosses the line first!`;

                const winningLane =
                    liveRaceLanes.querySelector(
                        `[data-horse-id="${winningHorse.id}"]`
                    );

                winningLane?.classList.add(
                    "winning-live-lane"
                );
            }

            scheduleTransitionRefresh();
            return;
        }

        animationFrameId =
            requestAnimationFrame(frame);
    }

    animationFrameId =
        requestAnimationFrame(frame);
}


function renderLastRace(race) {
    lastRaceResult.replaceChildren();

    if (!race) {
        lastRaceSection.classList.add("hidden");
        return;
    }

    lastRaceSection.classList.remove("hidden");

    const winner = race.horses.find(
        (horse) => horse.is_winner
    );

    if (!winner) {
        lastRaceResult.textContent =
            "The previous result is unavailable.";
        return;
    }

    const resultCard = document.createElement("div");
    resultCard.className = "previous-winner-card";

    const winnerText = document.createElement("div");

    const label = document.createElement("span");
    label.textContent = "Winner";

    const name = document.createElement("strong");
    name.textContent = winner.name;

    winnerText.append(label, name);

    const totals = document.createElement("div");
    totals.className = "previous-race-totals";

    const pool = document.createElement("span");
    pool.textContent =
        `${formatChips(race.total_pool)} chips wagered`;

    const payout = document.createElement("span");
    payout.textContent =
        `${formatChips(race.total_payout)} chips paid out`;

    totals.append(pool, payout);
    resultCard.append(winnerText, totals);

    lastRaceResult.append(resultCard);
}


function renderState(state) {
    raceState = state;

    serverOffsetMilliseconds =
        Date.parse(state.server_now)
        - Date.now();

    walletBalanceLabel.textContent =
        formatChips(state.wallet_chips);

    renderLiveRace(state.live_race);
    renderBettingRace(state.betting_race);
    renderLastRace(state.last_completed_race);

    updateCountdowns();
}


function updateCountdowns() {
    const bettingRace = raceState?.betting_race;

    if (bettingRace) {
        const remaining =
            Date.parse(bettingRace.betting_closes_at)
            - currentServerTime();

        nextRaceCountdown.textContent =
            formatDuration(remaining);

        if (remaining <= 0) {
            scheduleTransitionRefresh();
        }
    } else {
        nextRaceCountdown.textContent = "--:--";
    }

    const liveRace = raceState?.live_race;

    if (liveRace) {
        const remaining =
            Date.parse(liveRace.ends_at)
            - currentServerTime();

        liveRaceTimer.textContent =
            formatDuration(remaining);

        if (remaining <= 0) {
            scheduleTransitionRefresh();
        }
    }
}


function setRequestInProgress(value) {
    requestInProgress = value;

    const hasBet = Boolean(
        raceState?.betting_race?.my_bet
    );

    const wallet = Number(
        raceState?.wallet_chips ?? 0
    );

    const minimumBet = Number(
        raceState?.minimum_bet ?? 10
    );

    betAmountInput.disabled =
        value
        || hasBet
        || wallet < minimumBet;

    for (
        const button
        of document.querySelectorAll(
            ".back-horse-button"
        )
    ) {
        button.disabled =
            value
            || hasBet
            || wallet < minimumBet;
    }

    for (const button of quickBetButtons) {
        const quickAmount = Number(
            button.dataset.bet
        );

        button.disabled =
            value
            || hasBet
            || quickAmount > wallet
            || quickAmount > Number(
                raceState?.maximum_bet ?? 10000
            );
    }
}


async function placeBet(
    raceId,
    horseId
) {
    if (requestInProgress) {
        return;
    }

    const amount = Number.parseInt(
        betAmountInput.value,
        10
    );

    if (!Number.isSafeInteger(amount)) {
        showMessage(
            "Enter a valid whole-number bet."
        );
        return;
    }

    if (
        amount < Number(raceState.minimum_bet)
        || amount > Number(raceState.maximum_bet)
    ) {
        showMessage(
            `Bets must be between ${formatChips(raceState.minimum_bet)} and ${formatChips(raceState.maximum_bet)} chips.`
        );
        return;
    }

    if (amount > Number(raceState.wallet_chips)) {
        showMessage(
            "You do not have enough wallet chips."
        );
        return;
    }

    setRequestInProgress(true);
    showMessage();

    try {
        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "place_global_horse_race_bet",
            {
                p_race_id: raceId,
                p_horse_id: horseId,
                p_amount: amount
            }
        );

        if (error) {
            throw error;
        }

        renderState(data);

        showMessage(
            "Your horse-race bet has been placed.",
            "success"
        );
    } catch (error) {
        console.error(error);

        showMessage(
            error.message
            || "The horse-race bet could not be placed."
        );
    } finally {
        setRequestInProgress(false);
    }
}


async function loadRaceState() {
    const {
        data,
        error
    } = await window.supabaseClient.rpc(
        "get_global_horse_race_state"
    );

    if (error) {
        throw error;
    }

    transitionRefreshPending = false;
    renderState(data);
}


function scheduleRefresh() {
    window.clearTimeout(refreshTimeout);

    refreshTimeout = window.setTimeout(
        async () => {
            try {
                await loadRaceState();
            } catch (error) {
                console.error(
                    "Horse-racing refresh failed:",
                    error
                );
            }
        },
        120
    );
}


function scheduleTransitionRefresh() {
    if (transitionRefreshPending) {
        return;
    }

    transitionRefreshPending = true;

    window.setTimeout(
        async () => {
            try {
                await loadRaceState();
            } catch (error) {
                console.error(
                    "Race transition refresh failed:",
                    error
                );

                transitionRefreshPending = false;
            }
        },
        1200
    );
}


function subscribeToRaceChanges() {
    realtimeChannel =
        window.supabaseClient
            .channel("global-horse-racing")

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "horse_races"
                },
                scheduleRefresh
            )

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "horse_race_horses"
                },
                scheduleRefresh
            )

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "horse_race_bets"
                },
                scheduleRefresh
            )

            .subscribe((status, error) => {
                if (status === "CHANNEL_ERROR") {
                    console.error(
                        "Horse-racing realtime failed:",
                        error
                    );
                }
            });
}


for (const button of quickBetButtons) {
    button.addEventListener(
        "click",
        () => {
            betAmountInput.value =
                button.dataset.bet;
        }
    );
}


window.setInterval(
    updateCountdowns,
    250
);


window.addEventListener(
    "beforeunload",
    () => {
        cancelAnimationFrame(animationFrameId);

        if (realtimeChannel) {
            window.supabaseClient.removeChannel(
                realtimeChannel
            );
        }
    }
);


async function initialiseHorseRacing() {
    try {
        const {
            data: {
                user
            },
            error
        } = await window.supabaseClient.auth
            .getUser();

        if (error || !user) {
            window.location.href =
                "login.html";
            return;
        }

        await loadRaceState();
        subscribeToRaceChanges();
    } catch (error) {
        console.error(
            "Horse racing failed to initialise:",
            error
        );

        showMessage(
            error.message
            || "The global horse race could not be loaded."
        );
    }
}


initialiseHorseRacing();
