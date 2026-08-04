const walletBalanceLabel =
    document.querySelector("#wallet-balance");

const machinePicker =
    document.querySelector("#slot-machine-picker");

const selectedMachineSubtitle =
    document.querySelector("#selected-machine-subtitle");

const selectedMachineName =
    document.querySelector("#selected-machine-name");

const selectedMachineVolatility =
    document.querySelector("#selected-machine-volatility");

const selectedMachineRtp =
    document.querySelector("#selected-machine-rtp");

const freeSpinBadge =
    document.querySelector("#free-spin-badge");

const reelsElement =
    document.querySelector("#slot-reels");

const winningLinesElement =
    document.querySelector("#slot-winning-lines");

const resultElement =
    document.querySelector("#slot-result");

const betButtonsElement =
    document.querySelector("#slot-bet-buttons");

const betBreakdown =
    document.querySelector("#slot-bet-breakdown");

const fastModeInput =
    document.querySelector("#slot-fast-mode");

const spinButton =
    document.querySelector("#slot-spin-button");

const messageElement =
    document.querySelector("#slot-message");

const statisticsElement =
    document.querySelector("#slot-statistics");

const paytableTitle =
    document.querySelector("#slot-paytable-title");

const paytableDescription =
    document.querySelector("#slot-paytable-description");

const paytableElement =
    document.querySelector("#slot-paytable");

const historyElement =
    document.querySelector("#slot-history");


const STORAGE_KEYS = {
    machine: "slot-machine-selected",
    bet: "slot-machine-bet",
    fast: "slot-machine-fast"
};


const PAYLINES = [
    [2, 2, 2, 2, 2],
    [1, 1, 1, 1, 1],
    [3, 3, 3, 3, 3],
    [1, 2, 3, 2, 1],
    [3, 2, 1, 2, 3],
    [1, 1, 2, 3, 3],
    [3, 3, 2, 1, 1],
    [2, 1, 1, 1, 2],
    [2, 3, 3, 3, 2],
    [1, 2, 2, 2, 3]
];


const MACHINE_DETAILS = {
    classic: {
        icon: "7️⃣",
        name: "Lucky Sevens",
        subtitle: "Classic Fair Mode",
        eyebrow: "CLASSIC 50 / 50 MACHINE",
        volatility: "50 / 50 odds",
        rtp: "100% RTP",
        description:
            "Every spin has a 50% chance to return twice the total bet and a 50% chance to return nothing.",
        symbols: {
            CHERRY: { glyph: "🍒", label: "Cherry" },
            LEMON: { glyph: "🍋", label: "Lemon" },
            ORANGE: { glyph: "🍊", label: "Orange" },
            BELL: { glyph: "🔔", label: "Bell" },
            BAR: { glyph: "▰", label: "Bar" },
            SEVEN: { glyph: "7️⃣", label: "Seven" },
            WILD: { glyph: "⭐", label: "Star" }
        }
    },

    neon: {
        icon: "⚡",
        name: "Neon Rush",
        subtitle: "Neon Fair Mode",
        eyebrow: "NEON 50 / 50 MACHINE",
        volatility: "50 / 50 odds",
        rtp: "100% RTP",
        description:
            "The neon cabinet uses the same exact fair odds: half of spins pay 2× the total bet and half pay 0.",
        symbols: {
            COIN: { glyph: "🪙", label: "Coin" },
            PLUM: { glyph: "🟣", label: "Neon plum" },
            DIAMOND: { glyph: "💎", label: "Diamond" },
            LIGHTNING: { glyph: "⚡", label: "Lightning" },
            CROWN: { glyph: "👑", label: "Crown" },
            WILD: { glyph: "🌈", label: "Prism" }
        }
    },

    cosmic: {
        icon: "🪐",
        name: "Cosmic Vault",
        subtitle: "Cosmic Fair Mode",
        eyebrow: "COSMIC 50 / 50 MACHINE",
        volatility: "50 / 50 odds",
        rtp: "100% RTP",
        description:
            "Cosmic Vault now uses the same transparent 50 / 50 result, without bonus spins that would push RTP above 100%.",
        symbols: {
            STAR: { glyph: "✨", label: "Star" },
            MOON: { glyph: "🌙", label: "Moon" },
            PLANET: { glyph: "🪐", label: "Planet" },
            ROCKET: { glyph: "🚀", label: "Rocket" },
            ALIEN: { glyph: "👽", label: "Alien" },
            WILD: { glyph: "🌌", label: "Galaxy" }
        }
    }
};


