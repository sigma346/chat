const canvas =
    document.querySelector("#recovery-canvas");

const context =
    canvas.getContext("2d");

const walletBalanceLabel =
    document.querySelector("#wallet-balance");

const totalBankrollLabel =
    document.querySelector("#total-bankroll");

const eligibilityMessage =
    document.querySelector("#eligibility-message");

const timeLabel =
    document.querySelector("#time-label");

const scoreLabel =
    document.querySelector("#score-label");

const minimumScoreLabel =
    document.querySelector("#minimum-score-label");

const rewardEstimateLabel =
    document.querySelector("#reward-estimate-label");

const gameOverlay =
    document.querySelector("#game-overlay");

const overlayTitle =
    document.querySelector("#overlay-title");

const overlayText =
    document.querySelector("#overlay-text");

const startGameButton =
    document.querySelector("#start-game-button");

const recoveryMessage =
    document.querySelector("#recovery-message");

const logoutButton =
    document.querySelector("#logout-button");


let recoveryStatus = null;
let activeRun = null;

let running = false;
let submitting = false;

let score = 0;
let targets = [];

let random = Math.random;

let animationFrameId = null;
let previousFrameTime = 0;
let spawnCountdown = 0;
let deadline = 0;

let canvasWidth = 0;
let canvasHeight = 0;


/*
    Number formatting
*/

function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}


function formatRemainingTime(milliseconds) {
    const totalSeconds =
        Math.max(
            Math.ceil(milliseconds / 1000),
            0
        );

    const hours =
        Math.floor(totalSeconds / 3600);

    const minutes =
        Math.floor(
            (totalSeconds % 3600) / 60
        );

    const seconds =
        totalSeconds % 60;


    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }


    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }


    return `${seconds}s`;
}


function showMessage(
    message = "",
    type = "error"
) {
    recoveryMessage.textContent = message;
    recoveryMessage.className =
        `form-message ${type}`.trim();
}


/*
    Seeded random generator
*/

function createSeededRandom(seed) {
    let state =
        Number(seed) >>> 0;


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


/*
    Canvas sizing
*/

function resizeCanvas() {
    const rectangle =
        canvas.getBoundingClientRect();

    const deviceScale =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );


    canvasWidth = rectangle.width;
    canvasHeight = rectangle.height;


    canvas.width =
        Math.round(
            canvasWidth * deviceScale
        );

    canvas.height =
        Math.round(
            canvasHeight * deviceScale
        );


    context.setTransform(
        deviceScale,
        0,
        0,
        deviceScale,
        0,
        0
    );


    for (const target of targets) {
        target.x = Math.min(
            Math.max(target.x, target.radius),
            canvasWidth - target.radius
        );

        target.y = Math.min(
            Math.max(target.y, target.radius),
            canvasHeight - target.radius
        );
    }
}


/*
    Recovery eligibility
*/

function locallyEligible() {
    if (!recoveryStatus) {
        return false;
    }


    const belowLimit =
        Number(recoveryStatus.total_bankroll)
        <
        Number(recoveryStatus.target_bankroll);


    const nextAvailable =
        recoveryStatus.next_available_at
            ? Date.parse(
                recoveryStatus.next_available_at
            )
            : null;


    const cooldownFinished =
        nextAvailable === null
        || Date.now() >= nextAvailable;


    return belowLimit && cooldownFinished;
}


function renderRecoveryStatus() {
    if (!recoveryStatus) {
        return;
    }


    walletBalanceLabel.textContent =
        formatChips(
            recoveryStatus.wallet_chips
        );


    totalBankrollLabel.textContent =
        formatChips(
            recoveryStatus.total_bankroll
        );


    minimumScoreLabel.textContent =
        recoveryStatus.minimum_score;


    if (running || submitting) {
        startGameButton.disabled = true;
        return;
    }


    const targetBankroll =
        Number(
            recoveryStatus.target_bankroll
        );


    const totalBankroll =
        Number(
            recoveryStatus.total_bankroll
        );


    const nextAvailable =
        recoveryStatus.next_available_at
            ? Date.parse(
                recoveryStatus.next_available_at
            )
            : null;


    if (totalBankroll >= targetBankroll) {
        eligibilityMessage.textContent =
            `Recovery unlocks below ${formatChips(targetBankroll)} total chips.`;

        startGameButton.disabled = true;

        return;
    }


    if (
        nextAvailable !== null
        && Date.now() < nextAvailable
    ) {
        eligibilityMessage.textContent =
            `Recovery available in ${formatRemainingTime(nextAvailable - Date.now())}.`;

        startGameButton.disabled = true;

        return;
    }


    eligibilityMessage.textContent =
        "You are eligible for a salvage run.";

    startGameButton.disabled = false;
}


