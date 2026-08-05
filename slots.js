const walletBalanceLabel =
    document.querySelector("#wallet-balance");

const machinePicker =
    document.querySelector("#slot-machine-picker");

const cabinetPanel =
    document.querySelector(".slot-cabinet-panel");

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


const MACHINE_DETAILS = {
    classic: {
        icon: "7️⃣",
        name: "Lucky Sevens",
        subtitle: "Frequent returns",
        eyebrow: "LOW-VOLATILITY FRUIT MACHINE",
        volatility: "50% payout chance · Low risk",
        hitRate: 50,
        rtp: 100,
        maxMultiplier: 10,
        description:
            "The gentlest cabinet. Half of spins return something, but many are break-even cherries rather than large wins.",
        symbols: {
            CHERRY: {
                glyph: "🍒",
                label: "Cherry"
            },
            LEMON: {
                glyph: "🍋",
                label: "Lemon"
            },
            ORANGE: {
                glyph: "🍊",
                label: "Orange"
            },
            BELL: {
                glyph: "🔔",
                label: "Bell"
            },
            BAR: {
                glyph: "▰",
                label: "Bar"
            },
            SEVEN: {
                glyph: "7️⃣",
                label: "Seven"
            },
            WILD: {
                glyph: "⭐",
                label: "Star"
            }
        },
        outcomes: [
            {
                symbol: "CHERRY",
                chance: 30,
                multiplier: 1,
                note: "Returns the bet"
            },
            {
                symbol: "BELL",
                chance: 15,
                multiplier: 2,
                note: "Doubles the bet"
            },
            {
                symbol: "SEVEN",
                chance: 4,
                multiplier: 7.5,
                note: "Rare prize"
            },
            {
                symbol: "WILD",
                chance: 1,
                multiplier: 10,
                note: "Top prize"
            }
        ]
    },

    neon: {
        icon: "⚡",
        name: "Neon Rush",
        subtitle: "Fewer, stronger wins",
        eyebrow: "MEDIUM-VOLATILITY NEON MACHINE",
        volatility: "35% payout chance · Medium risk",
        hitRate: 35,
        rtp: 100,
        maxMultiplier: 10,
        description:
            "A middle-ground cabinet. It pays less often than Lucky Sevens, but even its common coin result makes a profit.",
        symbols: {
            COIN: {
                glyph: "🪙",
                label: "Coin"
            },
            PLUM: {
                glyph: "🟣",
                label: "Neon plum"
            },
            DIAMOND: {
                glyph: "💎",
                label: "Diamond"
            },
            LIGHTNING: {
                glyph: "⚡",
                label: "Lightning"
            },
            CROWN: {
                glyph: "👑",
                label: "Crown"
            },
            WILD: {
                glyph: "🌈",
                label: "Prism"
            }
        },
        outcomes: [
            {
                symbol: "COIN",
                chance: 20,
                multiplier: 1.5,
                note: "Small profit"
            },
            {
                symbol: "LIGHTNING",
                chance: 10,
                multiplier: 3,
                note: "Strong win"
            },
            {
                symbol: "CROWN",
                chance: 4,
                multiplier: 7.5,
                note: "Rare prize"
            },
            {
                symbol: "WILD",
                chance: 1,
                multiplier: 10,
                note: "Top prize"
            }
        ]
    },

    cosmic: {
        icon: "🪐",
        name: "Cosmic Vault",
        subtitle: "Rare jackpot-style prizes",
        eyebrow: "HIGH-VOLATILITY COSMIC MACHINE",
        volatility: "19.5% payout chance · High risk",
        hitRate: 19.5,
        rtp: 100,
        maxMultiplier: 30,
        description:
            "The dangerous cabinet. Most spins pay nothing, while its Alien and Galaxy outcomes can return enormous multiples.",
        symbols: {
            STAR: {
                glyph: "✨",
                label: "Star"
            },
            MOON: {
                glyph: "🌙",
                label: "Moon"
            },
            PLANET: {
                glyph: "🪐",
                label: "Planet"
            },
            ROCKET: {
                glyph: "🚀",
                label: "Rocket"
            },
            ALIEN: {
                glyph: "👽",
                label: "Alien"
            },
            WILD: {
                glyph: "🌌",
                label: "Galaxy"
            }
        },
        outcomes: [
            {
                symbol: "MOON",
                chance: 12,
                multiplier: 2,
                note: "Doubles the bet"
            },
            {
                symbol: "ROCKET",
                chance: 6,
                multiplier: 6,
                note: "Large prize"
            },
            {
                symbol: "ALIEN",
                chance: 1,
                multiplier: 25,
                note: "Huge prize"
            },
            {
                symbol: "WILD",
                chance: 0.5,
                multiplier: 30,
                note: "Top prize"
            }
        ]
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


function formatPercent(value) {
    return `${Number(value).toFixed(
        Number(value) % 1 === 0
            ? 0
            : 1
    )}%`;
}


function formatMultiplier(value) {
    return `${Number(value)}×`;
}


function signedChips(value) {
    const number =
        Number(value ?? 0);

    if (number > 0) {
        return `+${formatChips(number)}`;
    }

    if (number < 0) {
        return `−${formatChips(
            Math.abs(number)
        )}`;
    }

    return "0";
}


function showMessage(
    message = "",
    type = "error"
) {
    messageElement.textContent =
        message;

    messageElement.className =
        `form-message ${type}`.trim();
}


function selectedMachine() {
    return (
        MACHINE_DETAILS[
            selectedMachineCode
        ]
        ?? MACHINE_DETAILS.classic
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
            5000,
            10000
        ]
    ).map(Number);
}


function symbolDetails(
    machineCode,
    symbolCode
) {
    return (
        MACHINE_DETAILS[machineCode]
            ?.symbols?.[symbolCode]
        ?? {
            glyph: "❔",
            label:
                symbolCode
                || "No prize"
        }
    );
}


function randomSymbolCode(
    machineCode
) {
    const symbols =
        Object.keys(
            MACHINE_DETAILS[
                machineCode
            ].symbols
        );

    return symbols[
        Math.floor(
            Math.random()
            * symbols.length
        )
    ];
}


function defaultGrid(
    machineCode
) {
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
                    randomSymbolCode(
                        machineCode
                    )
            )
    );
}


