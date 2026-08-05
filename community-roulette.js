const walletBalanceLabel =
    document.querySelector("#wallet-balance");

const liveSpinSection =
    document.querySelector("#live-spin-section");

const liveSpinCountdown =
    document.querySelector("#live-spin-countdown");

const liveSpinResult =
    document.querySelector("#live-spin-result");

const canvas =
    document.querySelector("#roulette-canvas");

const context =
    canvas.getContext("2d");

const bettingSection =
    document.querySelector("#betting-section");

const bettingCountdown =
    document.querySelector("#betting-countdown");

const bettingStartTime =
    document.querySelector("#betting-start-time");

const betAmountInput =
    document.querySelector("#bet-amount-input");

const quickBetButtons =
    document.querySelectorAll(".quick-bet-button");

const numberBoard =
    document.querySelector("#roulette-number-board");

const outsideBetGrid =
    document.querySelector("#outside-bet-grid");

const advancedBetType =
    document.querySelector("#advanced-bet-type");

const advancedBetValue =
    document.querySelector("#advanced-bet-value");

const advancedBetHelp =
    document.querySelector("#advanced-bet-help");

const addAdvancedBetButton =
    document.querySelector("#add-advanced-bet-button");

const betSlipList =
    document.querySelector("#bet-slip-list");

const betSlipTotal =
    document.querySelector("#bet-slip-total");

const submitBetSlipButton =
    document.querySelector("#submit-bet-slip-button");

const mySubmittedSlip =
    document.querySelector("#my-submitted-slip");

const roundTotalPool =
    document.querySelector("#round-total-pool");

const publicOptionTotals =
    document.querySelector("#public-option-totals");

const publicBetFeed =
    document.querySelector("#public-bet-feed");

const previousResultSection =
    document.querySelector("#previous-result-section");

const previousResult =
    document.querySelector("#previous-result");

const messageElement =
    document.querySelector("#roulette-message");


const RED_NUMBERS = new Set([
    1, 3, 5, 7, 9,
    12, 14, 16, 18,
    19, 21, 23, 25, 27,
    30, 32, 34, 36
]);


const WHEEL_ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
    6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
    29, 7, 28, 12, 35, 3, 26
];


const OUTSIDE_BETS = [
    {
        type: "red",
        value: "",
        label: "Red",
        detail: "2× · zero refund",
        className: "red-bet"
    },
    {
        type: "black",
        value: "",
        label: "Black",
        detail: "2× · zero refund",
        className: "black-bet"
    },
    {
        type: "green",
        value: "",
        label: "Green 0",
        detail: "37×",
        className: "green-bet"
    },
    {
        type: "odd",
        value: "",
        label: "Odd",
        detail: "2× · zero refund"
    },
    {
        type: "even",
        value: "",
        label: "Even",
        detail: "2× · zero refund"
    },
    {
        type: "low",
        value: "",
        label: "1–18",
        detail: "2× · zero refund"
    },
    {
        type: "high",
        value: "",
        label: "19–36",
        detail: "2× · zero refund"
    },
    {
        type: "dozen",
        value: "1",
        label: "1st 12",
        detail: "Fair ≈3.083×"
    },
    {
        type: "dozen",
        value: "2",
        label: "2nd 12",
        detail: "Fair ≈3.083×"
    },
    {
        type: "dozen",
        value: "3",
        label: "3rd 12",
        detail: "Fair ≈3.083×"
    },
    {
        type: "column",
        value: "1",
        label: "Column 1",
        detail: "Fair ≈3.083×"
    },
    {
        type: "column",
        value: "2",
        label: "Column 2",
        detail: "Fair ≈3.083×"
    },
    {
        type: "column",
        value: "3",
        label: "Column 3",
        detail: "Fair ≈3.083×"
    }
];


