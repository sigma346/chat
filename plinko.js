const canvas =
    document.querySelector("#plinko-canvas");

const context =
    canvas.getContext("2d");

const walletBalanceLabel =
    document.querySelector("#wallet-balance");

const betInput =
    document.querySelector("#plinko-bet-input");

const dropBallButton =
    document.querySelector("#drop-ball-button");

const quickBetButtons =
    document.querySelectorAll(".quick-bet");

const resultElement =
    document.querySelector("#plinko-result");

const messageElement =
    document.querySelector("#plinko-message");

const historyElement =
    document.querySelector("#plinko-history");

const logoutButton =
    document.querySelector("#logout-button");


const ROW_COUNT = 10;

const MINIMUM_BET = 10;
const MAXIMUM_BET = 500;


/*
    Multipliers use basis points.

    10000 = 1×
*/

const MULTIPLIER_BPS = [
    0,
    40000,
    2500,
    15000,
    5600,
    12949,
    5600,
    15000,
    2500,
    40000,
    0
];


let walletChips = 0;
let dropInProgress = false;

let canvasWidth = 0;
let canvasHeight = 0;

let animationFrameId = null;


/*
    Formatting
*/

function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}


function formatMultiplier(basisPoints) {
    const multiplier =
        Number(basisPoints) / 10000;

    return `${Number(multiplier.toFixed(3))}×`;
}


function showMessage(
    message = "",
    type = "error"
) {
    messageElement.textContent = message;

    messageElement.className =
        `form-message ${type}`.trim();
}


/*
    Board layout
*/

function calculateBoardLayout() {
    const horizontalPadding =
        Math.max(
            24,
            canvasWidth * 0.045
        );

    const top =
        Math.max(
            42,
            canvasHeight * 0.08
        );

    const slotHeight =
        Math.max(
            58,
            canvasHeight * 0.14
        );

    const slotTop =
        canvasHeight
        - slotHeight
        - 12;

    const usableWidth =
        canvasWidth
        - horizontalPadding * 2;

    const slotSpacing =
        usableWidth / 11;

    const rowSpacing =
        (slotTop - top)
        / ROW_COUNT;


    return {
        horizontalPadding,
        top,
        slotHeight,
        slotTop,
        usableWidth,
        slotSpacing,
        rowSpacing,
        centreX: canvasWidth / 2
    };
}


/*
    Canvas setup
*/

function resizeCanvas() {
    const rectangle =
        canvas.getBoundingClientRect();

    const scale =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );


    canvasWidth = rectangle.width;
    canvasHeight = rectangle.height;


    canvas.width =
        Math.round(
            canvasWidth * scale
        );

    canvas.height =
        Math.round(
            canvasHeight * scale
        );


    context.setTransform(
        scale,
        0,
        0,
        scale,
        0,
        0
    );


    drawBoard();
}


/*
    Board rendering
*/

function slotColour(multiplierBps) {
    if (multiplierBps > 10000) {
        return "#23775f";
    }

    if (multiplierBps === 0) {
        return "#512d39";
    }

    return "#624b2e";
}


function drawBackground() {
    const gradient =
        context.createLinearGradient(
            0,
            0,
            0,
            canvasHeight
        );


    gradient.addColorStop(
        0,
        "#172238"
    );

    gradient.addColorStop(
        1,
        "#090d16"
    );


    context.fillStyle = gradient;

    context.fillRect(
        0,
        0,
        canvasWidth,
        canvasHeight
    );
}


function drawSlots(layout) {
    const {
        horizontalPadding,
        slotTop,
        slotHeight,
        slotSpacing
    } = layout;


    for (
        let slot = 0;
        slot < 11;
        slot += 1
    ) {
        const x =
            horizontalPadding
            + slot * slotSpacing;


        context.fillStyle =
            slotColour(
                MULTIPLIER_BPS[slot]
            );


        context.fillRect(
            x + 2,
            slotTop,
            slotSpacing - 4,
            slotHeight
        );


        context.strokeStyle =
            "rgba(255, 255, 255, 0.18)";

        context.lineWidth = 1;

        context.strokeRect(
            x + 2,
            slotTop,
            slotSpacing - 4,
            slotHeight
        );


        context.fillStyle =
            "#f3f5f8";

        context.font =
            `${Math.max(
                10,
                Math.min(
                    15,
                    slotSpacing * 0.22
                )
            )}px system-ui`;

        context.textAlign = "center";
        context.textBaseline = "middle";


        context.fillText(
            formatMultiplier(
                MULTIPLIER_BPS[slot]
            ),

            x + slotSpacing / 2,

            slotTop
            + slotHeight / 2
        );
    }
}