let slotState = null;

let selectedMachineCode =
    window.localStorage.getItem(
        STORAGE_KEYS.machine
    )
    || "classic";

let selectedBet =
    Number(
        window.localStorage.getItem(
            STORAGE_KEYS.bet
        )
    )
    || 10;

let spinInProgress = false;

let currentGrid = null;


function formatChips(value) {
    return new Intl.NumberFormat(
        "en-AU"
    ).format(
        Number(value ?? 0)
    );
}


function signedChips(value) {
    const number = Number(value ?? 0);

    if (number > 0) {
        return `+${formatChips(number)}`;
    }

    if (number < 0) {
        return `−${formatChips(Math.abs(number))}`;
    }

    return "0";
}


function showMessage(
    message = "",
    type = "error"
) {
    messageElement.textContent = message;

    messageElement.className =
        `form-message ${type}`.trim();
}


function selectedMachine() {
    return (
        MACHINE_DETAILS[selectedMachineCode]
        ?? MACHINE_DETAILS.classic
    );
}


function selectedMachineState() {
    return (
        slotState?.machine_states?.[
            selectedMachineCode
        ]
        ?? {
            free_spins: 0,
            free_spin_bet: 0
        }
    );
}


function availableBetOptions() {
    return (
        slotState?.rules?.bet_options
        ?? [
            10,
            50,
            100,
            250,
            500,
            1000,
            2500,
            5000
        ]
    ).map(Number);
}


function randomSymbolCode(machineCode) {
    const symbolCodes =
        Object.keys(
            MACHINE_DETAILS[machineCode].symbols
        );

    return symbolCodes[
        Math.floor(
            Math.random() * symbolCodes.length
        )
    ];
}


function createSymbolCell(
    machineCode,
    symbolCode,
    row,
    reel
) {
    const symbol =
        MACHINE_DETAILS[machineCode]
            .symbols[symbolCode]
        ?? {
            glyph: "?",
            label: symbolCode
        };

    const cell =
        document.createElement("div");

    cell.className = "slot-symbol-cell";
    cell.dataset.row = String(row);
    cell.dataset.reel = String(reel);
    cell.dataset.symbol = symbolCode;

    const glyph =
        document.createElement("span");

    glyph.className = "slot-symbol-glyph";
    glyph.textContent = symbol.glyph;

    const label =
        document.createElement("span");

    label.className = "slot-symbol-label";
    label.textContent = symbol.label;

    cell.append(glyph, label);

    return cell;
}


function defaultGrid(machineCode) {
    return Array.from(
        {
            length: 3
        },
        () =>
            Array.from(
                {
                    length: 5
                },
                () =>
                    randomSymbolCode(machineCode)
            )
    );
}


function renderGrid(
    grid = currentGrid
        ?? defaultGrid(selectedMachineCode)
) {
    currentGrid = grid;

    reelsElement.replaceChildren();

    for (
        let reel = 0;
        reel < 5;
        reel += 1
    ) {
        const reelElement =
            document.createElement("div");

        reelElement.className = "slot-reel";
        reelElement.dataset.reel =
            String(reel + 1);

        for (
            let row = 0;
            row < 3;
            row += 1
        ) {
            reelElement.append(
                createSymbolCell(
                    selectedMachineCode,
                    grid[row][reel],
                    row + 1,
                    reel + 1
                )
            );
        }

        reelsElement.append(reelElement);
    }
}