function createSymbolCell(
    machineCode,
    symbolCode,
    row,
    reel
) {
    const symbol =
        symbolDetails(
            machineCode,
            symbolCode
        );

    const cell =
        document.createElement("div");

    cell.className =
        "slot-symbol-cell";

    cell.dataset.row =
        String(row);

    cell.dataset.reel =
        String(reel);

    cell.dataset.symbol =
        symbolCode;

    const glyph =
        document.createElement("span");

    glyph.className =
        "slot-symbol-glyph";

    glyph.textContent =
        symbol.glyph;

    const label =
        document.createElement("span");

    label.className =
        "slot-symbol-label";

    label.textContent =
        symbol.label;

    cell.append(glyph, label);

    return cell;
}


function renderGrid(
    grid = currentGrid
        ?? defaultGrid(
            selectedMachineCode
        )
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

        reelElement.className =
            "slot-reel";

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

        reelsElement.append(
            reelElement
        );
    }
}


function clearWinHighlights() {
    reelsElement
        .querySelectorAll(
            ".winning, "
            + ".scatter-winning"
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
        of spin.winning_lines
        ?? []
    ) {
        const rows =
            line.rows
            ?? [];

        rows.forEach(
            (row, reelIndex) => {
                reelsElement
                    .querySelector(
                        `[data-row="${row}"]`
                        + `[data-reel="${reelIndex + 1}"]`
                    )
                    ?.classList.add(
                        "winning"
                    );
            }
        );
    }
}