const ADVANCED_HELP = {
    split: {
        placeholder: "1-2",
        value: "1-2",
        help: "Split example: 1-2 for horizontal or 1-4 for vertical. Zero may split with 1, 2 or 3."
    },
    street: {
        placeholder: "1",
        value: "1",
        help: "Street starting numbers are 1, 4, 7 and so on through 34."
    },
    trio: {
        placeholder: "0-1-2",
        value: "0-1-2",
        help: "Choose either 0-1-2 or 0-2-3."
    },
    corner: {
        placeholder: "1",
        value: "1",
        help: "Enter the top-left number of a four-number corner, such as 1 for 1-2-4-5."
    },
    six_line: {
        placeholder: "1",
        value: "1",
        help: "Six-line starting numbers are 1, 4, 7 and so on through 31."
    },
    first_four: {
        placeholder: "No value needed",
        value: "",
        help: "The first-four bet covers 0, 1, 2 and 3."
    }
};


let rouletteState = null;
let serverOffsetMilliseconds = 0;
let selectedBets = new Map();
let requestInProgress = false;
let realtimeChannel = null;
let refreshTimeout = null;
let transitionRefreshArmed = false;
let animationFrameId = null;

let canvasWidth = 0;
let canvasHeight = 0;


function formatChips(value) {
    return new Intl.NumberFormat("en-GB").format(
        Number(value ?? 0)
    );
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


function formatTime(value) {
    if (!value) {
        return "Schedule unavailable";
    }

    return new Intl.DateTimeFormat(
        "en-GB",
        {
            hour: "2-digit",
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
        `form-message ${type}`.trim();
}


function rouletteColour(number) {
    const numericNumber = Number(number);

    if (numericNumber === 0) {
        return "green";
    }

    return RED_NUMBERS.has(numericNumber)
        ? "red"
        : "black";
}


function selectionKey(type, value = "") {
    return `${type}:${value}`;
}


function readSelectionAmount() {
    const amount = Number.parseInt(
        betAmountInput.value,
        10
    );

    if (!Number.isSafeInteger(amount)) {
        showMessage(
            "Enter a valid whole-number chip amount."
        );

        return null;
    }

    if (amount < 10) {
        showMessage(
            "The minimum bet per selection is 10 chips."
        );

        return null;
    }

    if (amount > 10000) {
        showMessage(
            "The maximum bet per selection is 10,000 chips."
        );

        return null;
    }

    return amount;
}


function addSelection(
    type,
    value,
    label
) {
    if (
        requestInProgress
        || rouletteState?.betting_round?.my_slip
    ) {
        return;
    }

    const amount = readSelectionAmount();

    if (amount === null) {
        return;
    }

    const key = selectionKey(type, value);
    const existing = selectedBets.get(key);

    selectedBets.set(
        key,
        {
            type,
            value,
            label,
            amount:
                Number(existing?.amount ?? 0)
                + amount
        }
    );

    showMessage();
    renderBetSlip();
}


function removeSelection(key) {
    selectedBets.delete(key);
    renderBetSlip();
}


function selectedBetTotal() {
    return [...selectedBets.values()]
        .reduce(
            (total, bet) =>
                total + Number(bet.amount),
            0
        );
}


function renderBetSlip() {
    betSlipList.replaceChildren();

    const bets = [...selectedBets.entries()];
    const total = selectedBetTotal();

    betSlipTotal.textContent =
        `${formatChips(total)} chips`;

    if (bets.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-bet-slip";
        empty.textContent =
            "Select a number or outside bet to begin.";

        betSlipList.append(empty);
    } else {
        for (const [key, bet] of bets) {
            const row = document.createElement("article");
            row.className = "bet-slip-row";

            const copy = document.createElement("div");

            const label = document.createElement("strong");
            label.textContent = bet.label;

            const amount = document.createElement("span");
            amount.textContent =
                `${formatChips(bet.amount)} chips`;

            copy.append(label, amount);

            const removeButton =
                document.createElement("button");

            removeButton.type = "button";
            removeButton.className =
                "secondary-button remove-slip-button";
            removeButton.textContent = "Remove";

            removeButton.addEventListener(
                "click",
                () => removeSelection(key)
            );

            row.append(copy, removeButton);
            betSlipList.append(row);
        }
    }

    const wallet = Number(
        rouletteState?.wallet_chips ?? 0
    );

    const bettingAvailable = Boolean(
        rouletteState?.betting_round
    );

    const alreadySubmitted = Boolean(
        rouletteState?.betting_round?.my_slip
    );

    submitBetSlipButton.disabled =
        requestInProgress
        || !bettingAvailable
        || alreadySubmitted
        || bets.length === 0
        || total > wallet
        || total > 40000;

    if (total > wallet) {
        showMessage(
            "Your selected bets exceed your wallet balance."
        );
    } else if (total > 40000) {
        showMessage(
            "The maximum total bet per round is 40,000 chips."
        );
    }
}


function buildNumberBoard() {
    numberBoard.replaceChildren();

    for (let number = 0; number <= 36; number += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
            `roulette-number roulette-number-${rouletteColour(number)}`;
        button.textContent = String(number);
        button.dataset.number = String(number);

        if (number === 0) {
            button.classList.add("roulette-zero-number");
        }

        button.addEventListener(
            "click",
            () => {
                addSelection(
                    "straight",
                    String(number),
                    `Number ${number}`
                );
            }
        );

        numberBoard.append(button);
    }
}


function buildOutsideBets() {
    outsideBetGrid.replaceChildren();

    for (const option of OUTSIDE_BETS) {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
            `outside-bet-button ${option.className ?? ""}`.trim();

        const label = document.createElement("strong");
        label.textContent = option.label;

        const detail = document.createElement("span");
        detail.textContent = option.detail;

        button.append(label, detail);

        button.addEventListener(
            "click",
            () => {
                addSelection(
                    option.type,
                    option.value,
                    option.label
                );
            }
        );

        outsideBetGrid.append(button);
    }
}


function updateAdvancedBetHelp() {
    const type = advancedBetType.value;
    const configuration = ADVANCED_HELP[type];

    advancedBetValue.placeholder =
        configuration.placeholder;

    advancedBetValue.value =
        configuration.value;

    advancedBetValue.disabled =
        type === "first_four";

    advancedBetHelp.textContent =
        configuration.help;
}


function advancedBetLabel(type, value) {
    switch (type) {
        case "split":
            return `Split ${value}`;

        case "street": {
            const start = Number(value);
            return Number.isInteger(start)
                ? `Street ${start}–${start + 2}`
                : `Street ${value}`;
        }

        case "trio":
            return `Trio ${value}`;

        case "corner":
            return `Corner from ${value}`;

        case "six_line": {
            const start = Number(value);
            return Number.isInteger(start)
                ? `Six line ${start}–${start + 5}`
                : `Six line ${value}`;
        }

        case "first_four":
            return "First four 0-1-2-3";

        default:
            return "Advanced bet";
    }
}


function addAdvancedSelection() {
    const type = advancedBetType.value;
    const value = type === "first_four"
        ? ""
        : advancedBetValue.value.trim();

    if (type !== "first_four" && !value) {
        showMessage(
            "Enter the numbers for the advanced bet."
        );
        return;
    }

    addSelection(
        type,
        value,
        advancedBetLabel(type, value)
    );
}


function renderMySubmittedSlip(round) {
    const slip = round?.my_slip;

    if (!slip) {
        mySubmittedSlip.classList.add("hidden");
        mySubmittedSlip.replaceChildren();
        return;
    }

    mySubmittedSlip.classList.remove("hidden");
    mySubmittedSlip.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "submitted-slip-heading";

    const title = document.createElement("strong");
    title.textContent = "Bet slip submitted";

    const total = document.createElement("span");
    total.textContent =
        `${formatChips(slip.total_amount)} chips`;

    heading.append(title, total);

    const list = document.createElement("div");
    list.className = "submitted-slip-list";

    for (const bet of slip.bets ?? []) {
        const row = document.createElement("span");
        row.textContent =
            `${bet.label}: ${formatChips(bet.amount)}`;
        list.append(row);
    }

    mySubmittedSlip.append(heading, list);
}


function renderPublicTotals(round) {
    publicOptionTotals.replaceChildren();

    roundTotalPool.textContent =
        `${formatChips(round?.total_pool ?? 0)} chips`;

    const totals = round?.option_totals ?? [];

    if (totals.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-community-data";
        empty.textContent = "No bets have been placed yet.";
        publicOptionTotals.append(empty);
        return;
    }

    for (const option of totals) {
        const row = document.createElement("article");
        row.className = "public-total-row";

        const copy = document.createElement("div");

        const label = document.createElement("strong");
        label.textContent = option.label;

        const bettors = document.createElement("span");
        const count = Number(option.bettor_count ?? 0);
        bettors.textContent =
            `${count} ${count === 1 ? "player" : "players"}`;

        copy.append(label, bettors);

        const amount = document.createElement("strong");
        amount.className = "public-total-amount";
        amount.textContent =
            `${formatChips(option.total_amount)} chips`;

        row.append(copy, amount);
        publicOptionTotals.append(row);
    }
}


function renderPublicBets(round) {
    publicBetFeed.replaceChildren();

    const bets = round?.public_bets ?? [];

    if (bets.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-community-data";
        empty.textContent = "Nobody has bet yet.";
        publicBetFeed.append(empty);
        return;
    }

    for (const bet of bets.slice(0, 80)) {
        const row = document.createElement("article");
        row.className = "public-bet-row";

        const copy = document.createElement("div");

        const username = document.createElement("strong");
        username.textContent = bet.username;

        const label = document.createElement("span");
        label.textContent = bet.label;

        copy.append(username, label);

        const amount = document.createElement("strong");
        amount.textContent =
            `${formatChips(bet.amount)} chips`;

        row.append(copy, amount);
        publicBetFeed.append(row);
    }
}


function renderPreviousResult(round) {
    if (!round) {
        previousResultSection.classList.add("hidden");
        return;
    }

    previousResultSection.classList.remove("hidden");
    previousResult.replaceChildren();

    const resultCard = document.createElement("div");
    resultCard.className =
        `previous-result-card result-${round.winning_colour}`;

    const number = document.createElement("strong");
    number.className = "previous-result-number";
    number.textContent = String(round.winning_number);

    const details = document.createElement("div");

    const colour = document.createElement("strong");
    colour.textContent =
        `${String(round.winning_colour).toUpperCase()} result`;

    const pool = document.createElement("span");
    pool.textContent =
        `${formatChips(round.total_pool)} chips wagered · `
        + `${formatChips(round.total_payout)} returned`;

    details.append(colour, pool);
    resultCard.append(number, details);
    previousResult.append(resultCard);
}


function setRequestInProgress(value) {
    requestInProgress = value;

    submitBetSlipButton.textContent = value
        ? "Submitting..."
        : "Submit bet slip";

    betAmountInput.disabled = value;
    advancedBetType.disabled = value;
    advancedBetValue.disabled =
        value || advancedBetType.value === "first_four";
    addAdvancedBetButton.disabled = value;

    for (const button of quickBetButtons) {
        button.disabled = value;
    }

    for (const button of document.querySelectorAll(
        ".roulette-number, .outside-bet-button, .remove-slip-button"
    )) {
        button.disabled = value;
    }

    renderBetSlip();
}


async function submitBetSlip() {
    if (requestInProgress) {
        return;
    }

    const round = rouletteState?.betting_round;

    if (!round) {
        showMessage("There is no open roulette round.");
        return;
    }

    if (round.my_slip) {
        showMessage(
            "You have already submitted a slip for this round."
        );
        return;
    }

    const bets = [...selectedBets.values()];

    if (bets.length === 0) {
        showMessage("Add at least one roulette selection.");
        return;
    }

    setRequestInProgress(true);
    showMessage();

    try {
        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "place_community_roulette_bets",
            {
                p_round_id: round.id,
                p_bets: bets.map(
                    (bet) => ({
                        type: bet.type,
                        value: bet.value,
                        amount: bet.amount
                    })
                )
            }
        );

        if (error) {
            throw error;
        }

        selectedBets.clear();
        applyState(data);

        showMessage(
            "Your community roulette bet slip has been submitted.",
            "success"
        );
    } catch (error) {
        console.error(error);

        showMessage(
            error.message
            || "The roulette bet slip could not be submitted."
        );
    } finally {
        setRequestInProgress(false);
    }
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


function resizeCanvas(
    round = rouletteState?.spinning_round ?? null
) {
    const rectangle = canvas.getBoundingClientRect();

    // The live-spin section starts hidden. A hidden canvas reports a size
    // of 0 x 0, so never replace its drawing buffer with zero dimensions.
    if (
        rectangle.width <= 0
        || rectangle.height <= 0
    ) {
        return false;
    }

    const scale = Math.min(
        window.devicePixelRatio || 1,
        2
    );

    canvasWidth = rectangle.width;
    canvasHeight = rectangle.height;

    const pixelWidth = Math.max(
        Math.round(canvasWidth * scale),
        1
    );

    const pixelHeight = Math.max(
        Math.round(canvasHeight * scale),
        1
    );

    if (
        canvas.width !== pixelWidth
        || canvas.height !== pixelHeight
    ) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
    }

    context.setTransform(
        scale,
        0,
        0,
        scale,
        0,
        0
    );

    drawRouletteWheel(round);
    return true;
}


function easeOutQuint(value) {
    return 1 - Math.pow(1 - value, 5);
}


function wheelAngleForRound(round) {
    if (!round || round.winning_number === null) {
        return 0;
    }

    const start = Date.parse(round.starts_at);
    const end = Date.parse(round.ends_at);
    const duration = Math.max(end - start, 1);

    const progress = Math.min(
        Math.max(
            (currentServerTime() - start) / duration,
            0
        ),
        1
    );

    const random = createSeededRandom(
        Number(round.animation_seed)
    );

    const startAngle = random() * Math.PI * 2;
    const rotations = 8 + Math.floor(random() * 4);

    const winningIndex = WHEEL_ORDER.indexOf(
        Number(round.winning_number)
    );

    const segmentAngle =
        Math.PI * 2 / WHEEL_ORDER.length;

    const targetAngle =
        -Math.PI / 2
        - (winningIndex + 0.5) * segmentAngle;

    let delta = targetAngle - startAngle;

    while (delta < 0) {
        delta += Math.PI * 2;
    }

    delta += rotations * Math.PI * 2;

    return startAngle + delta * easeOutQuint(progress);
}


function drawRouletteWheel(round) {
    if (canvasWidth <= 0 || canvasHeight <= 0) {
        return;
    }

    context.clearRect(
        0,
        0,
        canvasWidth,
        canvasHeight
    );

    const centreX = canvasWidth / 2;
    const centreY = canvasHeight / 2;
    const radius = Math.min(
        canvasWidth,
        canvasHeight
    ) * 0.43;

    const angle = wheelAngleForRound(round);
    const segmentAngle =
        Math.PI * 2 / WHEEL_ORDER.length;

    const background = context.createRadialGradient(
        centreX,
        centreY,
        radius * 0.1,
        centreX,
        centreY,
        radius * 1.25
    );

    background.addColorStop(0, "#263247");
    background.addColorStop(1, "#070b12");

    context.fillStyle = background;
    context.fillRect(
        0,
        0,
        canvasWidth,
        canvasHeight
    );

    context.save();
    context.translate(centreX, centreY);
    context.rotate(angle);

    for (
        let index = 0;
        index < WHEEL_ORDER.length;
        index += 1
    ) {
        const number = WHEEL_ORDER[index];
        const startAngle = index * segmentAngle;
        const endAngle = startAngle + segmentAngle;

        context.beginPath();
        context.moveTo(0, 0);
        context.arc(
            0,
            0,
            radius,
            startAngle,
            endAngle
        );
        context.closePath();

        const colour = rouletteColour(number);

        context.fillStyle = colour === "green"
            ? "#16734e"
            : colour === "red"
                ? "#9d3343"
                : "#171d28";

        context.fill();

        context.strokeStyle =
            "rgba(255, 255, 255, 0.2)";
        context.lineWidth = 1;
        context.stroke();

        context.save();
        context.rotate(
            startAngle + segmentAngle / 2
        );
        context.translate(radius * 0.83, 0);
        context.rotate(Math.PI / 2);

        context.fillStyle = "#f5f7fb";
        context.font =
            `${Math.max(9, radius * 0.045)}px system-ui`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(number), 0, 0);

        context.restore();
    }

    context.beginPath();
    context.arc(0, 0, radius * 0.52, 0, Math.PI * 2);
    context.fillStyle = "#b38a3e";
    context.fill();

    context.beginPath();
    context.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
    context.fillStyle = "#101722";
    context.fill();

    context.restore();

    context.beginPath();
    context.moveTo(centreX, centreY - radius - 13);
    context.lineTo(centreX - 13, centreY - radius - 38);
    context.lineTo(centreX + 13, centreY - radius - 38);
    context.closePath();
    context.fillStyle = "#ffe192";
    context.fill();

    context.beginPath();
    context.arc(
        centreX,
        centreY - radius * 0.94,
        Math.max(7, radius * 0.035),
        0,
        Math.PI * 2
    );
    context.fillStyle = "#ffffff";
    context.shadowColor = "rgba(255, 255, 255, 0.8)";
    context.shadowBlur = 10;
    context.fill();
    context.shadowBlur = 0;
}


function renderSpinningRound(round) {
    if (!round) {
        liveSpinSection.classList.add("hidden");
        return;
    }

    liveSpinSection.classList.remove("hidden");

    // The canvas may previously have been measured while this section was
    // hidden. Resize it immediately now that it has a real layout size.
    if (!resizeCanvas(round)) {
        requestAnimationFrame(
            () => resizeCanvas(round)
        );
    }

    const remaining =
        Date.parse(round.ends_at)
        - currentServerTime();

    liveSpinCountdown.textContent =
        formatClock(remaining);

    liveSpinResult.textContent = remaining <= 0
        ? "Finalising payouts..."
        : "All players are watching the same synchronised spin.";

    drawRouletteWheel(round);
}


function renderBettingRound(round) {
    if (!round) {
        bettingSection.classList.add("hidden");
        renderPublicTotals(null);
        renderPublicBets(null);
        return;
    }

    bettingSection.classList.remove("hidden");

    bettingStartTime.textContent =
        `Spin begins at ${formatTime(round.starts_at)}`;

    const remaining =
        Date.parse(round.starts_at)
        - currentServerTime();

    bettingCountdown.textContent =
        formatClock(remaining);

    renderMySubmittedSlip(round);
    renderPublicTotals(round);
    renderPublicBets(round);

    const alreadySubmitted = Boolean(round.my_slip);

    for (const button of document.querySelectorAll(
        ".roulette-number, .outside-bet-button"
    )) {
        button.disabled =
            requestInProgress || alreadySubmitted;
    }

    advancedBetType.disabled =
        requestInProgress || alreadySubmitted;

    advancedBetValue.disabled =
        requestInProgress
        || alreadySubmitted
        || advancedBetType.value === "first_four";

    addAdvancedBetButton.disabled =
        requestInProgress || alreadySubmitted;

    betAmountInput.disabled =
        requestInProgress || alreadySubmitted;

    renderBetSlip();
}


function applyState(state) {
    rouletteState = state;

    serverOffsetMilliseconds =
        Date.parse(state.server_now)
        - Date.now();

    walletBalanceLabel.textContent =
        formatChips(state.wallet_chips);

    betAmountInput.max = Math.min(
        Number(state.maximum_bet_per_selection ?? 10000),
        Number(state.wallet_chips ?? 0)
    );

    renderSpinningRound(state.spinning_round);
    renderBettingRound(state.betting_round);
    renderPreviousResult(state.previous_round);

    transitionRefreshArmed = false;
}


async function loadRouletteState() {
    const {
        data,
        error
    } = await window.supabaseClient.rpc(
        "get_community_roulette_state"
    );

    if (error) {
        throw error;
    }

    applyState(data);
}


function scheduleRefresh(delay = 120) {
    window.clearTimeout(refreshTimeout);

    refreshTimeout = window.setTimeout(
        async () => {
            try {
                await loadRouletteState();
            } catch (error) {
                console.error(error);
            }
        },
        delay
    );
}


function updateTimersAndAnimation() {
    const bettingRound =
        rouletteState?.betting_round;

    const spinningRound =
        rouletteState?.spinning_round;

    if (bettingRound) {
        const bettingRemaining =
            Date.parse(bettingRound.starts_at)
            - currentServerTime();

        bettingCountdown.textContent =
            formatClock(bettingRemaining);

        if (
            bettingRemaining <= 0
            && !transitionRefreshArmed
        ) {
            transitionRefreshArmed = true;
            scheduleRefresh(250);
        }
    }

    if (spinningRound) {
        const spinRemaining =
            Date.parse(spinningRound.ends_at)
            - currentServerTime();

        liveSpinCountdown.textContent =
            formatClock(spinRemaining);

        drawRouletteWheel(spinningRound);

        if (
            spinRemaining <= 0
            && !transitionRefreshArmed
        ) {
            transitionRefreshArmed = true;
            scheduleRefresh(250);
        }
    }

    animationFrameId = requestAnimationFrame(
        updateTimersAndAnimation
    );
}


function subscribeToRouletteChanges() {
    realtimeChannel = window.supabaseClient
        .channel("community-roulette-live")

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "community_roulette_rounds"
            },
            () => scheduleRefresh()
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "community_roulette_bet_slips"
            },
            () => scheduleRefresh()
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "community_roulette_bets"
            },
            () => scheduleRefresh()
        )

        .subscribe();
}


submitBetSlipButton.addEventListener(
    "click",
    submitBetSlip
);


for (const button of quickBetButtons) {
    button.addEventListener(
        "click",
        () => {
            betAmountInput.value =
                button.dataset.bet;
        }
    );
}


advancedBetType.addEventListener(
    "change",
    updateAdvancedBetHelp
);


addAdvancedBetButton.addEventListener(
    "click",
    addAdvancedSelection
);


window.addEventListener(
    "resize",
    resizeCanvas
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


async function initialiseCommunityRoulette() {
    try {
        const {
            data: {
                user
            },
            error
        } = await window.supabaseClient.auth.getUser();

        if (error || !user) {
            window.location.href = "login.html";
            return;
        }

        buildNumberBoard();
        buildOutsideBets();
        updateAdvancedBetHelp();
        renderBetSlip();

        resizeCanvas();

        await loadRouletteState();

        subscribeToRouletteChanges();

        animationFrameId = requestAnimationFrame(
            updateTimersAndAnimation
        );
    } catch (error) {
        console.error(error);

        showMessage(
            error.message
            || "Community Roulette could not be loaded."
        );
    }
}


initialiseCommunityRoulette();