/*
    Reward estimate
*/

function updateRewardEstimate() {
    if (!activeRun) {
        rewardEstimateLabel.textContent =
            "0";

        return;
    }


    if (
        score <
        Number(activeRun.minimum_score)
    ) {
        rewardEstimateLabel.textContent =
            "0";

        return;
    }


    const availableRecovery =
        Math.max(
            Number(activeRun.target_bankroll)
            -
            Number(activeRun.total_bankroll),

            0
        );


    const calculatedReward =
        200 + score * 15;


    rewardEstimateLabel.textContent =
        formatChips(
            Math.min(
                availableRecovery,
                calculatedReward
            )
        );
}


function updateScore(change) {
    score =
        Math.min(
            Math.max(
                score + change,
                0
            ),
            75
        );


    scoreLabel.textContent = score;

    updateRewardEstimate();
}


/*
    Target generation
*/

function createTarget() {
    if (
        canvasWidth <= 0
        || canvasHeight <= 0
    ) {
        return;
    }


    const typeRoll = random();

    let type = "asteroid";


    if (typeRoll < 0.19) {
        type = "mine";

    } else if (typeRoll < 0.29) {
        type = "gold";
    }


    const radius =
        18 + random() * 14;


    let x =
        radius
        + random()
        * Math.max(
            canvasWidth - radius * 2,
            1
        );


    let y =
        radius
        + random()
        * Math.max(
            canvasHeight - radius * 2,
            1
        );


    /*
        Try not to spawn directly over another target.
    */

    for (
        let attempt = 0;
        attempt < 8;
        attempt += 1
    ) {
        const overlapping =
            targets.some(
                (target) => {
                    const xDifference =
                        target.x - x;

                    const yDifference =
                        target.y - y;

                    const distance =
                        Math.hypot(
                            xDifference,
                            yDifference
                        );

                    return distance <
                        target.radius
                        + radius
                        + 20;
                }
            );


        if (!overlapping) {
            break;
        }


        x =
            radius
            + random()
            * Math.max(
                canvasWidth - radius * 2,
                1
            );


        y =
            radius
            + random()
            * Math.max(
                canvasHeight - radius * 2,
                1
            );
    }


    const angle =
        random() * Math.PI * 2;


    const speed =
        85 + random() * 95;


    const shape = [];


    for (
        let point = 0;
        point < 10;
        point += 1
    ) {
        shape.push(
            0.72 + random() * 0.35
        );
    }


    targets.push({
        type,
        x,
        y,
        radius,

        velocityX:
            Math.cos(angle) * speed,

        velocityY:
            Math.sin(angle) * speed,

        rotation:
            random() * Math.PI * 2,

        spin:
            (random() - 0.5) * 2.1,

        phase:
            random() * Math.PI * 2,

        lifetime:
            2600 + random() * 2200,

        shape
    });
}


/*
    Canvas drawing
*/

function drawBackground() {
    const gradient =
        context.createRadialGradient(
            canvasWidth * 0.5,
            canvasHeight * 0.5,
            0,

            canvasWidth * 0.5,
            canvasHeight * 0.5,
            Math.max(
                canvasWidth,
                canvasHeight
            )
        );


    gradient.addColorStop(
        0,
        "#152138"
    );

    gradient.addColorStop(
        1,
        "#070a11"
    );


    context.fillStyle = gradient;

    context.fillRect(
        0,
        0,
        canvasWidth,
        canvasHeight
    );
}