function drawPegs(layout) {
    const {
        top,
        rowSpacing,
        slotSpacing,
        centreX
    } = layout;


    for (
        let row = 0;
        row < ROW_COUNT;
        row += 1
    ) {
        const pegCount =
            row + 1;


        for (
            let peg = 0;
            peg < pegCount;
            peg += 1
        ) {
            const x =
                centreX
                + (
                    peg
                    - row / 2
                )
                * slotSpacing;


            const y =
                top
                + row
                * rowSpacing;


            context.beginPath();

            context.arc(
                x,
                y,
                Math.max(
                    3.2,
                    canvasWidth * 0.004
                ),
                0,
                Math.PI * 2
            );


            context.fillStyle =
                "#dbe4f2";

            context.shadowColor =
                "rgba(132, 190, 255, 0.65)";

            context.shadowBlur = 7;

            context.fill();

            context.shadowBlur = 0;
        }
    }
}


function drawBall(ballPosition) {
    if (!ballPosition) {
        return;
    }


    const radius =
        Math.max(
            8,
            canvasWidth * 0.012
        );


    const gradient =
        context.createRadialGradient(
            ballPosition.x - radius * 0.35,
            ballPosition.y - radius * 0.35,
            radius * 0.1,

            ballPosition.x,
            ballPosition.y,
            radius
        );


    gradient.addColorStop(
        0,
        "#ffffff"
    );

    gradient.addColorStop(
        0.3,
        "#79e3be"
    );

    gradient.addColorStop(
        1,
        "#1f8064"
    );


    context.beginPath();

    context.arc(
        ballPosition.x,
        ballPosition.y,
        radius,
        0,
        Math.PI * 2
    );


    context.fillStyle = gradient;

    context.shadowColor =
        "rgba(85, 214, 169, 0.85)";

    context.shadowBlur = 14;

    context.fill();

    context.shadowBlur = 0;
}


function drawBoard(ballPosition = null) {
    if (
        canvasWidth <= 0
        || canvasHeight <= 0
    ) {
        return;
    }


    const layout =
        calculateBoardLayout();


    drawBackground();
    drawSlots(layout);
    drawPegs(layout);
    drawBall(ballPosition);
}


/*
    Ball animation
*/

function createAnimationPoints(path) {
    const layout =
        calculateBoardLayout();


    const points = [
        {
            x: layout.centreX,
            y: layout.top - 34
        }
    ];


    let rightMoves = 0;


    for (
        let bounce = 0;
        bounce < ROW_COUNT;
        bounce += 1
    ) {
        if (Number(path[bounce]) === 1) {
            rightMoves += 1;
        }


        const completedBounces =
            bounce + 1;


        points.push({
            x:
                layout.centreX
                + (
                    rightMoves
                    - completedBounces / 2
                )
                * layout.slotSpacing,

            y:
                layout.top
                + completedBounces
                * layout.rowSpacing
        });
    }


    points.push({
        x:
            layout.centreX
            + (
                rightMoves
                - ROW_COUNT / 2
            )
            * layout.slotSpacing,

        y:
            layout.slotTop
            + layout.slotHeight * 0.48
    });


    return points;
}


function smoothStep(value) {
    return value
        * value
        * (
            3 - 2 * value
        );
}


