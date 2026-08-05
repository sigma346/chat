const walletLabel =
    document.querySelector("#community-rr-wallet");

const walletStatus =
    document.querySelector("#community-rr-wallet-status");

const phaseEyebrow =
    document.querySelector("#community-rr-phase-eyebrow");

const phaseTitle =
    document.querySelector("#community-rr-phase-title");

const phaseBadge =
    document.querySelector("#community-rr-phase-badge");

const phaseDescription =
    document.querySelector("#community-rr-phase-description");

const countdownLabel =
    document.querySelector("#community-rr-countdown-label");

const countdownValue =
    document.querySelector("#community-rr-countdown");

const scheduledTimeLabel =
    document.querySelector("#community-rr-scheduled-time");

const oddsTitle =
    document.querySelector("#community-rr-odds-title");

const oddsPercent =
    document.querySelector("#community-rr-odds-percent");

const chamberCopy =
    document.querySelector("#community-rr-chamber-copy");

const cylinder =
    document.querySelector("#community-rr-cylinder");

const playerCountLabel =
    document.querySelector("#community-rr-player-count");

const playerDetailLabel =
    document.querySelector("#community-rr-player-detail");

const totalStakedLabel =
    document.querySelector("#community-rr-total-staked");

const signupPanel =
    document.querySelector("#community-rr-signup-panel");

const stakeInput =
    document.querySelector("#community-rr-stake-input");

const quickStakeButtons =
    document.querySelectorAll("[data-stake]");

const joinButton =
    document.querySelector("#community-rr-join-button");

const signupHelp =
    document.querySelector("#community-rr-signup-help");

const yourEntry =
    document.querySelector("#community-rr-your-entry");

const yourStake =
    document.querySelector("#community-rr-your-stake");

const yourEntryStatus =
    document.querySelector("#community-rr-your-entry-status");

const withdrawButton =
    document.querySelector("#community-rr-withdraw-button");

const turnPanel =
    document.querySelector("#community-rr-turn-panel");

const turnEyebrow =
    document.querySelector("#community-rr-turn-eyebrow");

const turnPlayer =
    document.querySelector("#community-rr-turn-player");

const turnCopy =
    document.querySelector("#community-rr-turn-copy");

const turnCountdown =
    document.querySelector("#community-rr-turn-countdown");

const currentActions =
    document.querySelector("#community-rr-current-actions");

const playButton =
    document.querySelector("#community-rr-play-button");

const leaveButton =
    document.querySelector("#community-rr-leave-button");

const queueActions =
    document.querySelector("#community-rr-queue-actions");

const queuePlayButton =
    document.querySelector("#community-rr-queue-play-button");

const queueLeaveButton =
    document.querySelector("#community-rr-queue-leave-button");

const clearQueueButton =
    document.querySelector("#community-rr-clear-queue-button");

const turnMessage =
    document.querySelector("#community-rr-turn-message");

const playerList =
    document.querySelector("#community-rr-player-list");

const activeCountLabel =
    document.querySelector("#community-rr-active-count");

const yourStatusTitle =
    document.querySelector("#community-rr-your-status-title");

const yourMultiplier =
    document.querySelector("#community-rr-your-multiplier");

const yourPotential =
    document.querySelector("#community-rr-your-potential");

const yourSafePulls =
    document.querySelector("#community-rr-your-safe-pulls");

const yourQueuedMove =
    document.querySelector("#community-rr-your-queued-move");

const yourResult =
    document.querySelector("#community-rr-your-result");

const actionFeed =
    document.querySelector("#community-rr-action-feed");

const previousResult =
    document.querySelector("#community-rr-previous-result");

const messageElement =
    document.querySelector("#community-rr-message");


let gameState = null;
let serverOffsetMilliseconds = 0;
let stateRequestRunning = false;
let stateRequestQueued = false;
let actionRequestRunning = false;
let refreshTimer = null;
let realtimeChannel = null;
let countdownTimer = null;
let playConfirmationTimer = null;
let playConfirmationArmed = false;
let lastSeenActionId = null;
let turnWarningKey = null;


function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}


function formatMultiplier(value) {
    const numericValue = Number(value ?? 1);

    return `${numericValue.toFixed(2)}×`;
}


