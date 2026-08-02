(() => {
    if (window.__siteUiOverhaulLoaded) {
        return;
    }

    window.__siteUiOverhaulLoaded = true;

    const storageKeys = {
        compact: "site-ui-compact",
        contrast: "site-ui-high-contrast",
        reduceMotion: "site-ui-reduce-motion",
        botCollapsed: "site-ui-bot-panels-collapsed"
    };

    const currentFile =
        window.location.pathname.split("/").pop()
        || "index.html";

    const navigationItems = [
        {
            group: "Main",
            label: "Chat",
            href: "index.html",
            keywords: "messages room home"
        },
        {
            group: "Games",
            label: "Card Games",
            href: "poker.html",
            keywords: "poker blackjack hearts solitaire draw"
        },
        {
            group: "Games",
            label: "Plinko",
            href: "plinko.html",
            keywords: "single player chips"
        },
        {
            group: "Games",
            label: "Penguin Cross",
            href: "penguin-cross.html",
            keywords: "single player ice cash out"
        },
        {
            group: "Games",
            label: "Asteroid Salvage",
            href: "recovery.html",
            keywords: "recovery chips minigame"
        },
        {
            group: "Community",
            label: "Horse Racing",
            href: "horse-racing.html",
            keywords: "community race betting"
        },
        {
            group: "Community",
            label: "Roulette",
            href: "community-roulette.html",
            keywords: "community wheel bets"
        },
        {
            group: "Community",
            label: "Russian Roulette",
            href: "community-russian-roulette.html",
            keywords: "community chamber survival queue play leave"
        },
        {
            group: "Progress",
            label: "Challenges",
            href: "challenges.html",
            keywords: "daily achievements xp"
        },
        {
            group: "Social",
            label: "Clubs",
            href: "clubs.html",
            keywords: "group members points"
        },
        {
            group: "Social",
            label: "Friends",
            href: "friends.html",
            keywords: "requests players"
        },
        {
            group: "Social",
            label: "Profile",
            href: "profile.html",
            keywords: "cosmetics stats achievements"
        },
        {
            group: "Progress",
            label: "Leaderboards",
            href: "leaderboards.html",
            keywords: "rankings chips profit xp"
        },
        {
            group: "Account",
            label: "Donate chips",
            href: "donate.html",
            keywords: "send transfer"
        },
        {
            group: "Account",
            label: "Account settings",
            href: "account.html",
            keywords: "username password admin"
        },
        {
            group: "Account",
            label: "Disclaimer",
            href: "disclaimer.html",
            keywords: "legal rules"
        }
    ];

    const tablePages = new Set([
        "poker-table.html",
        "five-card-draw-table.html",
        "blackjack-table.html",
        "hearts-table.html",
        "solitaire-table.html"
    ]);

    let commandItems = [];
    let activeCommandIndex = 0;

    function readBoolean(key) {
        return window.localStorage.getItem(key) === "true";
    }

    function writeBoolean(key, value) {
        window.localStorage.setItem(key, String(value));
    }

    function applyPreferences() {
        document.documentElement.classList.toggle(
            "ui-density-compact",
            readBoolean(storageKeys.compact)
        );

        document.documentElement.classList.toggle(
            "ui-high-contrast",
            readBoolean(storageKeys.contrast)
        );

        document.documentElement.classList.toggle(
            "ui-reduce-motion",
            readBoolean(storageKeys.reduceMotion)
        );
    }

    function classifyPage() {
        const body = document.body;

        document.documentElement.classList.add(
            "ui-overhaul"
        );

        body.dataset.uiPage = currentFile
            .replace(".html", "")
            .replaceAll("-", "_");

        if (
            currentFile === "login.html"
            || currentFile === "register.html"
        ) {
            body.classList.add("auth-page");
        }

        if (tablePages.has(currentFile)) {
            body.classList.add("ui-game-table-page");
        }

        if (
            currentFile === "poker-table.html"
            || currentFile === "five-card-draw-table.html"
            || currentFile === "blackjack-table.html"
            || currentFile === "hearts-table.html"
        ) {
            body.classList.add("ui-multiplayer-table-page");
        }
    }

    function addSkipLink() {
        if (document.querySelector(".ui-skip-link")) {
            return;
        }

        const main = document.querySelector("main");

        if (!main) {
            return;
        }

        if (!main.id) {
            main.id = "main-content";
        }

        const link = document.createElement("a");
        link.className = "ui-skip-link";
        link.href = `#${main.id}`;
        link.textContent = "Skip to main content";
        document.body.prepend(link);
    }

    function toast(message, options = {}) {
        const {
            type = "info",
            duration = 3200
        } = options;

        let region = document.querySelector(
            "#ui-toast-region"
        );

        if (!region) {
            region = document.createElement("div");
            region.id = "ui-toast-region";
            region.className = "ui-toast-region";
            region.setAttribute("aria-live", "polite");
            region.setAttribute("aria-atomic", "false");
            document.body.append(region);
        }

        const item = document.createElement("div");
        item.className = "ui-toast";
        item.dataset.type = type;
        item.setAttribute("role", type === "error"
            ? "alert"
            : "status");

        const icon = document.createElement("span");
        icon.className = "ui-toast-icon";
        icon.textContent = type === "error"
            ? "!"
            : type === "success"
                ? "✓"
                : "•";

        const copy = document.createElement("span");
        copy.textContent = String(message);

        const close = document.createElement("button");
        close.type = "button";
        close.className = "ui-toast-close";
        close.setAttribute("aria-label", "Dismiss message");
        close.textContent = "×";

        const remove = () => item.remove();

        close.addEventListener("click", remove);
        item.append(icon, copy, close);
        region.append(item);

        if (duration > 0) {
            window.setTimeout(remove, duration);
        }

        return item;
    }

    window.uiToast = toast;

    function setupConnectionBanner() {
        let banner = null;

        const update = () => {
            if (navigator.onLine) {
                banner?.remove();
                banner = null;
                return;
            }

            if (banner) {
                return;
            }

            banner = document.createElement("div");
            banner.className = "ui-connection-banner";
            banner.setAttribute("role", "status");
            banner.textContent =
                "You are offline. Live game updates are paused.";
            document.body.append(banner);
        };

        window.addEventListener("online", () => {
            update();
            toast("Connection restored.", {
                type: "success"
            });
        });

        window.addEventListener("offline", update);
        update();
    }

    function setupBackToTop() {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ui-back-to-top";
        button.setAttribute("aria-label", "Back to top");
        button.title = "Back to top";
        button.textContent = "↑";

        button.addEventListener("click", () => {
            window.scrollTo({
                top: 0,
                behavior: document.documentElement.classList
                    .contains("ui-reduce-motion")
                    ? "auto"
                    : "smooth"
            });
        });

        document.body.append(button);

        const update = () => {
            button.classList.toggle(
                "visible",
                window.scrollY > 620
            );
        };

        window.addEventListener("scroll", update, {
            passive: true
        });

        update();
    }

    function toggleMobileNavigation(force = null) {
        const nav = document.querySelector(
            ".shared-site-nav"
        );

        if (!nav) {
            return;
        }

        const open = force === null
            ? !nav.classList.contains("ui-nav-open")
            : Boolean(force);

        nav.classList.toggle("ui-nav-open", open);

        nav.querySelector(".ui-mobile-nav-toggle")
            ?.setAttribute("aria-expanded", String(open));
    }

    function setupNavbar() {
        const nav = document.querySelector(
            ".shared-site-nav"
        );

        if (!nav) {
            return;
        }

        nav.classList.add("ui-overhauled-nav");

        if (!nav.querySelector(".ui-mobile-nav-toggle")) {
            const menu = document.createElement("button");
            menu.type = "button";
            menu.className = "ui-mobile-nav-toggle";
            menu.setAttribute("aria-expanded", "false");
            menu.setAttribute("aria-label", "Open navigation");
            menu.innerHTML =
                '<span aria-hidden="true">☰</span>'
                + '<span>Menu</span>';

            menu.addEventListener("click", () => {
                toggleMobileNavigation();
            });

            nav.prepend(menu);
        }

        const account =
            nav.querySelector(".site-nav-account");

        if (
            account
            && !account.querySelector(
                ".ui-command-trigger"
            )
        ) {
            const trigger = document.createElement("button");
            trigger.type = "button";
            trigger.className = "ui-command-trigger";
            trigger.innerHTML =
                '<span>Jump to</span>'
                + '<kbd>Ctrl K</kbd>';
            trigger.setAttribute(
                "aria-label",
                "Open quick navigation"
            );

            trigger.addEventListener("click", () => {
                openCommandPalette();
            });

            account.prepend(trigger);
        }

        nav.addEventListener("click", (event) => {
            if (
                event.target.closest("a")
                && window.matchMedia(
                    "(max-width: 1100px)"
                ).matches
            ) {
                toggleMobileNavigation(false);
            }
        });
    }

    function createCommandPalette() {
        const existing = document.querySelector(
            "#ui-command-dialog"
        );

        if (existing) {
            return existing;
        }

        const dialog = document.createElement("dialog");
        dialog.id = "ui-command-dialog";
        dialog.className = "ui-command-dialog";

        dialog.innerHTML = `
            <div class="ui-command-shell">
                <div class="ui-command-search-wrap">
                    <span
                        class="ui-command-search-icon"
                        aria-hidden="true"
                    >⌕</span>

                    <input
                        id="ui-command-search"
                        type="search"
                        autocomplete="off"
                        placeholder="Search pages and actions..."
                        aria-label="Search pages and actions"
                    >

                    <button
                        class="ui-command-close"
                        type="button"
                        aria-label="Close quick navigation"
                    >×</button>
                </div>

                <div
                    id="ui-command-results"
                    class="ui-command-results"
                ></div>

                <footer class="ui-command-footer">
                    <div class="ui-command-settings">
                        <button
                            class="ui-setting-toggle"
                            type="button"
                            data-setting="compact"
                        >
                            Compact UI
                        </button>

                        <button
                            class="ui-setting-toggle"
                            type="button"
                            data-setting="contrast"
                        >
                            Sharper contrast
                        </button>

                        <button
                            class="ui-setting-toggle"
                            type="button"
                            data-setting="reduceMotion"
                        >
                            Reduce motion
                        </button>
                    </div>

                    <span class="ui-command-hint">
                        ↑↓ navigate · Enter open · Esc close
                    </span>
                </footer>
            </div>
        `;

        document.body.append(dialog);

        const search = dialog.querySelector(
            "#ui-command-search"
        );

        dialog
            .querySelector(".ui-command-close")
            .addEventListener("click", closeCommandPalette);

        search.addEventListener("input", () => {
            renderCommandResults(search.value);
        });

        search.addEventListener("keydown", (event) => {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                moveCommandSelection(1);
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                moveCommandSelection(-1);
            } else if (event.key === "Enter") {
                event.preventDefault();
                commandItems[activeCommandIndex]?.click();
            }
        });

        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) {
                closeCommandPalette();
            }
        });

        dialog.addEventListener("close", () => {
            document.body.classList.remove(
                "ui-command-open"
            );
        });

        dialog
            .querySelectorAll(".ui-setting-toggle")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    togglePreference(
                        button.dataset.setting
                    );
                });
            });

        updatePreferenceButtons(dialog);
        renderCommandResults("");
        return dialog;
    }

    function currentActions() {
        const actions = [
            {
                group: "Actions",
                label: "Copy current page link",
                detail: "Copy a shareable URL",
                keywords: "copy invite share url",
                run: copyCurrentPageLink
            },
            {
                group: "Actions",
                label: "Back to top",
                detail: "Scroll to the beginning of this page",
                keywords: "scroll top",
                run: () => window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                })
            }
        ];

        if (
            document.querySelector(
                "#card-game-guide-button"
            )
            || currentFile === "poker.html"
            || tablePages.has(currentFile)
        ) {
            actions.unshift({
                group: "Actions",
                label: "How to play",
                detail: "Open the complete rules guide",
                keywords: "rules guide help instructions",
                run: () => {
                    document
                        .querySelector(
                            "#card-game-guide-button"
                        )
                        ?.click();
                }
            });
        }

        if (tablePages.has(currentFile)) {
            actions.push({
                group: "Actions",
                label: "Return to card-game lobby",
                detail: "Leave this page view",
                keywords: "poker lobby back",
                href: "poker.html"
            });
        }

        return actions;
    }

    function renderCommandResults(query) {
        const dialog = createCommandPalette();
        const results = dialog.querySelector(
            "#ui-command-results"
        );

        const normalized = String(query)
            .trim()
            .toLocaleLowerCase();

        const entries = [
            ...currentActions(),
            ...navigationItems.map((item) => ({
                ...item,
                detail: item.group
            }))
        ].filter((item) => {
            if (!normalized) {
                return true;
            }

            return [
                item.label,
                item.group,
                item.detail,
                item.keywords
            ]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase()
                .includes(normalized);
        });

        results.replaceChildren();
        commandItems = [];
        activeCommandIndex = 0;

        if (entries.length === 0) {
            const empty = document.createElement("p");
            empty.className = "empty-community-data";
            empty.textContent = "No matching pages or actions.";
            results.append(empty);
            return;
        }

        let previousGroup = "";

        for (const entry of entries) {
            if (entry.group !== previousGroup) {
                previousGroup = entry.group;

                const label = document.createElement("div");
                label.className = "ui-command-group-label";
                label.textContent = previousGroup;
                results.append(label);
            }

            const button = document.createElement("button");
            button.type = "button";
            button.className = "ui-command-item";

            const copy = document.createElement("span");
            copy.textContent = entry.label;

            const detail = document.createElement("small");
            detail.textContent = entry.detail || entry.group;

            button.append(copy, detail);

            button.addEventListener("click", async () => {
                closeCommandPalette();

                if (entry.href) {
                    window.location.href = entry.href;
                    return;
                }

                await entry.run?.();
            });

            results.append(button);
            commandItems.push(button);
        }

        updateCommandSelection();
    }

    function moveCommandSelection(direction) {
        if (commandItems.length === 0) {
            return;
        }

        activeCommandIndex =
            (activeCommandIndex + direction
                + commandItems.length)
            % commandItems.length;

        updateCommandSelection();
    }

    function updateCommandSelection() {
        commandItems.forEach((button, index) => {
            const active = index === activeCommandIndex;
            button.classList.toggle("active", active);

            if (active) {
                button.scrollIntoView({
                    block: "nearest"
                });
            }
        });
    }

    function updatePreferenceButtons(dialog = null) {
        const root = dialog || document;

        root
            .querySelectorAll(".ui-setting-toggle")
            .forEach((button) => {
                const setting = button.dataset.setting;
                const key = storageKeys[setting];

                button.setAttribute(
                    "aria-pressed",
                    String(readBoolean(key))
                );
            });
    }

    function togglePreference(setting) {
        const key = storageKeys[setting];

        if (!key) {
            return;
        }

        writeBoolean(key, !readBoolean(key));
        applyPreferences();
        updatePreferenceButtons();

        toast("Interface preference updated.", {
            type: "success",
            duration: 1800
        });
    }

    function openCommandPalette() {
        const dialog = createCommandPalette();

        renderCommandResults("");
        updatePreferenceButtons(dialog);

        if (!dialog.open) {
            dialog.showModal();
        }

        document.body.classList.add(
            "ui-command-open"
        );

        const search = dialog.querySelector(
            "#ui-command-search"
        );

        search.value = "";
        window.setTimeout(() => search.focus(), 0);
    }

    function closeCommandPalette() {
        const dialog = document.querySelector(
            "#ui-command-dialog"
        );

        if (dialog?.open) {
            dialog.close();
        }
    }

    async function copyCurrentPageLink() {
        try {
            await navigator.clipboard.writeText(
                window.location.href
            );

            toast("Page link copied.", {
                type: "success"
            });
        } catch {
            const temporary = document.createElement(
                "textarea"
            );
            temporary.value = window.location.href;
            temporary.style.position = "fixed";
            temporary.style.opacity = "0";
            document.body.append(temporary);
            temporary.select();
            document.execCommand("copy");
            temporary.remove();

            toast("Page link copied.", {
                type: "success"
            });
        }
    }

    function setupPageTools() {
        if (
            !tablePages.has(currentFile)
            || document.querySelector(".ui-page-tools")
        ) {
            return;
        }

        const header = document.querySelector(
            ".live-poker-header, "
            + ".draw-header, "
            + ".hearts-header, "
            + ".blackjack-header, "
            + ".solitaire-header"
        );

        if (!header) {
            return;
        }

        const tools = document.createElement("div");
        tools.className = "ui-page-tools";

        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "ui-page-tool";
        copy.textContent = "Copy table link";
        copy.addEventListener("click", copyCurrentPageLink);

        const lobby = document.createElement("a");
        lobby.className =
            "button-link secondary-link ui-page-tool";
        lobby.href = "poker.html";
        lobby.textContent = "Card-game lobby";

        tools.append(copy, lobby);
        header.insertAdjacentElement("afterend", tools);
    }

    function setupPasswordToggles() {
        document
            .querySelectorAll('input[type="password"]')
            .forEach((input) => {
                if (input.dataset.uiPasswordReady) {
                    return;
                }

                input.dataset.uiPasswordReady = "true";

                const wrapper =
                    document.createElement("div");
                wrapper.className = "ui-password-field";

                input.parentNode.insertBefore(
                    wrapper,
                    input
                );
                wrapper.append(input);

                const button =
                    document.createElement("button");
                button.type = "button";
                button.className =
                    "ui-password-toggle";
                button.textContent = "Show";
                button.setAttribute(
                    "aria-label",
                    "Show password"
                );

                button.addEventListener("click", () => {
                    const visible =
                        input.type === "text";

                    input.type = visible
                        ? "password"
                        : "text";
                    button.textContent = visible
                        ? "Show"
                        : "Hide";
                    button.setAttribute(
                        "aria-label",
                        visible
                            ? "Show password"
                            : "Hide password"
                    );
                });

                wrapper.append(button);
            });
    }

    function setupInputQualityOfLife() {
        document.addEventListener("wheel", (event) => {
            const input = event.target.closest(
                'input[type="number"]'
            );

            if (
                input
                && document.activeElement === input
            ) {
                input.blur();
            }
        }, {
            passive: true
        });

        document.addEventListener("focusin", (event) => {
            const input = event.target.closest(
                'input[type="number"]'
            );

            if (!input) {
                return;
            }

            window.setTimeout(() => {
                input.select?.();
            }, 0);
        });
    }

    function wrapTables() {
        document.querySelectorAll("table").forEach(
            (table) => {
                if (
                    table.closest(
                        ".ui-table-scroll, "
                        + ".leaderboard-table-wrap, "
                        + ".card-guide-table-wrap"
                    )
                ) {
                    return;
                }

                const wrapper =
                    document.createElement("div");
                wrapper.className = "ui-table-scroll";
                table.parentNode.insertBefore(
                    wrapper,
                    table
                );
                wrapper.append(table);
            }
        );
    }

    function setupBotPanel(panel) {
        if (
            !panel
            || panel.dataset.uiCollapseReady
        ) {
            return;
        }

        panel.dataset.uiCollapseReady = "true";

        const header = panel.querySelector(
            ".card-bot-manager-header, "
            + ".hearts-bot-manager-header"
        );

        if (!header) {
            return;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className =
            "ui-bot-collapse-button secondary-button";

        const applyState = (collapsed) => {
            panel.classList.toggle(
                "ui-bot-panel-collapsed",
                collapsed
            );
            button.textContent = collapsed
                ? "Expand"
                : "Collapse";
            button.setAttribute(
                "aria-expanded",
                String(!collapsed)
            );
        };

        applyState(
            readBoolean(storageKeys.botCollapsed)
        );

        button.addEventListener("click", () => {
            const collapsed =
                !panel.classList.contains(
                    "ui-bot-panel-collapsed"
                );

            writeBoolean(
                storageKeys.botCollapsed,
                collapsed
            );
            applyState(collapsed);
        });

        header.append(button);
    }

    function scheduleFiniteEnhancements() {
        const enhance = () => {
            setupNavbar();
            setupPageTools();
            wrapTables();

            setupBotPanel(
                document.querySelector(
                    ".card-bot-manager"
                )
            );

            setupBotPanel(
                document.querySelector(
                    ".hearts-bot-manager"
                )
            );
        };

        [0, 180, 650, 1600, 3200].forEach(
            (delay) => window.setTimeout(enhance, delay)
        );
    }

    function setupKeyboardShortcuts() {
        document.addEventListener("keydown", (event) => {
            const typing =
                event.target.matches(
                    "input, textarea, select, "
                    + "[contenteditable='true']"
                );

            if (
                (event.ctrlKey || event.metaKey)
                && event.key.toLocaleLowerCase() === "k"
            ) {
                event.preventDefault();
                openCommandPalette();
                return;
            }

            if (
                event.key === "Escape"
                && document
                    .querySelector(
                        ".shared-site-nav.ui-nav-open"
                    )
            ) {
                toggleMobileNavigation(false);
            }

            if (
                !typing
                && event.key === "?"
            ) {
                const guideButton =
                    document.querySelector(
                        "#card-game-guide-button"
                    );

                if (guideButton) {
                    event.preventDefault();
                    guideButton.click();
                }
            }

            if (
                !typing
                && event.key === "/"
            ) {
                const search = document.querySelector(
                    'input[type="search"], '
                    + 'input[id*="search"], '
                    + 'input[placeholder*="Search" i]'
                );

                if (search) {
                    event.preventDefault();
                    search.focus();
                    search.select?.();
                }
            }
        });
    }

    function initialise() {
        classifyPage();
        applyPreferences();
        addSkipLink();
        setupConnectionBanner();
        setupBackToTop();
        setupPasswordToggles();
        setupInputQualityOfLife();
        setupKeyboardShortcuts();
        createCommandPalette();
        scheduleFiniteEnhancements();

        document.documentElement.classList.add(
            "ui-ready"
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialise,
            { once: true }
        );
    } else {
        initialise();
    }
})();
