(() => {
    if (window.__cardBotSystemLoaded) {
        return;
    }

    window.__cardBotSystemLoaded = true;
    const supportedPages = new Set([
        "poker-table.html",
        "blackjack-table.html",
        "five-card-draw-table.html"
    ]);

    const currentPage =
        window.location.pathname.split("/").pop()
        || "index.html";

    if (!supportedPages.has(currentPage)) {
        return;
    }

    const tableId =
        new URLSearchParams(window.location.search).get("id");

    if (!tableId) {
        return;
    }

    let botState = null;
    let stateLoading = false;
    let botActionRunning = false;
    let botChannel = null;
    let refreshTimer = null;
    let decorationFrame = 0;

    function formatChips(value) {
        return new Intl.NumberFormat("en-AU").format(
            Number(value ?? 0)
        );
    }

    function injectStyles() {
        if (document.querySelector("#card-bot-styles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "card-bot-styles";
        style.textContent = `
            .card-bot-manager {
                margin: 1rem 0;
                padding: 1rem;
                border: 1px solid rgba(148, 163, 184, 0.2);
                border-radius: 0.95rem;
                background: rgba(12, 19, 30, 0.86);
                color: #eef3fb;
            }

            .card-bot-manager[hidden] {
                display: none !important;
            }

            .card-bot-manager-header,
            .card-bot-add-row,
            .card-bot-list-item,
            .card-bot-list-actions {
                display: flex;
                align-items: center;
            }

            .card-bot-manager-header {
                justify-content: space-between;
                gap: 1rem;
            }

            .card-bot-manager-title {
                margin: 0;
                font-size: 1rem;
            }

            .card-bot-manager-copy {
                margin: 0.25rem 0 0;
                color: #9eacc0;
                font-size: 0.78rem;
                line-height: 1.45;
            }

            .card-bot-practice-badge,
            .card-bot-inline-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: max-content;
                flex: 0 0 auto;
                border: 1px solid rgba(129, 155, 255, 0.3);
                border-radius: 999px;
                background: rgba(83, 105, 190, 0.16);
                color: #cdd7ff;
                font-size: 0.64rem;
                font-weight: 900;
                letter-spacing: 0.06em;
                line-height: 1;
                text-transform: uppercase;
            }

            .card-bot-practice-badge {
                min-height: 1.8rem;
                padding: 0.35rem 0.6rem;
            }

            .card-bot-inline-badge {
                min-height: 1.15rem;
                margin-left: 0.3rem;
                padding: 0.2rem 0.34rem;
                vertical-align: middle;
            }

            .card-bot-controls {
                margin-top: 0.85rem;
                padding-top: 0.85rem;
                border-top: 1px solid rgba(148, 163, 184, 0.15);
            }

            .card-bot-add-row {
                align-items: end;
                gap: 0.65rem;
                flex-wrap: wrap;
            }

            .card-bot-field {
                display: grid;
                gap: 0.3rem;
                min-width: 9rem;
                color: #b9c5d6;
                font-size: 0.72rem;
                font-weight: 750;
            }

            .card-bot-field input,
            .card-bot-field select {
                min-height: 2.55rem;
                padding: 0.55rem 0.65rem;
                border: 1px solid rgba(148, 163, 184, 0.24);
                border-radius: 0.7rem;
                background: rgba(7, 12, 20, 0.82);
                color: #f5f7fb;
                font: inherit;
            }

            .card-bot-add-button,
            .card-bot-remove-button {
                min-height: 2.55rem;
                padding: 0.55rem 0.8rem;
                border-radius: 0.7rem;
                font: inherit;
                font-weight: 850;
                cursor: pointer;
            }

            .card-bot-add-button {
                border: 1px solid rgba(98, 230, 189, 0.3);
                background: rgba(98, 230, 189, 0.88);
                color: #07120f;
            }

            .card-bot-remove-button {
                border: 1px solid rgba(255, 112, 142, 0.3);
                background: rgba(143, 25, 53, 0.18);
                color: #ffb8c7;
            }

            .card-bot-list {
                display: grid;
                gap: 0.55rem;
                margin-top: 0.75rem;
            }

            .card-bot-list-item {
                justify-content: space-between;
                gap: 0.75rem;
                padding: 0.65rem 0.7rem;
                border: 1px solid rgba(148, 163, 184, 0.14);
                border-radius: 0.72rem;
                background: rgba(20, 29, 43, 0.64);
            }

            .card-bot-name {
                min-width: 0;
                font-weight: 850;
            }

            .card-bot-meta {
                display: block;
                margin-top: 0.15rem;
                color: #96a6bb;
                font-size: 0.7rem;
            }

            .card-bot-list-actions {
                gap: 0.45rem;
                flex-wrap: wrap;
                justify-content: flex-end;
            }

            .card-bot-list-actions select {
                min-height: 2.2rem;
                padding: 0.4rem 0.55rem;
                border: 1px solid rgba(148, 163, 184, 0.22);
                border-radius: 0.6rem;
                background: rgba(7, 12, 20, 0.82);
                color: #f5f7fb;
            }

            .card-bot-message {
                min-height: 1.1rem;
                margin: 0.65rem 0 0;
                color: #9eacc0;
                font-size: 0.72rem;
            }

            .card-bot-message.error {
                color: #ff9caf;
            }

            .card-bot-disabled-link {
                color: inherit !important;
                cursor: default !important;
                pointer-events: none;
                text-decoration: none !important;
            }

            .card-bot-seat-highlight {
                outline: 1px solid rgba(129, 155, 255, 0.22);
                outline-offset: -1px;
            }

            body .live-poker-panel #action-controls.card-bot-action-dock {
                position: sticky;
                z-index: 35;
                bottom: 0.65rem;
                display: flex;
                align-items: end;
                gap: 0.75rem;
                margin: 0.75rem 0;
                padding: 0.75rem;
                border: 1px solid rgba(148, 163, 184, 0.24);
                border-radius: 0.9rem;
                background: rgba(10, 15, 23, 0.94);
                box-shadow: 0 12px 30px rgba(0, 0, 0, 0.34);
                backdrop-filter: blur(12px);
            }

            body .live-poker-panel #action-controls.card-bot-action-dock.hidden {
                display: none !important;
            }

            body .live-poker-panel #action-controls.card-bot-action-dock
            .primary-actions,
            body .live-poker-panel #action-controls.card-bot-action-dock
            .raise-controls {
                flex: 1 1 0;
                margin: 0;
            }

            body .live-poker-panel #action-controls.card-bot-action-dock
            .primary-actions {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 0.5rem;
            }

            body .live-poker-panel #action-controls.card-bot-action-dock
            .raise-controls {
                display: grid;
                grid-template-columns: auto minmax(6rem, 1fr) auto;
                align-items: end;
                gap: 0.5rem;
            }


            @media (max-width: 650px) {
                body .live-poker-panel #action-controls.card-bot-action-dock {
                    position: static;
                    align-items: stretch;
                    flex-direction: column;
                }

                body .live-poker-panel #action-controls.card-bot-action-dock
                .raise-controls {
                    grid-template-columns: 1fr;
                }


                .card-bot-manager-header,
                .card-bot-list-item {
                    align-items: stretch;
                    flex-direction: column;
                }

                .card-bot-add-row {
                    align-items: stretch;
                }

                .card-bot-field {
                    width: 100%;
                }

                .card-bot-add-button,
                .card-bot-remove-button {
                    width: 100%;
                }

                .card-bot-list-actions {
                    justify-content: stretch;
                }

                .card-bot-list-actions select {
                    flex: 1;
                }
            }
        `;

        document.head.append(style);
    }

    function createManager() {
        const existing = document.querySelector(
            "#card-bot-manager"
        );

        if (existing) {
            return existing;
        }

        const panel = document.createElement("section");
        panel.id = "card-bot-manager";
        panel.className = "card-bot-manager";
        panel.hidden = true;

        panel.innerHTML = `
            <div class="card-bot-manager-header">
                <div>
                    <h2 class="card-bot-manager-title">
                        Practice bots
                    </h2>
                    <p class="card-bot-manager-copy">
                        Bot tables are Friendly mode only. They do not
                        award chips, XP, achievements, challenges,
                        statistics or club progress.
                    </p>
                </div>
                <span class="card-bot-practice-badge">
                    BOT PRACTICE
                </span>
            </div>

            <div
                id="card-bot-controls"
                class="card-bot-controls"
                hidden
            >
                <div class="card-bot-add-row">
                    <label class="card-bot-field">
                        Difficulty
                        <select id="card-bot-difficulty">
                            <option value="easy">Easy</option>
                            <option value="normal" selected>
                                Normal
                            </option>
                            <option value="hard">Hard</option>
                        </select>
                    </label>

                    <label
                        id="card-bot-stack-field"
                        class="card-bot-field"
                    >
                        Practice stack
                        <input
                            id="card-bot-stack"
                            type="number"
                            min="1"
                            step="1"
                        >
                    </label>

                    <button
                        id="card-bot-add-button"
                        class="card-bot-add-button"
                        type="button"
                    >
                        Add bot
                    </button>
                </div>
            </div>

            <div id="card-bot-list" class="card-bot-list"></div>

            <p
                id="card-bot-message"
                class="card-bot-message"
                aria-live="polite"
            ></p>
        `;

        const placementAnchor = {
            "poker-table.html":
                document.querySelector("#action-controls"),
            "five-card-draw-table.html":
                document.querySelector("#draw-controls"),
            "blackjack-table.html":
                document.querySelector(".blackjack-host-controls")
        }[currentPage]
        || document.querySelector("#action-controls")
        || document.querySelector("#betting-controls")
        || document.querySelector("#waiting-controls")
        || document.querySelector("#waiting-room-controls")
        || document.querySelector("#game-controls");

        if (placementAnchor?.parentNode) {
            placementAnchor.insertAdjacentElement(
                "afterend",
                panel
            );
        } else {
            const target =
                document.querySelector("main .panel")
                || document.querySelector("main")
                || document.body;

            target.append(panel);
        }

        panel
            .querySelector("#card-bot-add-button")
            .addEventListener("click", addBot);

        panel
            .querySelector("#card-bot-list")
            .addEventListener("click", handleBotListClick);

        panel
            .querySelector("#card-bot-list")
            .addEventListener("change", handleBotListChange);

        return panel;
    }

    function managerElement(selector) {
        return document
            .querySelector("#card-bot-manager")
            ?.querySelector(selector);
    }

    function showMessage(message = "", error = false) {
        const element = managerElement("#card-bot-message");

        if (!element) {
            return;
        }

        element.textContent = message;
        element.classList.toggle("error", error);
    }

    async function rpc(functionName, parameters = {}) {
        const result = await window.supabaseClient.rpc(
            functionName,
            parameters
        );

        if (result.error) {
            throw result.error;
        }

        return result.data;
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

        panel.hidden = !botState.is_host && bots.length === 0;

        const controls = managerElement("#card-bot-controls");
        const addButton = managerElement("#card-bot-add-button");
        const stackField = managerElement("#card-bot-stack-field");
        const stackInput = managerElement("#card-bot-stack");
        const list = managerElement("#card-bot-list");

        const canManage =
            botState.is_host
            && botState.status === "waiting";

        controls.hidden = !canManage;
        addButton.disabled =
            !canManage
            || bots.length >= Number(botState.max_players);

        stackField.hidden = botState.game_type === "hearts";

        if (
            document.activeElement !== stackInput
            && !stackInput.value
        ) {
            stackInput.value = String(
                Number(botState.min_buy_in ?? 1)
            );
        }

        stackInput.min = String(
            Number(botState.min_buy_in ?? 1)
        );
        stackInput.max = String(
            Number(botState.max_buy_in ?? 1)
        );

        list.replaceChildren();

        if (bots.length === 0) {
            const empty = document.createElement("p");
            empty.className = "card-bot-manager-copy";
            empty.textContent = canManage
                ? "Add a bot to convert this waiting table into Friendly practice mode."
                : "No bots are seated.";
            list.append(empty);
            return;
        }

        for (const bot of bots) {
            const row = document.createElement("article");
            row.className = "card-bot-list-item";
            row.dataset.botUserId = bot.user_id;

            const copy = document.createElement("div");
            copy.className = "card-bot-name";
            copy.innerHTML = `
                ${escapeHtml(bot.username)}
                <span class="card-bot-inline-badge">BOT</span>
                <span class="card-bot-meta">
                    Seat ${Number(bot.seat_number)}
                    · ${formatChips(bot.stack)} practice chips
                </span>
            `;

            const actions = document.createElement("div");
            actions.className = "card-bot-list-actions";

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
                remove.className = "card-bot-remove-button";
                remove.textContent = "Remove";
                remove.dataset.action = "remove";
                remove.dataset.botUserId = bot.user_id;
                actions.append(remove);
            }

            row.append(copy, actions);
            list.append(row);
        }
    }

    function escapeHtml(value) {
        const temporary = document.createElement("span");
        temporary.textContent = String(value ?? "");
        return temporary.innerHTML;
    }

    async function loadBotState() {
        if (stateLoading) {
            return;
        }

        stateLoading = true;

        try {
            botState = await rpc("get_card_bot_state", {
                p_table_id: tableId
            });

            renderManager();
            scheduleDecorateBots();

        } catch (error) {
            console.warn("Bot state could not be loaded.", error);
        } finally {
            stateLoading = false;
        }
    }

    async function addBot() {
        const button = managerElement("#card-bot-add-button");
        const difficulty =
            managerElement("#card-bot-difficulty").value;
        const stackInput = managerElement("#card-bot-stack");

        const stack = botState?.game_type === "hearts"
            ? null
            : Number.parseInt(stackInput.value, 10);

        button.disabled = true;
        showMessage("Adding bot...");

        try {
            botState = await rpc("add_card_bot", {
                p_table_id: tableId,
                p_difficulty: difficulty,
                p_stack: Number.isSafeInteger(stack)
                    ? stack
                    : null
            });

            showMessage(
                "Bot added. This table is now Friendly practice mode."
            );
            renderManager();
            scheduleDecorateBots();
        } catch (error) {
            showMessage(
                error.message || "The bot could not be added.",
                true
            );
        } finally {
            button.disabled = false;
        }
    }

    async function handleBotListClick(event) {
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

            showMessage("Bot removed.");
            renderManager();
            scheduleDecorateBots();

            window.dispatchEvent(
                new CustomEvent("card-bot-table-changed", {
                    detail: {
                        tableId,
                        action: "removed"
                    }
                })
            );
        } catch (error) {
            showMessage(
                error.message || "The bot could not be removed.",
                true
            );
            button.disabled = false;
        }
    }

    async function handleBotListChange(event) {
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
                    p_bot_user_id: select.dataset.botUserId,
                    p_difficulty: select.value
                }
            );

            showMessage("Bot difficulty updated.");
            renderManager();
        } catch (error) {
            showMessage(
                error.message
                || "The difficulty could not be changed.",
                true
            );
            await loadBotState();
        }
    }

    function decorateBots() {
        const bots = Array.isArray(botState?.bots)
            ? botState.bots
            : [];

        for (const bot of bots) {
            const encodedId = encodeURIComponent(bot.user_id);

            document
                .querySelectorAll(
                    `a[href*="profile.html?id=${encodedId}"], `
                    + `a[href*="profile.html?id=${bot.user_id}"]`
                )
                .forEach((link) => {
                    link.removeAttribute("href");
                    link.removeAttribute("target");
                    link.classList.add("card-bot-disabled-link");
                    link.title =
                        `${bot.username} is a computer-controlled player.`;

                    addInlineBadge(link);
                });

            document
                .querySelectorAll(
                    `[data-user-id="${bot.user_id}"]`
                )
                .forEach((container) => {
                    const seat =
                        container.closest(
                            ".live-player-seat, "
                            + ".draw-player-seat, "
                            + ".blackjack-player-card, "
                            + ".hearts-player-card, "
                            + ".player-seat"
                        )
                        || container;

                    seat.classList.add(
                        "card-bot-seat-highlight"
                    );

                    const nameTarget =
                        container.querySelector(
                            ".cosmetic-player-name-row"
                        )
                        || container.querySelector(
                            ".player-name"
                        )
                        || container;

                    addInlineBadge(nameTarget);
                });
        }
    }

    function addInlineBadge(target) {
        if (
            !target
            || target.querySelector(
                ":scope > .card-bot-inline-badge"
            )
        ) {
            return;
        }

        const badge = document.createElement("span");
        badge.className = "card-bot-inline-badge";
        badge.textContent = "BOT";
        target.append(badge);
    }

    function scheduleDecorateBots() {
        if (decorationFrame) {
            return;
        }

        decorationFrame = window.requestAnimationFrame(() => {
            decorationFrame = 0;
            decorateBots();
        });
    }

    function movePokerActionsNextToTable() {
        if (currentPage !== "poker-table.html") {
            return;
        }

        const table = document.querySelector(".holdem-table");
        const controls = document.querySelector("#action-controls");

        if (!table || !controls) {
            return;
        }

        controls.classList.add("card-bot-action-dock");

        if (table.nextElementSibling !== controls) {
            table.insertAdjacentElement("afterend", controls);
        }
    }

    async function repairFrozenHeartsTable() {
        if (currentPage !== "hearts-table.html") {
            return null;
        }

        try {
            const result = await rpc("repair_hearts_bot_table", {
                p_table_id: tableId
            });

            if (result?.message) {
                showMessage(result.message);
            }

            return result;
        } catch (error) {
            console.warn("Hearts bot repair failed.", error);
            return null;
        }
    }

    async function runOneBotAction() {
        if (
            botActionRunning
            || document.visibilityState !== "visible"
            || botState?.status !== "playing"
            || !Array.isArray(botState?.bots)
            || botState.bots.length === 0
        ) {
            return;
        }

        botActionRunning = true;

        try {
            const isHearts =
                botState?.game_type === "hearts"
                || currentPage === "hearts-table.html";

            const result = await rpc("run_card_bots", {
                p_table_id: tableId,
                p_max_actions: isHearts ? 8 : 1
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

                if (isHearts) {
                    await repairFrozenHeartsTable();

                    const retry = await rpc("run_card_bots", {
                        p_table_id: tableId,
                        p_max_actions: 8
                    });

                    if (retry?.error) {
                        const retryDetail = [
                            retry.stage,
                            retry.sqlstate,
                            retry.error
                        ].filter(Boolean).join(" · ");

                        showMessage(
                            `Hearts bot still paused: ${retryDetail}`,
                            true
                        );
                    } else if (
                        retry?.acted
                        && retry.last_action
                    ) {
                        showMessage(retry.last_action);
                    }
                }
            } else if (result?.acted && result.last_action) {
                showMessage(result.last_action);
            }
        } catch (error) {
            console.warn("Bot action request failed.", error);

            if (currentPage === "hearts-table.html") {
                await repairFrozenHeartsTable();
            }
        } finally {
            botActionRunning = false;
        }
    }

    function scheduleStateRefresh() {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(
            loadBotState,
            250
        );
    }

    function subscribeToBots() {
        botChannel = window.supabaseClient
            .channel(`card-bots-${tableId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "card_table_bots",
                    filter: `table_id=eq.${tableId}`
                },
                scheduleStateRefresh
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "poker_tables",
                    filter: `id=eq.${tableId}`
                },
                scheduleStateRefresh
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "poker_seats",
                    filter: `table_id=eq.${tableId}`
                },
                scheduleStateRefresh
            )
            .subscribe();
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
        movePokerActionsNextToTable();
        await loadBotState();
        subscribeToBots();

        const observer = new MutationObserver(
            () => {
                scheduleDecorateBots();
                movePokerActionsNextToTable();
            }
        );

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        window.setInterval(runOneBotAction, 900);
        window.setInterval(loadBotState, 4500);

        document.addEventListener(
            "visibilitychange",
            () => {
                if (document.visibilityState === "visible") {
                    loadBotState();
                    runOneBotAction();
                }
            }
        );

        window.addEventListener("beforeunload", () => {
            observer.disconnect();
            window.clearTimeout(refreshTimer);

            if (botChannel) {
                window.supabaseClient.removeChannel(botChannel);
            }
        });
    }

    initialise();
})();