function formatClock(milliseconds) {
    const totalSeconds = Math.max(
        Math.ceil(milliseconds / 1000),
        0
    );

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


function formatScheduledTime(value) {
    if (!value) {
        return "Schedule unavailable";
    }

    return new Intl.DateTimeFormat(
        "en-AU",
        {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit"
        }
    ).format(new Date(value));
}


function formatActivityTime(value) {
    if (!value) {
        return "";
    }

    return new Intl.DateTimeFormat(
        "en-AU",
        {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit"
        }
    ).format(new Date(value));
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
        `form-message community-rr-message ${type}`.trim();
}


function showToast(message, type = "info") {
    if (typeof window.uiToast === "function") {
        window.uiToast(message, { type });
        return;
    }

    showMessage(message, type);
}


function setActionRequestRunning(value) {
    actionRequestRunning = value;

    for (const button of [
        joinButton,
        withdrawButton,
        playButton,
        leaveButton,
        queuePlayButton,
        queueLeaveButton,
        clearQueueButton
    ]) {
        button.disabled = value;
    }
}


async function rpc(functionName, parameters = {}) {
    const { data, error } =
        await window.supabaseClient.rpc(
            functionName,
            parameters
        );

    if (error) {
        throw error;
    }

    return data;
}


function resetPlayConfirmation() {
    playConfirmationArmed = false;
    window.clearTimeout(playConfirmationTimer);

    const chambers = Number(
        gameState?.round?.chambers_remaining ?? 6
    );

    playButton.textContent = gameState?.you?.can_act
        ? `Play the turn · 1 in ${chambers}`
        : "Play the turn";
}


function armPlayConfirmation() {
    const chambers = Number(
        gameState?.round?.chambers_remaining ?? 6
    );

    playConfirmationArmed = true;
    playButton.textContent =
        `Confirm Play · 1 in ${chambers}`;

    window.clearTimeout(playConfirmationTimer);
    playConfirmationTimer = window.setTimeout(
        resetPlayConfirmation,
        4200
    );
}


function renderCylinder(chambersRemaining) {
    const remaining = Math.min(
        Math.max(Number(chambersRemaining ?? 6), 1),
        6
    );

    const spent = 6 - remaining;
    cylinder.replaceChildren();

    for (let index = 0; index < 6; index += 1) {
        const chamber = document.createElement("span");
        chamber.className = "community-rr-chamber";
        chamber.setAttribute("aria-hidden", "true");

        if (index < spent) {
            chamber.classList.add("spent");
        }

        cylinder.append(chamber);
    }

    oddsTitle.textContent = `1 in ${remaining}`;
    oddsPercent.textContent =
        `${(100 / remaining).toFixed(1)}%`;

    chamberCopy.textContent = remaining === 6
        ? "Fresh cylinder. The current elimination chance is 1 in 6."
        : `${spent} empty chamber${spent === 1 ? " has" : "s have"} already been passed. The next chance is 1 in ${remaining}.`;
}


function phaseCopy(state) {
    switch (state.phase) {
        case "waiting_for_signup":
            return {
                eyebrow: "UPCOMING GAME",
                title: "Sign-ups open soon",
                badge: "Scheduled",
                description:
                    "The next game is scheduled. The ten-minute sign-up window has not opened yet.",
                countdownLabel: "Sign-up opens in"
            };

        case "signup":
            return {
                eyebrow: "SIGN-UP OPEN",
                title: "Choose your entry stake",
                badge: "Open",
                description:
                    "Join before the countdown reaches zero. At least two players are required.",
                countdownLabel: "Game starts in"
            };

        case "playing":
            return {
                eyebrow: "LIVE GAME",
                title: state.round?.current_turn_username
                    ? `${state.round.current_turn_username}'s turn`
                    : "Resolving the next turn",
                badge: "Live",
                description:
                    "The active player can Play or Leave. Queued moves execute automatically.",
                countdownLabel: "Current turn ends in"
            };

        default:
            return {
                eyebrow: "GLOBAL EVENT",
                title: "Loading schedule...",
                badge: "Loading",
                description:
                    "Checking the next scheduled game.",
                countdownLabel: "Time remaining"
            };
    }
}


function renderPhase(state) {
    const copy = phaseCopy(state);

    phaseEyebrow.textContent = copy.eyebrow;
    phaseTitle.textContent = copy.title;
    phaseBadge.textContent = copy.badge;
    phaseBadge.dataset.phase = state.phase;
    phaseDescription.textContent = copy.description;
    countdownLabel.textContent = copy.countdownLabel;

    const scheduledValue = state.phase === "waiting_for_signup"
        ? state.round?.signup_opens_at
        : state.round?.starts_at;

    scheduledTimeLabel.textContent = scheduledValue
        ? formatScheduledTime(scheduledValue)
        : "";
}


function statusLabel(status) {
    return {
        signed_up: "Signed up",
        active: "Active",
        eliminated: "Eliminated",
        cashed_out: "Left",
        winner: "Winner",
        refunded: "Refunded"
    }[status] ?? "Unknown";
}


function createBadge(text, className) {
    const badge = document.createElement("span");
    badge.className = className;
    badge.textContent = text;
    return badge;
}


function createPlayerCard(player) {
    const card = document.createElement("article");
    card.className = "community-rr-player-card";
    card.dataset.userId = String(player.user_id ?? "");

    if (player.is_current_turn) {
        card.classList.add("current-turn");
    }

    if (player.user_id === gameState.you.user_id) {
        card.classList.add("you");
    }

    if (
        player.status !== "active"
        && player.status !== "signed_up"
    ) {
        card.classList.add("resolved");
    }

    const seat = document.createElement("span");
    seat.className = "community-rr-seat-number";
    seat.textContent = player.seat_order
        ? String(player.seat_order)
        : "•";

    const copy = document.createElement("div");
    copy.className = "community-rr-player-copy";

    const nameRow = document.createElement("div");
    nameRow.className = "community-rr-player-name-row";

    const name = document.createElement("strong");
    name.textContent = player.username;
    name.dataset.profileUserId = String(player.user_id);
    name.dataset.profileUsername = String(player.username);

    nameRow.append(name);

    if (player.user_id === gameState.you.user_id) {
        nameRow.append(
            createBadge("You", "community-rr-you-badge")
        );
    }

    nameRow.append(
        createBadge(
            statusLabel(player.status),
            "community-rr-status-badge"
        )
    );

    if (player.has_queued_action) {
        nameRow.append(
            createBadge(
                "Move queued",
                "community-rr-queue-badge"
            )
        );
    }

    const detail = document.createElement("div");
    detail.className = "community-rr-player-detail";

    const stake = document.createElement("span");
    stake.textContent =
        `${formatChips(player.stake)} stake`;

    const pulls = document.createElement("span");
    pulls.textContent =
        `${Number(player.safe_pulls ?? 0)} safe pull${Number(player.safe_pulls ?? 0) === 1 ? "" : "s"}`;

    const multiplier = document.createElement("span");
    multiplier.textContent =
        formatMultiplier(player.multiplier);

    detail.append(stake, pulls, multiplier);
    copy.append(nameRow, detail);

    const value = document.createElement("div");
    value.className = "community-rr-player-value";

    const amount = document.createElement("strong");
    amount.textContent = player.status === "eliminated"
        ? "0"
        : formatChips(
            Number(player.payout ?? 0) > 0
                ? player.payout
                : player.potential_payout
        );

    const label = document.createElement("span");
    label.textContent = Number(player.payout ?? 0) > 0
        ? "paid"
        : "cash-out";

    value.append(amount, label);
    card.append(seat, copy, value);
    return card;
}


function renderPlayers(players) {
    playerList.replaceChildren();

    if (!Array.isArray(players) || players.length === 0) {
        const empty = document.createElement("p");
        empty.className = "community-rr-empty-state";
        empty.textContent = "No players have joined yet.";
        playerList.append(empty);
        return;
    }

    for (const player of players) {
        playerList.append(createPlayerCard(player));
    }
}


function actionIcon(actionType) {
    return {
        signup: "+",
        withdraw_signup: "↩",
        game_started: "▶",
        queue_play: "Q",
        queue_leave: "Q",
        queue_cleared: "×",
        play_safe: "✓",
        play_bullet: "!",
        leave: "↗",
        auto_leave: "⌛",
        winner: "★",
        refund: "↩",
        cancelled: "×"
    }[actionType] ?? "•";
}


function renderActions(actions) {
    actionFeed.replaceChildren();

    if (!Array.isArray(actions) || actions.length === 0) {
        const item = document.createElement("li");
        item.textContent = "Waiting for the first action.";
        actionFeed.append(item);
        return;
    }

    for (const action of actions) {
        const item = document.createElement("li");

        const icon = document.createElement("span");
        icon.className = "community-rr-feed-icon";
        icon.textContent = actionIcon(action.action_type);

        const copy = document.createElement("span");
        copy.className = "community-rr-feed-copy";
        copy.textContent = action.details
            || `${action.username ?? "The game"} updated.`;

        const time = document.createElement("time");
        time.className = "community-rr-feed-time";
        time.dateTime = action.created_at ?? "";
        time.textContent = formatActivityTime(
            action.created_at
        );

        item.append(icon, copy, time);
        actionFeed.append(item);
    }
}


function renderPrevious(previous) {
    previousResult.replaceChildren();

    if (!previous) {
        previousResult.textContent =
            "No completed game yet.";
        return;
    }

    const title = document.createElement("strong");
    const copy = document.createElement("span");

    if (previous.status === "cancelled") {
        title.textContent = "Game cancelled";
        copy.textContent = previous.cancellation_reason
            || "The game could not begin.";
    } else {
        title.textContent = previous.winner_username
            ? `${previous.winner_username} survived`
            : "Game completed";
        copy.textContent = previous.winner_payout
            ? `${formatChips(previous.winner_payout)} chips paid to the last player standing.`
            : "No winner payout was recorded.";
    }

    previousResult.append(title, copy);
}


function renderYourPosition(you) {
    const status = you.status;

    yourStatusTitle.textContent = you.joined
        ? statusLabel(status)
        : "Not entered";

    yourMultiplier.textContent =
        formatMultiplier(you.multiplier ?? 1);

    yourPotential.textContent = formatChips(
        Number(you.payout ?? 0) > 0
            ? you.payout
            : you.potential_payout
    );

    yourSafePulls.textContent = String(
        Number(you.safe_pulls ?? 0)
    );

    yourQueuedMove.textContent = you.queued_action
        ? you.queued_action[0].toUpperCase()
            + you.queued_action.slice(1)
        : "None";

    yourResult.textContent = you.joined
        ? (
            gameState.players.find(
                (player) =>
                    player.user_id === you.user_id
            )?.result_message
            || "Your result will appear here."
        )
        : "Join during sign-up to take a seat.";
}


function configureSignup(state) {
    const canJoin = Boolean(state.you.can_join);
    const canWithdraw = Boolean(state.you.can_withdraw);
    const signedUp = state.you.status === "signed_up";

    signupPanel.classList.toggle(
        "hidden",
        state.phase === "playing"
    );

    joinButton.disabled =
        actionRequestRunning || !canJoin;

    stakeInput.disabled =
        actionRequestRunning || !canJoin;

    quickStakeButtons.forEach((button) => {
        button.disabled =
            actionRequestRunning || !canJoin;
    });

    yourEntry.classList.toggle(
        "hidden",
        !signedUp
    );

    withdrawButton.disabled =
        actionRequestRunning || !canWithdraw;

    if (signedUp) {
        yourStake.textContent =
            `${formatChips(state.you.stake)} chips`;
        yourEntryStatus.textContent =
            "Your stake is locked until the game starts or you withdraw.";
    }

    if (state.phase === "waiting_for_signup") {
        signupHelp.textContent =
            `Sign-up opens ${formatScheduledTime(state.round?.signup_opens_at)}.`;
    } else if (state.phase === "signup") {
        signupHelp.textContent = canJoin
            ? "Choose 100 to 10,000 whole play chips."
            : signedUp
                ? "You are signed up. You may withdraw until the game begins."
                : "Sign-up is currently unavailable for this account.";
    }
}


function configureTurn(state) {
    const playing = state.phase === "playing";
    const canAct = Boolean(state.you.can_act);
    const canQueue = Boolean(state.you.can_queue);

    turnPanel.classList.toggle("hidden", !playing);

    if (!playing) {
        currentActions.classList.add("hidden");
        queueActions.classList.add("hidden");
        return;
    }

    const currentName =
        state.round?.current_turn_username
        || "Resolving the turn";

    turnPlayer.textContent = currentName;
    turnEyebrow.textContent = canAct
        ? "YOUR TURN"
        : "CURRENT TURN";

    if (canAct) {
        turnCopy.textContent =
            "Choose Play to risk your stake at the displayed odds, or Leave to bank your current cash-out.";
    } else if (state.you.status === "active") {
        turnCopy.textContent =
            "You can queue Play or Leave while waiting. The queued choice executes when your turn starts.";
    } else {
        turnCopy.textContent =
            "You are no longer active in this game, but you can watch the remaining turns.";
    }

    currentActions.classList.toggle("hidden", !canAct);
    queueActions.classList.toggle("hidden", !canQueue);

    playButton.disabled = actionRequestRunning || !canAct;
    leaveButton.disabled = actionRequestRunning || !canAct;
    queuePlayButton.disabled = actionRequestRunning || !canQueue;
    queueLeaveButton.disabled = actionRequestRunning || !canQueue;

    clearQueueButton.classList.toggle(
        "hidden",
        !state.you.queued_action
    );

    clearQueueButton.disabled =
        actionRequestRunning
        || !canQueue
        || !state.you.queued_action;

    queuePlayButton.textContent =
        state.you.queued_action === "play"
            ? "Play queued"
            : "Queue Play";

    queueLeaveButton.textContent =
        state.you.queued_action === "leave"
            ? "Leave queued"
            : "Queue Leave";

    turnMessage.textContent = canAct
        ? "No choice by the deadline automatically leaves the table."
        : state.you.queued_action
            ? `Queued move: ${state.you.queued_action}.`
            : "No move queued.";

    resetPlayConfirmation();
}


function showNewActionFeedback(actions) {
    if (!Array.isArray(actions) || actions.length === 0) {
        return;
    }

    const newest = actions[0];
    const newestId = Number(newest.id ?? 0);

    if (lastSeenActionId === null) {
        lastSeenActionId = newestId;
        return;
    }

    if (newestId <= lastSeenActionId) {
        return;
    }

    lastSeenActionId = newestId;

    if (newest.action_type === "play_safe") {
        showToast(newest.details || "Safe pull.", "success");
    } else if (newest.action_type === "play_bullet") {
        showToast(newest.details || "A player was eliminated.", "error");
    } else if (newest.action_type === "winner") {
        showToast(newest.details || "The game has a winner.", "success");
    }
}


function renderState(state) {
    gameState = state;
    showMessage();

    if (state.server_now) {
        serverOffsetMilliseconds =
            new Date(state.server_now).getTime()
            - Date.now();
    }

    walletLabel.textContent =
        formatChips(state.wallet_chips);

    walletStatus.textContent = state.you?.joined
        ? "Entry status shown below"
        : "Available to enter games";

    renderPhase(state);
    renderCylinder(
        state.round?.chambers_remaining ?? 6
    );

    const playerCount = Number(
        state.round?.player_count ?? 0
    );

    const activeCount = Number(
        state.round?.active_count ?? 0
    );

    playerCountLabel.textContent = String(playerCount);
    playerDetailLabel.textContent = state.phase === "playing"
        ? `${activeCount} still active`
        : `${Math.max(2 - playerCount, 0)} more needed to start`;

    totalStakedLabel.textContent =
        formatChips(state.round?.total_staked);

    activeCountLabel.textContent =
        `${activeCount} active`;

    configureSignup(state);
    configureTurn(state);
    renderPlayers(state.players);
    renderYourPosition(state.you);
    renderActions(state.actions);
    renderPrevious(state.previous_round);
    showNewActionFeedback(state.actions);

    document.title = state.phase === "playing"
        ? `1 in ${state.round?.chambers_remaining ?? 6} · Russian Roulette`
        : "Community Russian Roulette";
}


function updateCountdowns() {
    if (!gameState) {
        return;
    }

    const now = currentServerTime();
    const target = gameState.countdown_target
        ? new Date(gameState.countdown_target).getTime()
        : null;

    countdownValue.textContent = target
        ? formatClock(target - now)
        : "--:--";

    const turnTarget = gameState.round?.current_turn_deadline
        ? new Date(
            gameState.round.current_turn_deadline
        ).getTime()
        : null;

    turnCountdown.textContent = turnTarget
        ? formatClock(turnTarget - now)
        : "--:--";

    if (
        gameState.you?.can_act
        && turnTarget
    ) {
        const secondsRemaining = Math.max(
            Math.ceil((turnTarget - now) / 1000),
            0
        );

        const warningKey =
            `${gameState.round.id}:${gameState.round.turn_sequence}`;

        if (
            secondsRemaining <= 10
            && turnWarningKey !== warningKey
        ) {
            turnWarningKey = warningKey;
            showToast(
                "Ten seconds left. No choice will automatically leave the table.",
                "error"
            );
        }
    }

    if (target && target <= now - 1200) {
        scheduleRefresh(0);
    }
}


async function loadState() {
    if (stateRequestRunning) {
        stateRequestQueued = true;
        return;
    }

    stateRequestRunning = true;

    try {
        const state = await rpc(
            "get_community_russian_roulette_state"
        );

        renderState(state);
    } catch (error) {
        console.error(error);
        showMessage(
            error.message
            || "The community game could not be loaded."
        );
    } finally {
        stateRequestRunning = false;

        if (stateRequestQueued) {
            stateRequestQueued = false;
            window.setTimeout(loadState, 0);
        }
    }
}


function scheduleRefresh(delay = 140) {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(loadState, delay);
}


async function runAction(
    functionName,
    parameters,
    successMessage
) {
    if (actionRequestRunning) {
        return;
    }

    setActionRequestRunning(true);
    showMessage();

    try {
        const state = await rpc(
            functionName,
            parameters
        );

        renderState(state);

        if (successMessage) {
            showToast(successMessage, "success");
        }
    } catch (error) {
        console.error(error);
        showMessage(
            error.message || "The action could not be completed."
        );
    } finally {
        setActionRequestRunning(false);

        if (gameState) {
            configureSignup(gameState);
            configureTurn(gameState);
        }
    }
}


quickStakeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        stakeInput.value = button.dataset.stake;
        stakeInput.focus();
    });
});