function clearWinHighlights() {
    reelsElement
        .querySelectorAll(
            ".winning, .scatter-winning"
        )
        .forEach((cell) => {
            cell.classList.remove(
                "winning",
                "scatter-winning"
            );
        });
}


function highlightSpinResult(spin) {
    clearWinHighlights();

    for (
        const line
        of spin.winning_lines ?? []
    ) {
        const rows = line.rows ?? [];

        rows.forEach(
            (row, reelIndex) => {
                reelsElement
                    .querySelector(
                        `[data-row="${row}"]`
                        + `[data-reel="${reelIndex + 1}"]`
                    )
                    ?.classList.add("winning");
            }
        );
    }

    if (Number(spin.scatter_count) >= 3) {
        reelsElement
            .querySelectorAll(
                '[data-symbol="SCATTER"]'
            )
            .forEach((cell) => {
                cell.classList.add(
                    "scatter-winning"
                );
            });
    }
}


function renderWinningLines(spin = null) {
    winningLinesElement.replaceChildren();

    if (!spin) {
        const empty =
            document.createElement("span");

        empty.className =
            "slot-no-line-win";

        empty.textContent =
            "Ten paylines are active.";

        winningLinesElement.append(empty);
        return;
    }

    for (
        const line
        of spin.winning_lines ?? []
    ) {
        const badge =
            document.createElement("span");

        badge.className =
            "slot-winning-line";

        badge.textContent =
            `Line ${line.line}: `
            + `${line.count} ${line.symbol}`
            + ` · ${line.multiplier}×`;

        winningLinesElement.append(badge);
    }

    if (
        Number(spin.scatter_multiplier) > 0
    ) {
        const scatter =
            document.createElement("span");

        scatter.className =
            "slot-winning-line slot-scatter-win";

        scatter.textContent =
            `${spin.scatter_count} scatters`
            + ` · ${spin.scatter_multiplier}× total bet`;

        winningLinesElement.append(scatter);
    }

    if (
        winningLinesElement.children.length
        === 0
    ) {
        const empty =
            document.createElement("span");

        empty.className =
            "slot-no-line-win";

        empty.textContent =
            "No winning line on this spin.";

        winningLinesElement.append(empty);
    }
}


function updateMachineHeading() {
    const machine = selectedMachine();

    selectedMachineSubtitle.textContent =
        machine.eyebrow;

    selectedMachineName.textContent =
        machine.name;

    selectedMachineVolatility.textContent =
        machine.volatility;

    selectedMachineRtp.textContent =
        machine.rtp;

    const machineState =
        selectedMachineState();

    const freeSpins =
        Number(machineState.free_spins ?? 0);

    freeSpinBadge.classList.toggle(
        "hidden",
        freeSpins <= 0
    );

    freeSpinBadge.textContent =
        `${formatChips(freeSpins)} free `
        + `${freeSpins === 1 ? "spin" : "spins"}`;
}