function renderWinningLines(
    spin = null
) {
    winningLinesElement
        .replaceChildren();

    if (!spin) {
        const empty =
            document.createElement("span");

        empty.className =
            "slot-no-line-win";

        empty.textContent =
            "The highlighted line shows the awarded emoji.";

        winningLinesElement.append(
            empty
        );

        return;
    }

    const winningLine =
        spin.winning_lines?.[0];

    if (!winningLine) {
        const empty =
            document.createElement("span");

        empty.className =
            "slot-no-line-win";

        empty.textContent =
            "No prize on this spin.";

        winningLinesElement.append(
            empty
        );

        return;
    }

    const symbol =
        symbolDetails(
            spin.machine_code,
            winningLine.symbol
        );

    const badge =
        document.createElement("span");

    badge.className =
        "slot-winning-line";

    badge.textContent =
        `${symbol.glyph} ${symbol.label}`
        + ` · ${formatMultiplier(
            winningLine.multiplier
        )}`
        + ` · ${formatPercent(
            winningLine.chance_percent
        )} chance`;

    winningLinesElement.append(
        badge
    );
}


function updateMachineHeading() {
    const machine =
        selectedMachine();

    selectedMachineSubtitle.textContent =
        machine.eyebrow;

    selectedMachineName.textContent =
        machine.name;

    selectedMachineVolatility.textContent =
        machine.volatility;

    selectedMachineRtp.textContent =
        `${machine.rtp}% RTP`;

    freeSpinBadge.classList.add(
        "hidden"
    );

    cabinetPanel.classList.remove(
        "machine-classic",
        "machine-neon",
        "machine-cosmic"
    );

    cabinetPanel.classList.add(
        `machine-${selectedMachineCode}`
    );
}


function renderMachinePicker() {
    machinePicker.replaceChildren();

    for (
        const machineCode
        of Object.keys(
            MACHINE_DETAILS
        )
    ) {
        const machine =
            MACHINE_DETAILS[
                machineCode
            ];

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "slot-machine-card";

        button.dataset.machineCode =
            machineCode;

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

        const hitRate =
            document.createElement("small");

        hitRate.textContent =
            `${formatPercent(
                machine.hitRate
            )} payout`;

        const maximum =
            document.createElement("small");

        maximum.textContent =
            `Up to ${formatMultiplier(
                machine.maxMultiplier
            )}`;

        const rtp =
            document.createElement("small");

        rtp.textContent =
            "100% RTP";

        meta.append(
            hitRate,
            maximum,
            rtp
        );

        copy.append(
            name,
            subtitle,
            meta
        );

        button.append(
            icon,
            copy
        );

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
                    defaultGrid(
                        machineCode
                    );

                renderEverything();
            }
        );

        machinePicker.append(
            button
        );
    }
}


function renderBetButtons() {
    betButtonsElement
        .replaceChildren();

    const options =
        availableBetOptions();

    if (!options.includes(
        selectedBet
    )) {
        selectedBet =
            options[0]
            ?? 10;
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

        betButtonsElement.append(
            button
        );
    }

    const machine =
        selectedMachine();

    betBreakdown.textContent =
        `${formatPercent(
            machine.hitRate
        )} payout chance`
        + ` · maximum `
        + `${formatMultiplier(
            machine.maxMultiplier
        )}`;
}


function updateControls() {
    const wallet =
        Number(
            slotState?.wallet_chips
            ?? 0
        );

    walletBalanceLabel.textContent =
        formatChips(wallet);

    spinButton.disabled =
        spinInProgress
        || wallet < selectedBet;

    spinButton.textContent =
        spinInProgress
            ? "Spinning..."
            : `Spin · ${formatChips(
                selectedBet
            )} chips`;

    betButtonsElement
        .querySelectorAll("button")
        .forEach((button) => {
            button.disabled =
                spinInProgress;
        });
}