function animateBall(path) {
    return new Promise(
        (resolve) => {
            const points =
                createAnimationPoints(path);

            const duration =
                2900;

            const segmentCount =
                points.length - 1;

            let startTime = null;


            function frame(timestamp) {
                if (startTime === null) {
                    startTime = timestamp;
                }


                const elapsed =
                    timestamp - startTime;

                const progress =
                    Math.min(
                        elapsed / duration,
                        1
                    );


                const scaledProgress =
                    progress
                    * segmentCount;


                const segment =
                    Math.min(
                        Math.floor(
                            scaledProgress
                        ),
                        segmentCount - 1
                    );


                const localProgress =
                    smoothStep(
                        scaledProgress
                        - segment
                    );


                const startPoint =
                    points[segment];

                const endPoint =
                    points[segment + 1];


                const ballPosition = {
                    x:
                        startPoint.x
                        + (
                            endPoint.x
                            - startPoint.x
                        )
                        * localProgress,

                    y:
                        startPoint.y
                        + (
                            endPoint.y
                            - startPoint.y
                        )
                        * localProgress
                };


                drawBoard(ballPosition);


                if (progress < 1) {
                    animationFrameId =
                        requestAnimationFrame(
                            frame
                        );
                } else {
                    resolve();
                }
            }


            animationFrameId =
                requestAnimationFrame(
                    frame
                );
        }
    );
}


/*
    Wallet and controls
*/

function updateWalletDisplay() {
    walletBalanceLabel.textContent =
        formatChips(walletChips);


    betInput.max =
        Math.min(
            MAXIMUM_BET,
            walletChips
        );


    const canAffordMinimum =
        walletChips >= MINIMUM_BET;


    dropBallButton.disabled =
        dropInProgress
        || !canAffordMinimum;


    for (const button of quickBetButtons) {
        const value =
            Number(button.dataset.bet);

        button.disabled =
            dropInProgress
            || value > walletChips;
    }
}


function setDropInProgress(value) {
    dropInProgress = value;

    betInput.disabled = value;

    dropBallButton.textContent =
        value
            ? "Dropping..."
            : "Drop ball";

    updateWalletDisplay();
}


/*
    Result display
*/

function displayResult(result) {
    const net =
        Number(result.net);

    const multiplier =
        formatMultiplier(
            result.multiplier_bps
        );


    resultElement.classList.remove(
        "win",
        "loss"
    );


    if (net > 0) {
        resultElement.classList.add(
            "win"
        );

        resultElement.innerHTML = `
            <span>
                Slot ${result.slot_number} · ${multiplier}
            </span>

            <strong>
                Won +${formatChips(net)} chips
            </strong>
        `;
    } else {
        resultElement.classList.add(
            "loss"
        );

        resultElement.innerHTML = `
            <span>
                Slot ${result.slot_number} · ${multiplier}
            </span>

            <strong>
                Lost ${formatChips(Math.abs(net))} chips
            </strong>
        `;
    }
}


/*
    Drop history
*/