function renderMachinePicker() {
    machinePicker.replaceChildren();

    for (
        const machineCode
        of Object.keys(MACHINE_DETAILS)
    ) {
        const machine =
            MACHINE_DETAILS[machineCode];

        const machineState =
            slotState?.machine_states?.[
                machineCode
            ];

        const button =
            document.createElement("button");

        button.type = "button";
        button.className =
            "slot-machine-card";

        button.classList.toggle(
            "selected",
            machineCode
                === selectedMachineCode
        );

        button.setAttribute(
            "aria-pressed",
            String(
                machineCode
                    === selectedMachineCode
            )
        );

        const icon =
            document.createElement("span");

        icon.className =
            "slot-machine-icon";

        icon.textContent =
            machine.icon;

        const copy =
            document.createElement("span");

        copy.className =
            "slot-machine-copy";

        const name =
            document.createElement("strong");

        name.textContent =
            machine.name;

        const subtitle =
            document.createElement("span");

        subtitle.textContent =
            machine.subtitle;

        const meta =
            document.createElement("span");

        meta.className =
            "slot-machine-meta";

        const volatility =
            document.createElement("small");

        volatility.textContent =
            machine.volatility;

        const rtp =
            document.createElement("small");

        rtp.textContent =
            machine.rtp;

        meta.append(volatility, rtp);

        const freeSpins =
            Number(
                machineState?.free_spins
                ?? 0
            );

        if (freeSpins > 0) {
            const free =
                document.createElement("small");

            free.className =
                "slot-machine-free-spins";

            free.textContent =
                `${freeSpins} free`;

            meta.append(free);
        }

        copy.append(
            name,
            subtitle,
            meta
        );

        button.append(icon, copy);

        button.addEventListener(
            "click",
            () => {
                if (spinInProgress) {
                    return;
                }

                selectedMachineCode =
                    machineCode;

                window.localStorage.setItem(
                    STORAGE_KEYS.machine,
                    machineCode
                );

                currentGrid =
                    defaultGrid(machineCode);

                renderEverything();
            }
        );

        machinePicker.append(button);
    }
}


function renderBetButtons() {
    betButtonsElement.replaceChildren();

    const options =
        availableBetOptions();

    if (!options.includes(selectedBet)) {
        selectedBet = options[0] ?? 10;
    }

    for (const amount of options) {
        const button =
            document.createElement("button");

        button.type = "button";
        button.className =
            "slot-bet-button";

        button.dataset.bet =
            String(amount);

        button.textContent =
            formatChips(amount);

        button.classList.toggle(
            "selected",
            amount === selectedBet
        );

        button.disabled =
            spinInProgress;

        button.addEventListener(
            "click",
            () => {
                selectedBet = amount;

                window.localStorage.setItem(
                    STORAGE_KEYS.bet,
                    String(amount)
                );

                renderBetButtons();
                updateControls();
            }
        );

        betButtonsElement.append(button);
    }

    betBreakdown.textContent =
        `10 paylines · `
        + `${formatChips(selectedBet / 10)} `
        + `${selectedBet / 10 === 1
            ? "chip"
            : "chips"} per line`;
}


function updateControls() {
    const wallet =
        Number(
            slotState?.wallet_chips
            ?? 0
        );

    walletBalanceLabel.textContent =
        formatChips(wallet);

    const freeSpins =
        Number(
            selectedMachineState()
                .free_spins
            ?? 0
        );

    const canUseFreeSpin =
        freeSpins > 0;

    spinButton.disabled =
        spinInProgress
        || (
            !canUseFreeSpin
            && wallet < selectedBet
        );

    spinButton.classList.toggle(
        "free-spin-ready",
        canUseFreeSpin
    );

    if (spinInProgress) {
        spinButton.textContent =
            canUseFreeSpin
                ? "Opening free spin..."
                : "Spinning...";
    } else if (canUseFreeSpin) {
        spinButton.textContent =
            `Use free spin · ${freeSpins} left`;
    } else {
        spinButton.textContent =
            `Spin · ${formatChips(selectedBet)} chips`;
    }

    betButtonsElement
        .querySelectorAll("button")
        .forEach((button) => {
            button.disabled =
                spinInProgress;
        });
}


function renderStatistics() {
    statisticsElement.replaceChildren();

    const statistics =
        slotState?.statistics
        ?? {};

    const net =
        Number(statistics.net ?? 0);

    const cards = [
        {
            label: "Paid spins",
            value: formatChips(
                statistics.paid_spins
            )
        },
        {
            label: "Free spins played",
            value: formatChips(
                statistics.free_spins
            )
        },
        {
            label: "Total wagered",
            value:
                `${formatChips(
                    statistics.total_wagered
                )} chips`
        },
        {
            label: "Total paid",
            value:
                `${formatChips(
                    statistics.total_paid
                )} chips`
        },
        {
            label: "Net result",
            value:
                `${signedChips(net)} chips`,
            className:
                net > 0
                    ? "positive"
                    : net < 0
                        ? "negative"
                        : ""
        },
        {
            label: "Biggest payout",
            value:
                `${formatChips(
                    statistics.biggest_win
                )} chips`
        }
    ];

    for (const cardData of cards) {
        const card =
            document.createElement("article");

        card.className =
            "slot-stat-card";

        if (cardData.className) {
            card.classList.add(
                cardData.className
            );
        }

        const label =
            document.createElement("span");

        label.textContent =
            cardData.label;

        const value =
            document.createElement("strong");

        value.textContent =
            cardData.value;

        card.append(label, value);
        statisticsElement.append(card);
    }
}