function renderStatistics() {
    statisticsElement
        .replaceChildren();

    const statistics =
        slotState?.statistics
        ?? {};

    const net =
        Number(
            statistics.net
            ?? 0
        );

    const cards = [
        {
            label: "Total spins",
            value: formatChips(
                statistics.paid_spins
            )
        },
        {
            label: "Winning spins",
            value: formatChips(
                statistics.winning_spins
            )
        },
        {
            label: "Observed payout rate",
            value:
                `${Number(
                    statistics.observed_hit_rate
                    ?? 0
                ).toFixed(1)}%`
        },
        {
            label: "Total wagered",
            value:
                `${formatChips(
                    statistics.total_wagered
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

        card.append(
            label,
            value
        );

        statisticsElement.append(
            card
        );
    }
}


function renderPaytable() {
    const machine =
        selectedMachine();

    paytableTitle.textContent =
        `${machine.name} outcomes`;

    paytableDescription.textContent =
        machine.description
        + " Every listed chance is decided by Supabase.";

    paytableElement
        .replaceChildren();

    const heading =
        document.createElement("div");

    heading.className =
        "slot-paytable-row "
        + "slot-paytable-heading-row";

    for (
        const headingText
        of [
            "Emoji",
            "Chance",
            "Payout",
            "Net result"
        ]
    ) {
        const cell =
            document.createElement("span");

        cell.className =
            headingText === "Emoji"
                ? "slot-paytable-symbol"
                : "slot-paytable-value";

        cell.textContent =
            headingText;

        heading.append(cell);
    }

    paytableElement.append(
        heading
    );

    for (
        const outcome
        of machine.outcomes
    ) {
        const symbol =
            symbolDetails(
                selectedMachineCode,
                outcome.symbol
            );

        const row =
            document.createElement("div");

        row.className =
            "slot-paytable-row";

        const symbolCell =
            document.createElement("span");

        symbolCell.className =
            "slot-paytable-symbol";

        const glyph =
            document.createElement("span");

        glyph.textContent =
            symbol.glyph;

        const label =
            document.createElement("strong");

        label.textContent =
            `${symbol.label} · ${outcome.note}`;

        symbolCell.append(
            glyph,
            label
        );

        const chance =
            document.createElement("span");

        chance.className =
            "slot-paytable-value";

        chance.textContent =
            formatPercent(
                outcome.chance
            );

        const payout =
            document.createElement("span");

        payout.className =
            "slot-paytable-value";

        payout.textContent =
            formatMultiplier(
                outcome.multiplier
            );

        const net =
            document.createElement("span");

        net.className =
            "slot-paytable-value";

        net.textContent =
            outcome.multiplier === 1
                ? "Break even"
                : `+${formatMultiplier(
                    outcome.multiplier - 1
                )} bet`;

        row.append(
            symbolCell,
            chance,
            payout,
            net
        );

        paytableElement.append(
            row
        );
    }

    const lossChance =
        100 - machine.hitRate;

    const lossRow =
        document.createElement("div");

    lossRow.className =
        "slot-paytable-row "
        + "slot-paytable-loss-row";

    const lossLabel =
        document.createElement("span");

    lossLabel.className =
        "slot-paytable-symbol";

    lossLabel.innerHTML =
        "<span>⬛</span>"
        + "<strong>No matching prize</strong>";

    const lossChanceCell =
        document.createElement("span");

    lossChanceCell.className =
        "slot-paytable-value";

    lossChanceCell.textContent =
        formatPercent(
            lossChance
        );

    const lossPayout =
        document.createElement("span");

    lossPayout.className =
        "slot-paytable-value";

    lossPayout.textContent =
        "0×";

    const lossNet =
        document.createElement("span");

    lossNet.className =
        "slot-paytable-value";

    lossNet.textContent =
        "−1× bet";

    lossRow.append(
        lossLabel,
        lossChanceCell,
        lossPayout,
        lossNet
    );

    paytableElement.append(
        lossRow
    );
}


function machineName(
    machineCode
) {
    return (
        MACHINE_DETAILS[
            machineCode
        ]?.name
        ?? machineCode
    );
}


function historyPrizeSymbol(
    spin
) {
    return (
        spin.prize_symbol
        ?? spin.winning_lines?.[0]
            ?.symbol
        ?? null
    );
}


function historyMultiplier(
    spin
) {
    return Number(
        spin.payout_multiplier
        ?? spin.winning_lines?.[0]
            ?.multiplier
        ?? 0
    );
}


function createHistoryRow(
    spin
) {
    const row =
        document.createElement("article");

    row.className =
        "slot-history-row";

    const net =
        Number(
            spin.net
            ?? 0
        );

    row.classList.add(
        Number(spin.payout) > 0
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

    const prizeSymbol =
        historyPrizeSymbol(spin);

    if (prizeSymbol) {
        const symbol =
            symbolDetails(
                spin.machine_code,
                prizeSymbol
            );

        extraHeading.textContent =
            `${symbol.glyph} ${symbol.label}`
            + ` · ${formatMultiplier(
                historyMultiplier(spin)
            )}`;
    } else {
        extraHeading.textContent =
            "No prize";
    }

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
        )} returned`;

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
    historyElement
        .replaceChildren();

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

        historyElement.append(
            empty
        );

        return;
    }

    for (const spin of spins) {
        historyElement.append(
            createHistoryRow(
                spin
            )
        );
    }
}


function renderResult(spin) {
    resultElement.className =
        "slot-result";

    const machine =
        MACHINE_DETAILS[
            spin.machine_code
        ]
        ?? selectedMachine();

    const net =
        Number(
            spin.net
            ?? 0
        );

    const label =
        document.createElement("span");

    label.textContent =
        `${machine.name}`
        + ` · ${formatPercent(
            machine.hitRate
        )} payout chance`
        + " · 100% theoretical RTP";

    const heading =
        document.createElement("strong");

    const prizeSymbol =
        spin.prize_symbol
        ?? spin.winning_lines?.[0]
            ?.symbol;

    if (prizeSymbol) {
        resultElement.classList.add(
            "win"
        );

        const symbol =
            symbolDetails(
                spin.machine_code,
                prizeSymbol
            );

        const multiplier =
            Number(
                spin.payout_multiplier
                ?? spin.winning_lines?.[0]
                    ?.multiplier
                ?? 0
            );

        if (net > 0) {
            heading.textContent =
                `${symbol.glyph} ${symbol.label}`
                + ` paid ${formatMultiplier(
                    multiplier
                )}`
                + ` · +${formatChips(
                    net
                )} chips`;
        } else {
            heading.textContent =
                `${symbol.glyph} ${symbol.label}`
                + " returned your bet";
        }
    } else {
        resultElement.classList.add(
            "loss"
        );

        heading.textContent =
            `No prize · lost ${formatChips(
                Math.abs(net)
            )} chips`;
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


function setSpinInProgress(
    value
) {
    spinInProgress = value;

    machinePicker
        .querySelectorAll("button")
        .forEach((button) => {
            button.disabled =
                value;
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
        symbolDetails(
            machineCode,
            symbolCode
        );

    cell.dataset.symbol =
        symbolCode;

    cell.querySelector(
        ".slot-symbol-glyph"
    ).textContent =
        symbol.glyph;

    cell.querySelector(
        ".slot-symbol-label"
    ).textContent =
        symbol.label;
}


async function animateSpin(
    finalGrid
) {
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

        cells.forEach(
            (cell, rowIndex) => {
                updateCellSymbol(
                    cell,
                    selectedMachineCode,
                    finalGrid[
                        rowIndex
                    ][reelIndex]
                );

                cell.classList.remove(
                    "spinning"
                );
            }
        );

        await sleep(reelDelay);
    }

    currentGrid = finalGrid;
}


async function playSpin() {
    if (spinInProgress) {
        return;
    }

    const wallet =
        Number(
            slotState?.wallet_chips
            ?? 0
        );

    if (wallet < selectedBet) {
        showMessage(
            "You do not have enough wallet chips."
        );

        return;
    }

    setSpinInProgress(true);
    showMessage();

    try {
        const {
            data,
            error
        } =
            await window.supabaseClient.rpc(
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

        const spin =
            data?.spin;

        if (
            !spin
            || !Array.isArray(
                spin.grid
            )
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
            data.state;

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
    } =
        await window.supabaseClient.rpc(
            "get_slot_machine_state"
        );

    if (error) {
        throw error;
    }

    slotState = data;

    if (
        !Object.hasOwn(
            MACHINE_DETAILS,
            selectedMachineCode
        )
    ) {
        selectedMachineCode =
            "classic";
    }

    const options =
        availableBetOptions();

    if (!options.includes(
        selectedBet
    )) {
        selectedBet =
            options[0]
            ?? 10;
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
                "input, select, textarea, "
                + "button, a, "
                + "[contenteditable='true']"
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
