(() => {
    if (window.__heartsBotControllerLoaded) {
        return;
    }

    window.__heartsBotControllerLoaded = true;

    const currentPage =
        window.location.pathname.split("/").pop()
        || "index.html";

    if (currentPage !== "hearts-table.html") {
        return;
    }

    const tableId =
        new URLSearchParams(window.location.search).get("id");

    if (!tableId) {
        return;
    }

    let botState = null;
    let heartsState = null;
    let stateRequestRunning = false;
    let botActionRunning = false;
    let actionTimer = null;

    function manager() {
        return document.querySelector("#hearts-bot-manager");
    }

    function managerElement(selector) {
        return manager()?.querySelector(selector) ?? null;
    }

    function injectStyles() {
        if (document.querySelector("#hearts-bot-styles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "hearts-bot-styles";
        style.textContent = `
            .hearts-bot-manager {
                display: grid;
                gap: 0.85rem;
                margin: 1rem 0;
                padding: 1rem;
                border: 1px solid rgba(148, 163, 184, 0.22);
                border-radius: 0.95rem;
                background: rgba(12, 19, 30, 0.9);
            }

            .hearts-bot-manager[hidden] {
                display: none !important;
            }

            .hearts-bot-manager-header,
            .hearts-bot-add-row,
            .hearts-bot-row,
            .hearts-bot-row-actions {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .hearts-bot-manager-header {
                justify-content: space-between;
            }

            .hearts-bot-manager h2,
            .hearts-bot-manager p {
                margin: 0;
            }

            .hearts-bot-manager-copy {
                margin-top: 0.25rem !important;
                color: var(--muted);
                font-size: 0.82rem;
                line-height: 1.45;
            }

            .hearts-bot-add-row {
                align-items: end;
            }

            .hearts-bot-field {
                display: grid;
                gap: 0.35rem;
                min-width: 10rem;
                color: var(--muted);
                font-size: 0.75rem;
                font-weight: 700;
            }

            .hearts-bot-field select {
                width: 100%;
            }

            .hearts-bot-list {
                display: grid;
                gap: 0.55rem;
            }

            .hearts-bot-row {
                justify-content: space-between;
                padding: 0.7rem;
                border: 1px solid rgba(148, 163, 184, 0.18);
                border-radius: 0.75rem;
                background: rgba(15, 22, 34, 0.75);
            }

            .hearts-bot-name {
                display: flex;
                align-items: center;
                gap: 0.45rem;
                flex-wrap: wrap;
                font-weight: 800;
            }

            .hearts-bot-meta {
                width: 100%;
                color: var(--muted);
                font-size: 0.72rem;
                font-weight: 500;
            }

            .hearts-bot-badge {
                display: inline-grid;
                place-items: center;
                min-height: 1.35rem;
                padding: 0.12rem 0.45rem;
                border: 1px solid rgba(98, 230, 189, 0.35);
                border-radius: 999px;
                background: rgba(98, 230, 189, 0.12);
                color: #a7f2d9;
                font-size: 0.62rem;
                font-weight: 900;
                letter-spacing: 0.06em;
            }

            .hearts-bot-message {
                min-height: 1.2rem;
                color: var(--muted);
                font-size: 0.78rem;
            }

            .hearts-bot-message.error {
                color: #ffb2b2;
            }

            @media (max-width: 650px) {
                .hearts-bot-manager-header,
                .hearts-bot-add-row,
                .hearts-bot-row {
                    align-items: stretch;
                    flex-direction: column;
                }

                .hearts-bot-field,
                .hearts-bot-add-row button,
                .hearts-bot-row-actions,
                .hearts-bot-row-actions select,
                .hearts-bot-row-actions button {
                    width: 100%;
                }
            }
        `;

        document.head.append(style);
    }

    function createManager() {
        const existing = manager();

        if (existing) {
            return existing;
        }

        const panel = document.createElement("section");
        panel.id = "hearts-bot-manager";
        panel.className = "hearts-bot-manager";
        panel.hidden = true;

        panel.innerHTML = `
            <div class="hearts-bot-manager-header">
                <div>
                    <h2>Practice bots</h2>
                    <p class="hearts-bot-manager-copy">
                        Hearts bots use Friendly practice mode.
                    </p>
                </div>
                <span class="hearts-bot-badge">BOT PRACTICE</span>
            </div>

            <div id="hearts-bot-controls" hidden>
                <div class="hearts-bot-add-row">
                    <label class="hearts-bot-field">
                        Difficulty
                        <select id="hearts-bot-difficulty">
                            <option value="easy">Easy</option>
                            <option value="normal" selected>Normal</option>
                            <option value="hard">Hard</option>
                        </select>
                    </label>

                    <button
                        id="hearts-add-bot-button"
                        type="button"
                    >
                        Add bot
                    </button>
                </div>
            </div>

            <div
                id="hearts-bot-list"
                class="hearts-bot-list"
            ></div>

            <p
                id="hearts-bot-message"
                class="hearts-bot-message"
                aria-live="polite"
            ></p>
        `;

        const actionAnchor =
            document.querySelector("#play-controls")
            || document.querySelector("#pass-controls")
            || document.querySelector("#waiting-controls");

        if (actionAnchor?.parentNode) {
            actionAnchor.insertAdjacentElement(
                "afterend",
                panel
            );
        } else {
            document.querySelector(".hearts-panel")?.append(panel);
        }

        panel
            .querySelector("#hearts-add-bot-button")
            .addEventListener("click", addBot);

        panel
            .querySelector("#hearts-bot-list")
            .addEventListener("click", handleListClick);

        panel
            .querySelector("#hearts-bot-list")
            .addEventListener("change", handleListChange);

        return panel;
    }

    function showMessage(message = "", isError = false) {
        const element = managerElement("#hearts-bot-message");

        if (!element) {
            return;
        }

        element.textContent = message;
        element.classList.toggle("error", isError);
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

    function renderManager() {
        const panel = createManager();

        if (!botState) {
            panel.hidden = true;
            return;
        }

        const bots = Array.isArray(botState.bots)
            ? botState.bots
            : [];

        const canManage =
            botState.is_host
            && botState.status === "waiting";

        panel.hidden = !botState.is_host && bots.length === 0;

        const controls =
            managerElement("#hearts-bot-controls");
        const addButton =
            managerElement("#hearts-add-bot-button");
        const list =
            managerElement("#hearts-bot-list");

        controls.hidden = !canManage;
        addButton.disabled =
            !canManage
            || Number(
                heartsState?.table?.seated_player_count
                ?? bots.length
            ) >= 4;

        list.replaceChildren();

        if (bots.length === 0) {
            const empty = document.createElement("p");
            empty.className = "hearts-bot-manager-copy";
            empty.textContent = canManage
                ? "Add bots until the table has four seats."
                : "No bots are seated.";
            list.append(empty);
            return;
        }

        for (const bot of bots) {
            const row = document.createElement("article");
            row.className = "hearts-bot-row";
            row.dataset.botUserId = bot.user_id;

            const name = document.createElement("div");
            name.className = "hearts-bot-name";

            const username = document.createElement("span");
            username.textContent = String(bot.username);

            const badge = document.createElement("span");
            badge.className = "hearts-bot-badge";
            badge.textContent = "BOT";

            const meta = document.createElement("span");
            meta.className = "hearts-bot-meta";
            meta.textContent =
                `Seat ${Number(bot.seat_number)} · `
                + `${String(bot.difficulty)} difficulty`;

            name.append(username, badge, meta);

            const actions = document.createElement("div");
            actions.className = "hearts-bot-row-actions";

            const difficulty = document.createElement("select");
            difficulty.dataset.action = "difficulty";
            difficulty.dataset.botUserId = bot.user_id;
            difficulty.disabled = !canManage;

            for (const value of ["easy", "normal", "hard"]) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent =
                    value[0].toUpperCase() + value.slice(1);
                option.selected = bot.difficulty === value;
                difficulty.append(option);
            }

            actions.append(difficulty);

            if (canManage) {
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "danger-button";
                remove.textContent = "Remove";
                remove.dataset.action = "remove";
                remove.dataset.botUserId = bot.user_id;
                actions.append(remove);
            }

            row.append(name, actions);
            list.append(row);
        }
    }

    async function loadBotState() {
        if (stateRequestRunning) {
            return;
        }

        stateRequestRunning = true;

        try {
            botState = await rpc("get_card_bot_state", {
                p_table_id: tableId
            });
            renderManager();
        } catch (error) {
            console.warn(
                "The Hearts bot state could not be loaded.",
                error
            );
            showMessage(
                error.message
                || "The bot controls could not be refreshed.",
                true
            );
        } finally {
            stateRequestRunning = false;
        }
    }

    async function refreshHeartsPage() {
        if (
            typeof window.refreshHeartsTableState
            !== "function"
        ) {
            return;
        }

        try {
            await window.refreshHeartsTableState();
        } catch (error) {
            console.error(
                "The Hearts table could not refresh.",
                error
            );
            showMessage(
                error.message
                || "The Hearts table could not refresh.",
                true
            );
        }
    }

    async function addBot() {
        const button =
            managerElement("#hearts-add-bot-button");
        const difficulty =
            managerElement("#hearts-bot-difficulty").value;

        button.disabled = true;
        showMessage("Adding bot...");

        try {
            botState = await rpc("add_card_bot", {
                p_table_id: tableId,
                p_difficulty: difficulty,
                p_stack: null
            });

            renderManager();
            await refreshHeartsPage();
            showMessage("Bot added.");
        } catch (error) {
            console.error(error);
            showMessage(
                error.message || "The bot could not be added.",
                true
            );
        } finally {
            button.disabled = false;
        }
    }

    async function handleListClick(event) {
        const button = event.target.closest(
            'button[data-action="remove"]'
        );

        if (!button) {
            return;
        }

        button.disabled = true;
        showMessage("Removing bot...");

        try {
            botState = await rpc("remove_card_bot", {
                p_table_id: tableId,
                p_bot_user_id: button.dataset.botUserId
            });

            renderManager();
            await refreshHeartsPage();
            showMessage("Bot removed.");
        } catch (error) {
            console.error(error);
            showMessage(
                error.message || "The bot could not be removed.",
                true
            );
            button.disabled = false;
        }
    }

    async function handleListChange(event) {
        const select = event.target.closest(
            'select[data-action="difficulty"]'
        );

        if (!select) {
            return;
        }

        select.disabled = true;
        showMessage("Changing difficulty...");

        try {
            botState = await rpc(
                "set_card_bot_difficulty",
                {
                    p_table_id: tableId,
                    p_bot_user_id:
                        select.dataset.botUserId,
                    p_difficulty: select.value
                }
            );

            renderManager();
            showMessage("Difficulty updated.");
        } catch (error) {
            console.error(error);
            showMessage(
                error.message
                || "The difficulty could not be changed.",
                true
            );
            await loadBotState();
        }
    }

    async function runBots() {
        if (
            botActionRunning
            || document.visibilityState !== "visible"
            || heartsState?.table?.status !== "playing"
            || !Array.isArray(botState?.bots)
            || botState.bots.length === 0
        ) {
            return;
        }

        botActionRunning = true;

        try {
            const result = await rpc("run_card_bots", {
                p_table_id: tableId,
                p_max_actions: 8
            });

            if (result?.error) {
                const detail = [
                    result.stage,
                    result.sqlstate,
                    result.error
                ].filter(Boolean).join(" · ");

                showMessage(
                    `Bot action paused: ${detail}`,
                    true
                );
                return;
            }

            if (result?.acted) {
                await refreshHeartsPage();
            }
        } catch (error) {
            console.error(
                "A Hearts bot action failed.",
                error
            );
            showMessage(
                error.message
                || "A Hearts bot action failed.",
                true
            );
        } finally {
            botActionRunning = false;
        }
    }

    function onHeartsStateRendered(event) {
        heartsState = event.detail ?? null;
        renderManager();
    }

    async function waitForSupabase() {
        for (let attempt = 0; attempt < 100; attempt += 1) {
            if (window.supabaseClient) {
                return true;
            }

            await new Promise((resolve) => {
                window.setTimeout(resolve, 50);
            });
        }

        return false;
    }

    async function initialise() {
        if (!await waitForSupabase()) {
            return;
        }

        injectStyles();
        createManager();

        window.addEventListener(
            "hearts-state-rendered",
            onHeartsStateRendered
        );

        await loadBotState();

        actionTimer = window.setInterval(
            runBots,
            950
        );

        document.addEventListener(
            "visibilitychange",
            () => {
                if (document.visibilityState === "visible") {
                    refreshHeartsPage();
                    runBots();
                }
            }
        );

        window.addEventListener("beforeunload", () => {
            window.clearInterval(actionTimer);
            window.removeEventListener(
                "hearts-state-rendered",
                onHeartsStateRendered
            );
        });
    }

    initialise();
})();