joinButton.addEventListener("click", () => {
    const stake = Number.parseInt(
        stakeInput.value,
        10
    );

    if (!Number.isSafeInteger(stake)) {
        showMessage("Enter a valid whole-chip stake.");
        return;
    }

    if (stake < 100 || stake > 20000) {
        showMessage("Choose a stake from 100 to 20,000 chips.");
        return;
    }

    runAction(
        "join_community_russian_roulette",
        {
            p_round_id: gameState.round.id,
            p_stake: stake
        },
        "You joined the next game."
    );
});


withdrawButton.addEventListener("click", () => {
    const confirmed = window.confirm(
        "Withdraw from this game and refund the full entry stake?"
    );

    if (!confirmed) {
        return;
    }

    runAction(
        "withdraw_community_russian_roulette_signup",
        {
            p_round_id: gameState.round.id
        },
        "Entry withdrawn and refunded."
    );
});


playButton.addEventListener("click", () => {
    if (!playConfirmationArmed) {
        armPlayConfirmation();
        return;
    }

    resetPlayConfirmation();

    runAction(
        "take_community_russian_roulette_action",
        {
            p_round_id: gameState.round.id,
            p_action: "play"
        }
    );
});


leaveButton.addEventListener("click", () => {
    const payout = formatChips(
        gameState.you.potential_payout
    );

    const confirmed = window.confirm(
        `Leave the table and bank ${payout} chips?`
    );

    if (!confirmed) {
        return;
    }

    runAction(
        "take_community_russian_roulette_action",
        {
            p_round_id: gameState.round.id,
            p_action: "leave"
        },
        "You left the table and banked your cash-out."
    );
});


