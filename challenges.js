const challengeSlotGrid =
    document.querySelector("#challenge-slot-grid");

const challengeHistoryList =
    document.querySelector("#challenge-history-list");

const completedToday =
    document.querySelector("#completed-today");

const challengeChipsEarned =
    document.querySelector("#challenge-chips-earned");

const challengeXpEarned =
    document.querySelector("#challenge-xp-earned");

const rerollStatus =
    document.querySelector("#reroll-status");

const rerollButton =
    document.querySelector("#reroll-challenges-button");

const refreshButton =
    document.querySelector("#refresh-challenges-button");

const challengeMessage =
    document.querySelector("#challenge-message");

const challengeResetCountdown =
    document.querySelector("#challenge-reset-countdown");

const challengeDateLabel =
    document.querySelector("#challenge-date-label");

let currentUser = null;
let challengeState = null;
let refreshInterval = null;
let countdownInterval = null;
let requestRunning = false;

const difficultyNames = {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard"
};

function formatNumber(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}

function formatTime(value) {
    if (!value) {
        return "";
    }

    return new Intl.DateTimeFormat(
        "en-AU",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(new Date(value));
}

function setMessage(message = "", type = "") {
    challengeMessage.textContent = message;
    challengeMessage.className =
        `challenge-message ${type}`.trim();
}

function createRewardChip(label, className) {
    const element = document.createElement("span");
    element.className = className;
    element.textContent = label;
    return element;
}

function createChallengeCard(challenge) {
    const card = document.createElement("article");
    card.className = "challenge-card";
    card.dataset.difficulty = challenge.difficulty;

    const header = document.createElement("header");
    header.className = "challenge-card-header";

    const difficulty = document.createElement("span");
    difficulty.className = "challenge-difficulty";
    difficulty.textContent =
        difficultyNames[challenge.difficulty]
        ?? challenge.difficulty;

    const sequence = document.createElement("span");
    sequence.className = "challenge-sequence";
    sequence.textContent =
        `Challenge ${Number(challenge.sequence_number ?? 1)}`;

    header.append(difficulty, sequence);

    const information = document.createElement("div");

    const category = document.createElement("p");
    category.className = "challenge-game-label";
    category.textContent = challenge.category;

    const title = document.createElement("h3");
    title.textContent = challenge.name;

    const description = document.createElement("p");
    description.className = "challenge-card-description";
    description.textContent = challenge.description;

    information.append(category, title, description);

    const progressGroup = document.createElement("div");
    progressGroup.className = "challenge-progress-group";

    const progressLabel = document.createElement("div");
    progressLabel.className = "challenge-progress-label";

    const progressText = document.createElement("span");
    progressText.textContent = "Progress";

    const progressValue = document.createElement("strong");
    progressValue.textContent =
        `${formatNumber(challenge.progress)} / `
        + `${formatNumber(challenge.target)}`;

    progressLabel.append(progressText, progressValue);

    const progressTrack = document.createElement("div");
    progressTrack.className = "challenge-progress-track";

    const progressFill = document.createElement("div");
    progressFill.className = "challenge-progress-fill";

    const progressRatio = Math.min(
        Math.max(
            Number(challenge.progress ?? 0)
            / Math.max(Number(challenge.target ?? 1), 1),
            0
        ),
        1
    );

    progressFill.style.width = `${progressRatio * 100}%`;
    progressTrack.append(progressFill);

    progressGroup.append(progressLabel, progressTrack);

    const rewards = document.createElement("div");
    rewards.className = "challenge-rewards";

    const baseRewardRow = document.createElement("div");
    baseRewardRow.className = "challenge-reward-row";

    const baseRewardLabel = document.createElement("span");
    baseRewardLabel.textContent = "Completion reward";

    const baseRewardValues = document.createElement("div");
    baseRewardValues.className = "challenge-reward-values";

    baseRewardValues.append(
        createRewardChip(
            `+${formatNumber(challenge.chip_reward)} chips`,
            "challenge-reward-chip"
        ),
        createRewardChip(
            `+${formatNumber(challenge.xp_reward)} XP`,
            "challenge-reward-xp"
        )
    );

    baseRewardRow.append(baseRewardLabel, baseRewardValues);

    const bonusRow = document.createElement("div");
    bonusRow.className = "challenge-reward-row challenge-bonus-row";

    if (!challenge.bonus_available) {
        bonusRow.classList.add("used");
    }

    const bonusLabel = document.createElement("span");
    bonusLabel.textContent = challenge.bonus_available
        ? "First completion bonus available"
        : "First completion bonus already claimed";

    const bonusValues = document.createElement("div");
    bonusValues.className = "challenge-reward-values";

    bonusValues.append(
        createRewardChip(
            `+${formatNumber(challenge.first_bonus_chips)} chips`,
            "challenge-reward-chip"
        ),
        createRewardChip(
            `+${formatNumber(challenge.first_bonus_xp)} XP`,
            "challenge-reward-xp"
        )
    );

    bonusRow.append(bonusLabel, bonusValues);
    rewards.append(baseRewardRow, bonusRow);

    card.append(
        header,
        information,
        progressGroup,
        rewards
    );

    return card;
}

function renderChallenges(challenges) {
    challengeSlotGrid.replaceChildren();

    if (!challenges.length) {
        const empty = document.createElement("article");
        empty.className = "challenge-loading-card";
        empty.textContent =
            "No daily challenge slots are available.";
        challengeSlotGrid.append(empty);
        return;
    }

    for (const challenge of challenges) {
        challengeSlotGrid.append(
            createChallengeCard(challenge)
        );
    }
}

function renderHistory(completions) {
    challengeHistoryList.replaceChildren();

    if (!completions.length) {
        const empty = document.createElement("p");
        empty.className = "challenge-empty";
        empty.textContent =
            "No challenges completed today.";
        challengeHistoryList.append(empty);
        return;
    }

    for (const completion of completions) {
        const item = document.createElement("article");
        item.className = "challenge-history-item";

        const difficulty = document.createElement("span");
        difficulty.className =
            "challenge-history-difficulty";
        difficulty.textContent =
            difficultyNames[completion.difficulty]
            ?? completion.difficulty;

        const copy = document.createElement("div");
        copy.className = "challenge-history-copy";

        const name = document.createElement("strong");
        name.textContent = completion.name;

        const time = document.createElement("span");
        time.textContent =
            `${completion.category} · `
            + `${formatTime(completion.awarded_at)}`;

        copy.append(name, time);

        const rewards = document.createElement("div");
        rewards.className = "challenge-history-reward";

        const totalChips =
            Number(completion.base_chips ?? 0)
            + Number(completion.bonus_chips ?? 0);

        const totalXp =
            Number(completion.base_xp ?? 0)
            + Number(completion.bonus_xp ?? 0);

        rewards.append(
            createRewardChip(
                `+${formatNumber(totalChips)} chips`,
                "challenge-reward-chip"
            ),
            createRewardChip(
                `+${formatNumber(totalXp)} XP`,
                "challenge-reward-xp"
            )
        );

        if (
            Number(completion.bonus_chips ?? 0) > 0
            || Number(completion.bonus_xp ?? 0) > 0
        ) {
            const bonus = document.createElement("span");
            bonus.className = "challenge-reward-xp";
            bonus.textContent = "First bonus";
            rewards.append(bonus);
        }

        item.append(difficulty, copy, rewards);
        challengeHistoryList.append(item);
    }
}

function updateCountdown() {
    if (!challengeState?.next_reset_at) {
        challengeResetCountdown.textContent = "Loading...";
        return;
    }

    const remaining =
        new Date(challengeState.next_reset_at).getTime()
        - Date.now();

    if (remaining <= 0) {
        challengeResetCountdown.textContent = "Resetting...";
        loadChallenges(true);
        return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(
        (totalSeconds % 3600) / 60
    );
    const seconds = totalSeconds % 60;

    challengeResetCountdown.textContent =
        `${String(hours).padStart(2, "0")}:`
        + `${String(minutes).padStart(2, "0")}:`
        + `${String(seconds).padStart(2, "0")}`;
}

function renderState(state) {
    challengeState = state;

    completedToday.textContent =
        formatNumber(state.completed_today);

    challengeChipsEarned.textContent =
        `${formatNumber(state.chips_earned_today)} chips`;

    challengeXpEarned.textContent =
        `${formatNumber(state.xp_earned_today)} XP`;

    rerollStatus.textContent = state.reroll_available
        ? "Available"
        : "Used today";

    rerollButton.disabled = !state.reroll_available;

    challengeDateLabel.textContent =
        `${state.challenge_day} · Brisbane time`;

    renderChallenges(state.challenges ?? []);
    renderHistory(state.recent_completions ?? []);
    updateCountdown();
}

async function callChallengeRpc(name) {
    const {
        data,
        error
    } = await window.supabaseClient.rpc(name);

    if (error) {
        throw error;
    }

    return data;
}

async function loadChallenges(showCompletionMessage = false) {
    if (requestRunning) {
        return;
    }

    requestRunning = true;
    refreshButton.disabled = true;

    try {
        const state = await callChallengeRpc(
            "refresh_my_daily_challenges"
        );

        renderState(state);

        const newlyCompleted =
            Number(state.newly_completed ?? 0);

        if (showCompletionMessage && newlyCompleted > 0) {
            setMessage(
                newlyCompleted === 1
                    ? "Challenge complete. Rewards collected and a new challenge has been assigned."
                    : `${newlyCompleted} challenges completed. Rewards collected and new challenges assigned.`,
                "success"
            );
        } else if (showCompletionMessage) {
            setMessage("Challenge progress checked.");
        }

        window.dispatchEvent(
            new CustomEvent(
                "daily-challenges-state",
                {
                    detail: state
                }
            )
        );
    } catch (error) {
        console.error(error);
        setMessage(
            error.message
            || "Daily challenges could not be loaded.",
            "error"
        );
    } finally {
        requestRunning = false;
        refreshButton.disabled = false;
    }
}

async function rerollChallenges() {
    if (
        !challengeState?.reroll_available
        || requestRunning
    ) {
        return;
    }

    const confirmed = window.confirm(
        "Reroll all three active challenges? "
        + "Current progress in those challenges will be discarded. "
        + "You can only do this once today."
    );

    if (!confirmed) {
        return;
    }

    requestRunning = true;
    rerollButton.disabled = true;
    refreshButton.disabled = true;
    setMessage("");

    try {
        const state = await callChallengeRpc(
            "reroll_my_daily_challenges"
        );

        renderState(state);
        setMessage(
            "All three challenge slots were rerolled.",
            "success"
        );
    } catch (error) {
        console.error(error);
        setMessage(
            error.message
            || "The daily challenges could not be rerolled.",
            "error"
        );
    } finally {
        requestRunning = false;
        refreshButton.disabled = false;

        if (challengeState) {
            rerollButton.disabled =
                !challengeState.reroll_available;
        }
    }
}

async function initialiseChallenges() {
    const {
        data: { user },
        error
    } = await window.supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    await loadChallenges(false);

    refreshInterval = window.setInterval(
        () => loadChallenges(true),
        20000
    );

    countdownInterval = window.setInterval(
        updateCountdown,
        1000
    );
}

refreshButton.addEventListener(
    "click",
    () => {
        setMessage("");
        loadChallenges(true);
    }
);

rerollButton.addEventListener(
    "click",
    rerollChallenges
);

window.addEventListener(
    "daily-challenges-state",
    (event) => {
        if (
            event.detail
            && event.detail !== challengeState
        ) {
            renderState(event.detail);
        }
    }
);

window.addEventListener(
    "beforeunload",
    () => {
        if (refreshInterval) {
            window.clearInterval(refreshInterval);
        }

        if (countdownInterval) {
            window.clearInterval(countdownInterval);
        }
    }
);

initialiseChallenges();