function renderPaytable() {
    const machine = selectedMachine();

    paytableTitle.textContent =
        `${machine.name} Fair Mode`;

    paytableDescription.textContent =
        machine.description
        + " The cabinets differ visually, not financially.";

    paytableElement.replaceChildren();

    const rows = [
        {
            label: "Winning spin",
            chance: "50%",
            payout: "2× total bet",
            net: "+1× bet"
        },
        {
            label: "Losing spin",
            chance: "50%",
            payout: "0× total bet",
            net: "−1× bet"
        },
        {
            label: "Long-run average",
            chance: "Expected",
            payout: "1× total bet",
            net: "100% RTP"
        }
    ];

    const heading =
        document.createElement("div");

    heading.className =
        "slot-paytable-row "
        + "slot-paytable-heading-row";

    for (
        const headingText
        of [
            "Outcome",
            "Chance",
            "Payout",
            "Net"
        ]
    ) {
        const cell =
            document.createElement("span");

        cell.className =
            headingText === "Outcome"
                ? "slot-paytable-symbol"
                : "slot-paytable-value";

        cell.textContent =
            headingText;

        heading.append(cell);
    }

    paytableElement.append(heading);

    for (const rowData of rows) {
        const row =
            document.createElement("div");

        row.className =
            "slot-paytable-row";

        const outcome =
            document.createElement("span");

        outcome.className =
            "slot-paytable-symbol";

        const label =
            document.createElement("strong");

        label.textContent =
            rowData.label;

        outcome.append(label);

        for (
            const valueText
            of [
                rowData.chance,
                rowData.payout,
                rowData.net
            ]
        ) {
            const value =
                document.createElement("span");

            value.className =
                "slot-paytable-value";

            value.textContent =
                valueText;

            row.append(
                value
            );
        }

        row.prepend(outcome);
        paytableElement.append(row);
    }
}


function machineName(machineCode) {
    return (
        MACHINE_DETAILS[machineCode]?.name
        ?? machineCode
    );
}