function drawAsteroid(target) {
    context.save();

    context.translate(
        target.x,
        target.y
    );

    context.rotate(
        target.rotation
    );


    context.beginPath();


    for (
        let point = 0;
        point < target.shape.length;
        point += 1
    ) {
        const angle =
            point
            / target.shape.length
            * Math.PI
            * 2;


        const radius =
            target.radius
            * target.shape[point];


        const x =
            Math.cos(angle) * radius;

        const y =
            Math.sin(angle) * radius;


        if (point === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    }


    context.closePath();


    if (target.type === "gold") {
        context.fillStyle =
            "#e6b94a";

        context.strokeStyle =
            "#fff0a8";

    } else {
        context.fillStyle =
            "#7d8796";

        context.strokeStyle =
            "#c4ccd7";
    }


    context.lineWidth = 2;

    context.fill();
    context.stroke();


    context.beginPath();

    context.arc(
        -target.radius * 0.24,
        -target.radius * 0.14,
        target.radius * 0.19,
        0,
        Math.PI * 2
    );


    context.fillStyle =
        target.type === "gold"
            ? "#ac7e23"
            : "#59616e";

    context.fill();


    context.restore();
}


function drawMine(target) {
    context.save();

    context.translate(
        target.x,
        target.y
    );

    context.rotate(
        target.rotation
    );


    context.strokeStyle =
        "#ff7b7b";

    context.lineWidth = 4;


    for (
        let spike = 0;
        spike < 8;
        spike += 1
    ) {
        const angle =
            spike / 8
            * Math.PI * 2;


        context.beginPath();

        context.moveTo(
            Math.cos(angle)
                * target.radius * 0.72,

            Math.sin(angle)
                * target.radius * 0.72
        );

        context.lineTo(
            Math.cos(angle)
                * target.radius * 1.25,

            Math.sin(angle)
                * target.radius * 1.25
        );

        context.stroke();
    }


    context.beginPath();

    context.arc(
        0,
        0,
        target.radius * 0.76,
        0,
        Math.PI * 2
    );


    context.fillStyle =
        "#9d2f3b";

    context.strokeStyle =
        "#ff9da6";

    context.lineWidth = 2;

    context.fill();
    context.stroke();


    context.beginPath();

    context.arc(
        0,
        0,
        target.radius * 0.22,
        0,
        Math.PI * 2
    );


    context.fillStyle =
        "#ffccd1";

    context.fill();


    context.restore();
}


function drawTarget(target) {
    if (target.type === "mine") {
        drawMine(target);
    } else {
        drawAsteroid(target);
    }
}


/*
    Main animation loop
*/

function updateTarget(
    target,
    deltaSeconds,
    elapsedTime
) {
    const turning =
        Math.sin(
            elapsedTime / 460
            + target.phase
        )
        * 0.55
        * deltaSeconds;


    const cosine =
        Math.cos(turning);

    const sine =
        Math.sin(turning);


    const oldVelocityX =
        target.velocityX;


    target.velocityX =
        target.velocityX * cosine
        - target.velocityY * sine;


    target.velocityY =
        oldVelocityX * sine
        + target.velocityY * cosine;


    target.x +=
        target.velocityX
        * deltaSeconds;


    target.y +=
        target.velocityY
        * deltaSeconds;


    target.rotation +=
        target.spin
        * deltaSeconds;


    target.lifetime -=
        deltaSeconds * 1000;


    if (
        target.x - target.radius < 0
        && target.velocityX < 0
    ) {
        target.x = target.radius;
        target.velocityX *= -1;
    }


    if (
        target.x + target.radius
            > canvasWidth
        && target.velocityX > 0
    ) {
        target.x =
            canvasWidth
            - target.radius;

        target.velocityX *= -1;
    }


    if (
        target.y - target.radius < 0
        && target.velocityY < 0
    ) {
        target.y = target.radius;
        target.velocityY *= -1;
    }


    if (
        target.y + target.radius
            > canvasHeight
        && target.velocityY > 0
    ) {
        target.y =
            canvasHeight
            - target.radius;

        target.velocityY *= -1;
    }
}


function animationLoop(timestamp) {
    if (!running) {
        return;
    }


    if (previousFrameTime === 0) {
        previousFrameTime = timestamp;
    }


    const deltaMilliseconds =
        Math.min(
            timestamp - previousFrameTime,
            40
        );


    const deltaSeconds =
        deltaMilliseconds / 1000;


    previousFrameTime = timestamp;


    const remainingMilliseconds =
        deadline - Date.now();


    timeLabel.textContent =
        Math.max(
            Math.ceil(
                remainingMilliseconds / 1000
            ),
            0
        );


    if (remainingMilliseconds <= 0) {
        finishGame();
        return;
    }


    spawnCountdown -=
        deltaMilliseconds;


    if (
        spawnCountdown <= 0
        && targets.length < 7
    ) {
        createTarget();

        spawnCountdown =
            430 + random() * 470;
    }


    for (const target of targets) {
        updateTarget(
            target,
            deltaSeconds,
            timestamp
        );
    }


    targets = targets.filter(
        (target) =>
            target.lifetime > 0
    );


    drawBackground();


    for (const target of targets) {
        drawTarget(target);
    }


    animationFrameId =
        requestAnimationFrame(
            animationLoop
        );
}


/*
    Clicking targets
*/

canvas.addEventListener(
    "pointerdown",
    (event) => {
        if (!running) {
            return;
        }


        event.preventDefault();


        const rectangle =
            canvas.getBoundingClientRect();


        const pointerX =
            event.clientX
            - rectangle.left;


        const pointerY =
            event.clientY
            - rectangle.top;


        for (
            let index =
                targets.length - 1;

            index >= 0;

            index -= 1
        ) {
            const target =
                targets[index];


            const distance =
                Math.hypot(
                    pointerX - target.x,
                    pointerY - target.y
                );


            if (
                distance <=
                target.radius + 5
            ) {
                targets.splice(
                    index,
                    1
                );


                if (target.type === "mine") {
                    updateScore(-2);

                } else if (
                    target.type === "gold"
                ) {
                    updateScore(3);

                } else {
                    updateScore(1);
                }


                break;
            }
        }
    }
);


/*
    Start and finish the game
*/

async function startGame() {
    if (
        running
        || submitting
        || !locallyEligible()
    ) {
        return;
    }


    showMessage();

    startGameButton.disabled = true;

    overlayTitle.textContent =
        "Starting run...";

    overlayText.textContent =
        "Preparing the salvage field.";


    try {
        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "start_chip_recovery"
        );


        if (error) {
            throw error;
        }


        activeRun = data;

        random =
            createSeededRandom(
                Number(data.seed)
            );


        score = 0;
        targets = [];

        scoreLabel.textContent = "0";

        timeLabel.textContent =
            data.duration_seconds;

        updateRewardEstimate();


        /*
            Use the server timestamps to calculate how much
            time remains after network delay.
        */

        const serverDuration =
            Date.parse(data.expires_at)
            -
            Date.parse(data.server_now);


        deadline =
            Date.now()
            + serverDuration;


        running = true;
        submitting = false;

        previousFrameTime = 0;
        spawnCountdown = 100;


        gameOverlay.classList.add(
            "hidden"
        );


        animationFrameId =
            requestAnimationFrame(
                animationLoop
            );

    } catch (error) {
        console.error(error);

        overlayTitle.textContent =
            "Unable to start";

        overlayText.textContent =
            error.message ||
            "The salvage run could not be started.";

        startGameButton.disabled =
            !locallyEligible();

        showMessage(
            error.message ||
            "The salvage run could not be started."
        );
    }
}