queuePlayButton.addEventListener("click", () => {
    runAction(
        "queue_community_russian_roulette_action",
        {
            p_round_id: gameState.round.id,
            p_action: "play"
        },
        "Play queued for your next turn."
    );
});


queueLeaveButton.addEventListener("click", () => {
    runAction(
        "queue_community_russian_roulette_action",
        {
            p_round_id: gameState.round.id,
            p_action: "leave"
        },
        "Leave queued for your next turn."
    );
});


clearQueueButton.addEventListener("click", () => {
    runAction(
        "queue_community_russian_roulette_action",
        {
            p_round_id: gameState.round.id,
            p_action: "clear"
        },
        "Queued move cleared."
    );
});


function subscribeToGame() {
    realtimeChannel = window.supabaseClient
        .channel("community-russian-roulette")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "community_russian_roulette_rounds"
            },
            () => scheduleRefresh()
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "community_russian_roulette_players"
            },
            () => scheduleRefresh()
        )
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "community_russian_roulette_actions"
            },
            () => scheduleRefresh(80)
        )
        .subscribe();
}


window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        loadState();
    }
});


window.addEventListener("beforeunload", () => {
    window.clearInterval(countdownTimer);
    window.clearTimeout(refreshTimer);
    window.clearTimeout(playConfirmationTimer);

    if (realtimeChannel) {
        window.supabaseClient.removeChannel(
            realtimeChannel
        );
    }
});


async function initialise() {
    try {
        const {
            data: { user },
            error
        } = await window.supabaseClient.auth.getUser();

        if (error || !user) {
            window.location.href = "login.html";
            return;
        }

        renderCylinder(6);
        await loadState();
        subscribeToGame();

        countdownTimer = window.setInterval(
            updateCountdowns,
            250
        );

        window.setInterval(() => {
            if (
                document.visibilityState === "visible"
                && !actionRequestRunning
            ) {
                loadState();
            }
        }, 5000);
    } catch (error) {
        console.error(error);
        showMessage(
            error.message
            || "Community Russian Roulette could not be initialised."
        );
    }
}


initialise();