function createHistoryRow(spin) {
    const row =
        document.createElement("article");

    row.className =
        "slot-history-row";

    const net =
        Number(spin.net ?? 0);

    row.classList.add(
        net > 0
            ? "win"
            : "loss"
    );

    const game =
        document.createElement("div");

    const gameName =
        document.createElement("strong");

    gameName.textContent =
        machineName(
            spin.machine_code
        );

    const gameDetails =
        document.createElement("span");

    gameDetails.textContent =
        `${formatChips(
            spin.total_bet
        )} chip bet`;

    game.append(
        gameName,
        gameDetails
    );

    const extras =
        document.createElement("div");

    const extraHeading =
        document.createElement("strong");

    const freeAward =
        Number(
            spin.free_spins_awarded
            ?? 0
        );

    extraHeading.textContent =
        Number(spin.payout) > 0
            ? "50 / 50 win"
            : "50 / 50 loss";

    const time =
        document.createElement("time");

    time.dateTime =
        spin.created_at;

    time.textContent =
        new Intl.DateTimeFormat(
            "en-AU",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(
            new Date(
                spin.created_at
            )
        );

    extras.append(
        extraHeading,
        time
    );

    const result =
        document.createElement("div");

    result.className =
        "slot-history-result";

    const resultHeading =
        document.createElement("strong");

    resultHeading.textContent =
        `${signedChips(net)} chips`;

    const payout =
        document.createElement("span");

    payout.textContent =
        `${formatChips(
            spin.payout
        )} paid`;

    result.append(
        resultHeading,
        payout
    );

    row.append(
        game,
        extras,
        result
    );

    return row;
}


function renderHistory() {
    historyElement.replaceChildren();

    const spins =
        slotState?.recent_spins
        ?? [];

    if (spins.length === 0) {
        const empty =
            document.createElement("p");

        empty.className =
            "empty-slot-history";

        empty.textContent =
            "No spins yet.";

        historyElement.append(empty);
        return;
    }

    for (const spin of spins) {
        historyElement.append(
            createHistoryRow(spin)
        );
    }
}


function renderResult(spin) {
    resultElement.className =
        "slot-result";

    const net =
        Number(spin.net ?? 0);

    const labelParts = [
        `${formatChips(
            spin.total_bet
        )} chip bet`,
        "50% win chance",
        "100% theoretical RTP"
    ];

    const label =
        document.createElement("span");

    label.textContent =
        labelParts.join(" · ");

    const heading =
        document.createElement("strong");

    if (net > 0) {
        resultElement.classList.add("win");

        heading.textContent =
            `Won ${formatChips(net)} chips`;
    } else {
        resultElement.classList.add("loss");

        heading.textContent =
            `Lost ${formatChips(
                Math.abs(net)
            )} chips`;
    }

    if (
        Number(
            spin.free_spins_awarded
        ) > 0
    ) {
        heading.textContent +=
            ` · ${spin.free_spins_awarded}`
            + " free spins awarded";
    }

    resultElement.replaceChildren(
        label,
        heading
    );
}


function renderEverything() {
    renderMachinePicker();
    updateMachineHeading();
    renderBetButtons();
    updateControls();
    renderGrid();
    renderWinningLines();
    renderStatistics();
    renderPaytable();
    renderHistory();
}


function setSpinInProgress(value) {
    spinInProgress = value;

    machinePicker
        .querySelectorAll("button")
        .forEach((button) => {
            button.disabled = value;
        });

    updateControls();
}


function sleep(milliseconds) {
    return new Promise(
        (resolve) => {
            window.setTimeout(
                resolve,
                milliseconds
            );
        }
    );
}


function updateCellSymbol(
    cell,
    machineCode,
    symbolCode
) {
    const symbol =
        MACHINE_DETAILS[machineCode]
            .symbols[symbolCode];

    cell.dataset.symbol =
        symbolCode;

    cell.querySelector(
        ".slot-symbol-glyph"
    ).textContent =
        symbol?.glyph ?? "?";

    cell.querySelector(
        ".slot-symbol-label"
    ).textContent =
        symbol?.label ?? symbolCode;
}


async function animateSpin(finalGrid) {
    clearWinHighlights();

    const fastMode =
        fastModeInput.checked
        || document.documentElement
            .classList.contains(
                "ui-reduce-motion"
            );

    const cycles =
        fastMode
            ? 3
            : 10;

    const interval =
        fastMode
            ? 35
            : 70;

    const reelDelay =
        fastMode
            ? 70
            : 175;

    const reels =
        Array.from(
            reelsElement.querySelectorAll(
                ".slot-reel"
            )
        );

    reels.forEach((reel) => {
        reel
            .querySelectorAll(
                ".slot-symbol-cell"
            )
            .forEach((cell) => {
                cell.classList.add(
                    "spinning"
                );
            });
    });

    for (
        let cycle = 0;
        cycle < cycles;
        cycle += 1
    ) {
        for (const reel of reels) {
            reel
                .querySelectorAll(
                    ".slot-symbol-cell"
                )
                .forEach((cell) => {
                    updateCellSymbol(
                        cell,
                        selectedMachineCode,
                        randomSymbolCode(
                            selectedMachineCode
                        )
                    );
                });
        }

        await sleep(interval);
    }

    for (
        let reelIndex = 0;
        reelIndex < reels.length;
        reelIndex += 1
    ) {
        const reel =
            reels[reelIndex];

        const cells =
            reel.querySelectorAll(
                ".slot-symbol-cell"
            );

        cells.forEach((cell, rowIndex) => {
            updateCellSymbol(
                cell,
                selectedMachineCode,
                finalGrid[rowIndex][reelIndex]
            );

            cell.classList.remove(
                "spinning"
            );
        });

        await sleep(reelDelay);
    }

    currentGrid = finalGrid;
}


async function playSpin() {
    if (spinInProgress) {
        return;
    }

    const machineState =
        selectedMachineState();

    const freeSpins =
        Number(
            machineState.free_spins
            ?? 0
        );

    const wallet =
        Number(
            slotState?.wallet_chips
            ?? 0
        );

    if (
        freeSpins <= 0
        && wallet < selectedBet
    ) {
        showMessage(
            "You do not have enough wallet chips."
        );
        return;
    }

    setSpinInProgress(true);
    showMessage();

    try {
        /*
         * The complete result is generated and financially settled before
         * the animation starts. The animation cannot alter the outcome.
         */
        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "play_slot_machine",
            {
                p_machine_code:
                    selectedMachineCode,
                p_total_bet:
                    selectedBet
            }
        );

        if (error) {
            throw error;
        }

        const spin = data?.spin;
        const nextState = data?.state;

        if (
            !spin
            || !Array.isArray(spin.grid)
            || spin.grid.length !== 3
        ) {
            throw new Error(
                "Supabase returned an invalid slot result."
            );
        }

        await animateSpin(
            spin.grid
        );

        slotState =
            nextState;

        highlightSpinResult(spin);
        renderWinningLines(spin);
        renderResult(spin);

        renderMachinePicker();
        updateMachineHeading();
        renderBetButtons();
        updateControls();
        renderStatistics();
        renderHistory();

    } catch (error) {
        console.error(error);

        showMessage(
            error.message
            || "The slot spin could not be completed."
        );

        renderGrid();
    } finally {
        setSpinInProgress(false);
    }
}