async function finishGame() {
    if (!running) {
        return;
    }


    running = false;
    submitting = true;


    cancelAnimationFrame(
        animationFrameId
    );


    targets = [];

    drawBackground();


    gameOverlay.classList.remove(
        "hidden"
    );


    overlayTitle.textContent =
        "Submitting score...";

    overlayText.textContent =
        `Final score: ${score}`;

    startGameButton.disabled = true;


    try {
        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "claim_chip_recovery",
            {
                p_run_id:
                    activeRun.run_id,

                p_score:
                    score
            }
        );


        if (error) {
            throw error;
        }


        if (Number(data.reward) > 0) {
            overlayTitle.textContent =
                "Salvage complete";

            overlayText.textContent =
                `You recovered ${formatChips(data.reward)} chips with a score of ${score}.`;

            showMessage(
                `${formatChips(data.reward)} chips were added to your wallet.`,
                "success"
            );

        } else if (
            score <
            Number(data.minimum_score)
        ) {
            overlayTitle.textContent =
                "Not enough salvage";

            overlayText.textContent =
                `You scored ${score}. Reach ${data.minimum_score} to earn chips.`;

            showMessage(
                "No chips were awarded. You may retry.",
                "error"
            );

        } else {
            overlayTitle.textContent =
                "No reward available";

            overlayText.textContent =
                "Your total bankroll is already at the recovery limit.";
        }


        await loadRecoveryStatus();

    } catch (error) {
        console.error(error);

        overlayTitle.textContent =
            "Submission failed";

        overlayText.textContent =
            error.message ||
            "The recovery reward could not be claimed.";

        showMessage(
            error.message ||
            "The recovery reward could not be claimed."
        );

    } finally {
        submitting = false;
        activeRun = null;

        startGameButton.textContent =
            "Start salvage run";

        renderRecoveryStatus();
    }
}


startGameButton.addEventListener(
    "click",
    startGame
);


/*
    Supabase account and status
*/

async function loadRecoveryStatus() {
    const {
        data,
        error
    } = await window.supabaseClient.rpc(
        "get_chip_recovery_status"
    );


    if (error) {
        throw error;
    }


    recoveryStatus = data;

    renderRecoveryStatus();
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


/*
    Update the visible cooldown every second.
*/

window.setInterval(
    () => {
        if (!running && !submitting) {
            renderRecoveryStatus();
        }
    },
    1000
);


async function initialiseRecoveryGame() {
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
        drawBackground();

        await loadRecoveryStatus();

    } catch (error) {
        console.error(error);

        eligibilityMessage.textContent =
            "The recovery system could not be loaded.";

        showMessage(
            error.message ||
            "The recovery system could not be loaded."
        );
    }
}


initialiseRecoveryGame();