function createHistoryRow(drop) {
    const row =
        document.createElement("article");

    row.className =
        "plinko-history-row";


    const multiplier =
        formatMultiplier(
            drop.multiplier_bps
        );


    const net =
        Number(drop.payout)
        - Number(drop.bet);


    if (net > 0) {
        row.classList.add("win");
    } else {
        row.classList.add("loss");
    }


    const result = document.createElement("div");

    const heading =
        document.createElement("strong");

    heading.textContent =
        net > 0
            ? `+${formatChips(net)} chips`
            : `−${formatChips(Math.abs(net))} chips`;


    const details =
        document.createElement("span");

    details.textContent =
        `${formatChips(drop.bet)} bet · ${multiplier}`;


    result.append(
        heading,
        details
    );


    const time =
        document.createElement("time");

    time.dateTime =
        drop.created_at;


    time.textContent =
        new Intl.DateTimeFormat(
            "en-AU",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(
            new Date(
                drop.created_at
            )
        );


    row.append(
        result,
        time
    );


    return row;
}


function renderHistory(drops) {
    historyElement.replaceChildren();


    if (!drops || drops.length === 0) {
        const empty =
            document.createElement("p");

        empty.className =
            "empty-plinko-history";

        empty.textContent =
            "No drops yet.";

        historyElement.append(empty);

        return;
    }


    for (const drop of drops) {
        historyElement.append(
            createHistoryRow(drop)
        );
    }
}


function prependHistory(result) {
    historyElement
        .querySelector(
            ".empty-plinko-history"
        )
        ?.remove();


    const historyDrop = {
        bet: result.bet,
        payout: result.payout,
        multiplier_bps:
            result.multiplier_bps,
        created_at:
            new Date().toISOString()
    };


    historyElement.prepend(
        createHistoryRow(
            historyDrop
        )
    );


    while (
        historyElement.children.length > 10
    ) {
        historyElement.lastElementChild
            ?.remove();
    }
}


/*
    Play one drop
*/

async function playDrop() {
    if (dropInProgress) {
        return;
    }


    const bet =
        Number.parseInt(
            betInput.value,
            10
        );


    if (!Number.isSafeInteger(bet)) {
        showMessage(
            "Enter a valid whole-number bet."
        );

        return;
    }


    if (bet < MINIMUM_BET) {
        showMessage(
            "The minimum bet is 10 chips."
        );

        return;
    }


    if (bet > MAXIMUM_BET) {
        showMessage(
            "The maximum bet is 500 chips."
        );

        return;
    }


    if (bet > walletChips) {
        showMessage(
            "You do not have enough wallet chips."
        );

        return;
    }


    setDropInProgress(true);
    showMessage();


    try {
        /*
            The outcome is decided before the animation,
            inside the protected Supabase function.
        */

        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "play_plinko",
            {
                p_bet: bet
            }
        );


        if (error) {
            throw error;
        }


        const path =
            Array.isArray(data.path)
                ? data.path.map(Number)
                : [];


        if (path.length !== ROW_COUNT) {
            throw new Error(
                "Supabase returned an invalid Plinko path."
            );
        }


        await animateBall(path);


        walletChips =
            Number(data.wallet_chips);


        updateWalletDisplay();
        displayResult(data);
        prependHistory(data);

    } catch (error) {
        console.error(error);

        showMessage(
            error.message ||
            "The Plinko drop could not be completed."
        );

        drawBoard();

    } finally {
        setDropInProgress(false);
    }
}


/*
    Event listeners
*/

dropBallButton.addEventListener(
    "click",
    playDrop
);


betInput.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            playDrop();
        }
    }
);


for (const button of quickBetButtons) {
    button.addEventListener(
        "click",
        () => {
            betInput.value =
                button.dataset.bet;
        }
    );
}


logoutButton.addEventListener(
    "click",
    async () => {
        await window.supabaseClient.auth.signOut({
            scope: "local"
        });

        window.location.href =
            "login.html";
    }
);


window.addEventListener(
    "resize",
    resizeCanvas
);


window.addEventListener(
    "beforeunload",
    () => {
        cancelAnimationFrame(
            animationFrameId
        );
    }
);


/*
    Initial data
*/

async function loadPlinkoData(userId) {
    if (!userId) {
        throw new Error(
            "The current user ID is unavailable."
        );
    }

    const [
        profileResult,
        historyResult
    ] = await Promise.all([
        /*
            Only request the logged-in user's profile.

            Without this filter, maybeSingle() receives
            several profile rows and fails.
        */

        window.supabaseClient
            .from("profiles")
            .select("chips")
            .eq("id", userId)
            .maybeSingle(),

        window.supabaseClient
            .from("plinko_drops")
            .select(
                "bet, payout, multiplier_bps, slot_number, created_at"
            )
            .eq("user_id", userId)
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(10)
    ]);


    if (profileResult.error) {
        console.error(
            "Profile query failed:",
            profileResult.error
        );

        throw profileResult.error;
    }


    if (!profileResult.data) {
        throw new Error(
            "Your player profile could not be found."
        );
    }


    if (historyResult.error) {
        console.error(
            "Plinko history query failed:",
            historyResult.error
        );

        throw historyResult.error;
    }


    walletChips =
        Number(
            profileResult.data.chips
        );


    updateWalletDisplay();


    renderHistory(
        historyResult.data ?? []
    );
}


async function initialisePlinko() {
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


        resizeCanvas();

        await loadPlinkoData(user.id);

    } catch (error) {
        console.error(error);

        showMessage(
            error.message ||
            "Plinko could not be loaded."
        );
    }
}


initialisePlinko();