async function loadSlotState() {
    const {
        data,
        error
    } = await window.supabaseClient.rpc(
        "get_slot_machine_state"
    );

    if (error) {
        throw error;
    }

    slotState = data;

    const validMachines =
        new Set(
            Object.keys(MACHINE_DETAILS)
        );

    if (
        !validMachines.has(
            selectedMachineCode
        )
    ) {
        selectedMachineCode =
            "classic";
    }

    const options =
        availableBetOptions();

    if (!options.includes(selectedBet)) {
        selectedBet =
            options[0] ?? 10;
    }

    currentGrid =
        defaultGrid(
            selectedMachineCode
        );

    renderEverything();
}


fastModeInput.checked =
    window.localStorage.getItem(
        STORAGE_KEYS.fast
    ) === "true";

fastModeInput.addEventListener(
    "change",
    () => {
        window.localStorage.setItem(
            STORAGE_KEYS.fast,
            String(
                fastModeInput.checked
            )
        );
    }
);


spinButton.addEventListener(
    "click",
    playSpin
);


document.addEventListener(
    "keydown",
    (event) => {
        if (
            event.code !== "Space"
            || event.repeat
            || event.target.matches(
                "input, select, textarea, button, "
                + "a, [contenteditable='true']"
            )
        ) {
            return;
        }

        event.preventDefault();
        playSpin();
    }
);


async function initialiseSlots() {
    try {
        const {
            data: {
                user
            },
            error
        } =
            await window.supabaseClient.auth
                .getUser();

        if (error || !user) {
            window.location.href =
                "login.html";

            return;
        }

        await loadSlotState();
    } catch (error) {
        console.error(error);

        showMessage(
            error.message
            || "Slot Machines could not be loaded."
        );
    }
}


initialiseSlots();
