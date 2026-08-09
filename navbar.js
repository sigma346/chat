(() => {
    const SITE_BUILD = "v8.1";
    window.__SITE_BUILD__ = SITE_BUILD;

    const currentFile =
        window.location.pathname
            .split("/")
            .pop()
        || "index.html";

    const gamePageFiles = new Set([
        "poker-table.html",
        "blackjack-table.html",
        "five-card-draw-table.html",
        "hearts-table.html",
        "shithead-table.html",
        "solitaire-table.html"
    ]);

    const navigationItems = [
        {
            label: "Home",
            href: "home.html",
            files: ["home.html"]
        },
        {
            label: "Chat",
            href: "index.html",
            files: ["index.html", ""]
        },
        {
            label: "Card Games",
            href: "poker.html",
            files: [
                "poker.html",
                ...gamePageFiles
            ]
        },
        {
            label: "Single Player",
            children: [
                {
                    label: "Plinko",
                    href: "plinko.html",
                    files: ["plinko.html"]
                },
                {
                    label: "Slot Machines",
                    href: "slots.html",
                    files: ["slots.html"]
                },
                {
                    label: "Penguin Cross",
                    href: "penguin-cross.html",
                    files: ["penguin-cross.html"]
                },
                {
                    label: "Asteroid Salvage",
                    href: "recovery.html",
                    files: ["recovery.html"]
                }
            ]
        },
        {
            label: "Community",
            children: [
                {
                    label: "Horse Racing",
                    href: "horse-racing.html",
                    files: ["horse-racing.html"]
                },
                {
                    label: "Roulette",
                    href: "community-roulette.html",
                    files: ["community-roulette.html"]
                },
                {
                    label: "Russian Roulette",
                    href: "community-russian-roulette.html",
                    files: ["community-russian-roulette.html"]
                },
                {
                    label: "Prediction Markets",
                    href: "prediction-markets.html",
                    files: ["prediction-markets.html"]
                }
            ]
        },
        {
            label: "Markets",
            children: [
                {
                    label: "Fictional Market",
                    href: "stocks.html",
                    files: ["stocks.html"]
                },
                {
                    label: "Real Market",
                    href: "real-stocks.html",
                    files: ["real-stocks.html"]
                },
                {
                    label: "Crypto",
                    href: "crypto.html",
                    files: ["crypto.html"]
                }
            ]
        },
        {
            label: "Challenges",
            href: "challenges.html",
            files: ["challenges.html"]
        },
        {
            label: "Social",
            children: [
                {
                    label: "Clubs",
                    href: "clubs.html",
                    files: ["clubs.html"]
                },
                {
                    label: "Friends",
                    href: "friends.html",
                    files: ["friends.html"]
                },
                {
                    label: "Messages",
                    href: "messages.html",
                    files: ["messages.html"],
                    messageBadge: true
                },
                {
                    label: "Profile",
                    href: "profile.html",
                    files: ["profile.html"]
                }
            ]
        },
        {
            label: "Leaderboards",
            href: "leaderboards.html",
            files: ["leaderboards.html"]
        },
        {
            label: "More",
            children: [
                {
                    label: "World News",
                    href: "news.html",
                    files: ["news.html"]
                },
                {
                    label: "Donate",
                    href: "donate.html",
                    files: ["donate.html"]
                },
                {
                    label: "Account",
                    href: "account.html",
                    files: ["account.html"]
                },
                {
                    label: "Admin",
                    href: "admin-users.html",
                    files: ["admin-users.html"],
                    adminOnly: true
                },
                {
                    label: "Disclaimer",
                    href: "disclaimer.html",
                    files: ["disclaimer.html"]
                }
            ]
        },
    ];

    function loadUiOverhaulStyles() {
        if (
            document.querySelector(
                'link[data-ui-overhaul="true"]'
            )
        ) {
            return;
        }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "ui-overhaul.css?v=35";
        link.dataset.uiOverhaul = "true";
        document.head.append(link);
    }

    function loadUiOverhaulScript() {
        if (
            document.querySelector(
                'script[data-ui-overhaul="true"]'
            )
        ) {
            return;
        }

        const script = document.createElement("script");
        script.src = "ui-overhaul.js?v=35";
        script.dataset.uiOverhaul = "true";
        script.addEventListener("error", () => {
            console.warn(
                "The shared interface overhaul could not be loaded."
            );
        });

        document.body.append(script);
    }

    function itemIsActive(item) {
        if (Array.isArray(item.files)) {
            return item.files.includes(currentFile);
        }

        if (Array.isArray(item.children)) {
            return item.children.some(
                (child) => itemIsActive(child)
            );
        }

        return false;
    }

    const hoverDropdownMedia = window.matchMedia(
        "(hover: hover) and (pointer: fine)"
    );

    const hoverCloseTimers = new WeakMap();

    function setDropdownOpen(dropdown, open) {
        if (!dropdown) {
            return;
        }

        dropdown.classList.toggle("open", open);

        dropdown
            .querySelector(".nav-dropdown-toggle")
            ?.setAttribute(
                "aria-expanded",
                String(open)
            );
    }

    function cancelDropdownClose(dropdown) {
        const timer = hoverCloseTimers.get(dropdown);

        if (timer) {
            window.clearTimeout(timer);
            hoverCloseTimers.delete(dropdown);
        }
    }

    function scheduleDropdownClose(dropdown) {
        cancelDropdownClose(dropdown);

        const timer = window.setTimeout(() => {
            setDropdownOpen(dropdown, false);
            hoverCloseTimers.delete(dropdown);
        }, 180);

        hoverCloseTimers.set(dropdown, timer);
    }

    function closeAllDropdowns(exceptDropdown = null) {
        document
            .querySelectorAll(".nav-dropdown.open")
            .forEach((dropdown) => {
                if (dropdown === exceptDropdown) {
                    return;
                }

                cancelDropdownClose(dropdown);
                setDropdownOpen(dropdown, false);
            });
    }

    function createNormalNavigationLink(item) {
        const link = document.createElement("a");
        link.href = item.href;
        link.className = "nav-link";

        const label = document.createElement("span");
        label.textContent = item.label;
        link.append(label);

        if (item.requestBadge) {
            const badge = document.createElement("span");
            badge.id = "navbar-friend-request-count";
            badge.className = "navbar-friend-request-count";
            badge.hidden = true;
            link.append(badge);
        }

        if (itemIsActive(item)) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }

        return link;
    }

    function createDropdownNavigationItem(item) {
        const dropdown = document.createElement("div");
        dropdown.className = "nav-dropdown";

        if (itemIsActive(item)) {
            dropdown.classList.add("active");
        }

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "nav-link nav-dropdown-toggle";
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-haspopup", "true");

        const label = document.createElement("span");
        label.textContent = item.label;

        const arrow = document.createElement("span");
        arrow.className = "nav-dropdown-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "▾";

        toggle.append(label, arrow);

        const menu = document.createElement("div");
        menu.className = "nav-dropdown-menu";
        menu.setAttribute("role", "menu");
        menu.setAttribute(
            "aria-label",
            `${item.label} games`
        );

        for (const child of item.children) {
            const link = document.createElement("a");
            link.href = child.href;
            link.className = "nav-dropdown-item";
            const label = document.createElement("span");
            label.textContent = child.label;
            link.append(label);

            if (child.messageBadge) {
                const badge = document.createElement("span");
                badge.id = "navbar-direct-message-count";
                badge.className = "navbar-direct-message-count";
                badge.hidden = true;
                link.append(badge);
            }

            if (child.adminOnly) {
                link.hidden = true;
                link.dataset.adminOnly = "true";
            }

            link.setAttribute("role", "menuitem");

            if (itemIsActive(child)) {
                link.classList.add("active");
                link.setAttribute(
                    "aria-current",
                    "page"
                );
            }

            link.addEventListener("click", () => {
                closeAllDropdowns();
            });

            menu.append(link);
        }

        toggle.addEventListener("click", (event) => {
            event.stopPropagation();

            const shouldOpen =
                !dropdown.classList.contains("open");

            closeAllDropdowns(
                shouldOpen ? dropdown : null
            );

            setDropdownOpen(dropdown, shouldOpen);
        });

        toggle.addEventListener("keydown", (event) => {
            if (
                event.key !== "ArrowDown"
                && event.key !== "Enter"
                && event.key !== " "
            ) {
                return;
            }

            if (
                event.key === "ArrowDown"
                && !dropdown.classList.contains("open")
            ) {
                event.preventDefault();
                setDropdownOpen(dropdown, true);
            }

            if (event.key === "ArrowDown") {
                event.preventDefault();
                menu.querySelector("a")?.focus();
            }
        });

        dropdown.addEventListener("pointerenter", () => {
            if (!hoverDropdownMedia.matches) {
                return;
            }

            cancelDropdownClose(dropdown);
            closeAllDropdowns(dropdown);
            setDropdownOpen(dropdown, true);
        });

        dropdown.addEventListener("pointerleave", () => {
            if (!hoverDropdownMedia.matches) {
                return;
            }

            scheduleDropdownClose(dropdown);
        });

        menu.addEventListener("pointerenter", () => {
            cancelDropdownClose(dropdown);
        });

        dropdown.append(toggle, menu);
        return dropdown;
    }

    function injectDropdownStyles() {
        if (
            document.querySelector(
                "#shared-navbar-dropdown-styles"
            )
        ) {
            return;
        }

        const style = document.createElement("style");
        style.id = "shared-navbar-dropdown-styles";
        style.textContent = `
            .shared-site-nav {
                position: relative;
                z-index: 1000;
            }

            .shared-site-nav .site-nav-links {
                align-items: center;
            }

            .site-build-version {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin: 0 0.15rem;
                color: rgba(203, 213, 225, 0.48);
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                font-size: 0.58rem;
                font-weight: 650;
                line-height: 1;
                letter-spacing: 0.045em;
                white-space: nowrap;
                user-select: text;
            }

            .nav-dropdown {
                position: relative;
                display: flex;
                align-items: center;
            }

            .nav-dropdown-toggle {
                display: inline-flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.45rem;
                min-height: 44px;
                padding: 0.72rem 1rem;
                border: 1px solid rgba(148, 163, 184, 0.2);
                border-radius: 0.95rem;
                background: rgba(12, 18, 29, 0.92);
                color: #e8edf7;
                font: inherit;
                font-weight: 600;
                cursor: pointer;
                white-space: nowrap;
                text-decoration: none;
                transition:
                    background 150ms ease,
                    border-color 150ms ease,
                    color 150ms ease,
                    box-shadow 150ms ease,
                    transform 150ms ease;
            }

            .nav-dropdown-toggle:hover,
            .nav-dropdown-toggle:focus-visible {
                background: rgba(20, 28, 42, 0.98);
                border-color: rgba(148, 163, 184, 0.32);
                color: #ffffff;
                outline: none;
                box-shadow: 0 0 0 1px rgba(98, 230, 189, 0.08);
            }

            .nav-dropdown.open > .nav-dropdown-toggle,
            .nav-dropdown.active > .nav-dropdown-toggle {
                background: rgba(18, 26, 39, 0.98);
                color: #ffffff;
                border-color: rgba(98, 230, 189, 0.28);
            }

            .nav-dropdown-arrow {
                display: inline-block;
                font-size: 0.72em;
                color: #9fb0c7;
                transition:
                    transform 160ms ease,
                    color 160ms ease,
                    opacity 160ms ease;
            }

            .nav-dropdown.open .nav-dropdown-arrow {
                transform: rotate(180deg);
                color: #dce6f5;
                opacity: 1;
            }

            .nav-dropdown-menu {
                position: absolute;
                top: calc(100% + 0.55rem);
                left: 0;
                z-index: 1100;
                display: grid;
                min-width: 13rem;
                padding: 0.45rem;
                border: 1px solid rgba(148, 163, 184, 0.2);
                border-radius: 0.9rem;
                background: rgba(10, 15, 24, 0.98);
                box-shadow: 0 18px 45px rgba(0, 0, 0, 0.34);
                opacity: 0;
                visibility: hidden;
                transform: translateY(-0.35rem) scale(0.98);
                transform-origin: top left;
                pointer-events: none;
                transition:
                    opacity 150ms ease,
                    transform 150ms ease,
                    visibility 150ms ease;
            }

            .nav-dropdown.open .nav-dropdown-menu,
            .nav-dropdown:focus-within .nav-dropdown-menu {
                opacity: 1;
                visibility: visible;
                transform: translateY(0) scale(1);
                pointer-events: auto;
            }

            .nav-dropdown-item {
                display: block;
                padding: 0.72rem 0.85rem;
                border-radius: 0.65rem;
                color: #d9e2f1;
                text-decoration: none;
                white-space: nowrap;
                transition:
                    background 130ms ease,
                    color 130ms ease,
                    transform 130ms ease;
            }

            .nav-dropdown-item:hover,
            .nav-dropdown-item:focus-visible {
                background: rgba(98, 230, 189, 0.1);
                color: #ffffff;
                outline: none;
                transform: translateX(0.12rem);
            }

            .nav-dropdown-item.active {
                background: rgba(98, 230, 189, 0.14);
                color: #ffffff;
                font-weight: 700;
            }

            .nav-dropdown-item[hidden] {
                display: none !important;
            }

            @media (max-width: 860px) {
                .shared-site-nav .site-nav-links {
                    align-items: stretch;
                }

                .nav-dropdown {
                    width: 100%;
                    display: block;
                }

                .nav-dropdown-toggle {
                    width: 100%;
                }

                .nav-dropdown-menu {
                    position: static;
                    min-width: 0;
                    width: 100%;
                    margin-top: 0.3rem;
                    box-shadow: none;
                    transform: none;
                    display: none;
                    opacity: 1;
                    visibility: visible;
                    pointer-events: auto;
                }

                .nav-dropdown.open .nav-dropdown-menu,
                .nav-dropdown:focus-within .nav-dropdown-menu {
                    display: grid;
                    transform: none;
                }

                .nav-dropdown-item {
                    white-space: normal;
                }
            }

            .navbar-friend-request-count {
                display: inline-grid;
                place-items: center;
                min-width: 1.25rem;
                height: 1.25rem;
                margin-left: 0.35rem;
                padding: 0 0.28rem;
                border: 1px solid rgba(255, 166, 184, 0.38);
                border-radius: 999px;
                background: rgba(190, 40, 75, 0.28);
                color: #ffd7df;
                font-size: 0.68rem;
                font-weight: 800;
                line-height: 1;
            }

            .navbar-friend-request-count[hidden] {
                display: none !important;
            }

            .navbar-direct-message-count {
                display: inline-grid;
                place-items: center;
                min-width: 1.25rem;
                height: 1.25rem;
                margin-left: 0.35rem;
                padding: 0 0.28rem;
                border-radius: 999px;
                background: #52d9ad;
                color: #06130f;
                font-size: 0.68rem;
                font-weight: 900;
                line-height: 1;
            }

            .navbar-direct-message-count[hidden] {
                display: none !important;
            }

            @media (max-width: 860px) {
                .site-build-version {
                    margin: 0 0.05rem;
                    font-size: 0.53rem;
                    opacity: 0.82;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .nav-dropdown-toggle,
                .nav-dropdown-arrow,
                .nav-dropdown-menu,
                .nav-dropdown-item {
                    transition: none;
                }
            }
        `;

        document.head.append(style);
    }

    function buildNavbar() {
        injectDropdownStyles();

        const navbar = document.createElement("nav");
        navbar.className = "site-nav shared-site-nav";
        navbar.setAttribute("aria-label", "Main navigation");

        const links = document.createElement("div");
        links.className = "site-nav-links";

        for (const item of navigationItems) {
            if (Array.isArray(item.children)) {
                links.append(
                    createDropdownNavigationItem(item)
                );
            } else {
                links.append(
                    createNormalNavigationLink(item)
                );
            }
        }

        const accountControls = document.createElement("div");
        accountControls.className = "site-nav-account";

        const buildVersion = document.createElement("span");
        buildVersion.className = "site-build-version";
        buildVersion.textContent = SITE_BUILD;
        buildVersion.title = `Site version ${SITE_BUILD}`;
        buildVersion.setAttribute("aria-label", `Site version ${SITE_BUILD}`);

        const levelLink = document.createElement("a");
        levelLink.id = "navbar-level-link";
        levelLink.className = "navbar-level-link";
        levelLink.href = "profile.html";
        levelLink.hidden = true;

        const levelText = document.createElement("strong");
        levelText.id = "navbar-level-text";
        levelText.textContent = "Lv. 1";

        const progressTrack = document.createElement("span");
        progressTrack.className = "navbar-xp-track";

        const progressFill = document.createElement("span");
        progressFill.id = "navbar-xp-fill";
        progressFill.className = "navbar-xp-fill";

        progressTrack.append(progressFill);
        levelLink.append(levelText, progressTrack);

        const logoutButton = document.createElement("button");
        logoutButton.id = "logout-button";
        logoutButton.className = "nav-button";
        logoutButton.type = "button";
        logoutButton.textContent = "Log out";

        logoutButton.addEventListener("click", async () => {
            try {
                if (window.supabaseClient) {
                    await window.supabaseClient.auth.signOut({
                        scope: "local"
                    });
                }
            } finally {
                window.location.href = "login.html";
            }
        });

        accountControls.append(buildVersion, levelLink, logoutButton);
        navbar.append(links, accountControls);

        return navbar;
    }

    function navbarMountTarget() {
        return document.querySelector("#site-navbar");
    }

    function pageLayout() {
        return document.querySelector(
            ".poker-layout, .plinko-layout, .slots-layout, .recovery-layout, "
            + ".draw-layout, .hearts-layout, .blackjack-layout, "
            + ".disclaimer-layout, .horse-racing-layout, "
            + ".community-roulette-layout, .penguin-cross-layout, .leaderboards-layout, "
            + ".donation-layout, .profile-layout, .friends-layout, .direct-messages-layout, "
            + ".challenges-layout"
        )
        || document.querySelector("main > div")
        || document.querySelector("main")
        || document.body;
    }

    function mountNavbar() {
        const navbar = buildNavbar();
        const mount = navbarMountTarget();

        document
            .querySelectorAll(".site-nav")
            .forEach((oldNavbar) => oldNavbar.remove());

        if (mount) {
            mount.replaceWith(navbar);
        } else {
            pageLayout().prepend(navbar);
        }

        return navbar;
    }

    function installDropdownDismissHandlers() {
        document.addEventListener("click", (event) => {
            if (
                !event.target.closest(
                    ".nav-dropdown"
                )
            ) {
                closeAllDropdowns();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") {
                return;
            }

            const openToggle =
                document.querySelector(
                    ".nav-dropdown.open "
                    + ".nav-dropdown-toggle"
                );

            closeAllDropdowns();
            openToggle?.focus();
        });
    }

    function loadProfileLinkEnhancer() {
        if (
            document.querySelector(
                'script[data-profile-links="true"]'
            )
        ) {
            return;
        }

        const script = document.createElement("script");
        script.src = "profile-links.js";
        script.dataset.profileLinks = "true";
        script.addEventListener("error", () => {
            console.warn(
                "Player profile links could not be loaded."
            );
        });

        document.body.append(script);
    }

    function loadAchievementSync() {
        if (
            document.querySelector(
                'script[data-achievement-sync="true"]'
            )
        ) {
            return;
        }

        const script = document.createElement("script");
        script.src = "achievement-sync.js";
        script.dataset.achievementSync = "true";
        script.addEventListener("error", () => {
            console.warn(
                "Achievement synchronisation could not be loaded."
            );
        });

        document.body.append(script);
    }

    function loadDailyChallengeSync() {
        if (
            document.querySelector(
                'script[data-daily-challenge-sync="true"]'
            )
        ) {
            return;
        }

        const script = document.createElement("script");
        script.src = "daily-challenge-sync.js";
        script.dataset.dailyChallengeSync = "true";
        script.addEventListener("error", () => {
            console.warn(
                "Daily challenge synchronisation could not be loaded."
            );
        });

        document.body.append(script);
    }

    function loadPlayerCallSystem() {
        if (
            !document.querySelector(
                'link[data-player-calls="true"]'
            )
        ) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "player-calls.css?v=2";
            link.dataset.playerCalls = "true";
            document.head.append(link);
        }

        /*
         * Load the portrait/orientation helper before the main call system.
         * Setting async=false preserves execution order for these dynamically
         * inserted classic scripts.
         */
        if (
            !document.querySelector(
                'script[data-player-call-video-fit="true"]'
            )
        ) {
            const videoFitScript =
                document.createElement("script");

            videoFitScript.src =
                "player-call-video-fit.js?v=8.1";
            videoFitScript.async = false;
            videoFitScript.dataset.playerCallVideoFit = "true";

            videoFitScript.addEventListener("error", () => {
                console.warn(
                    "The player-call portrait video helper could not be loaded."
                );
            });

            document.body.append(videoFitScript);
        }

        if (
            document.querySelector(
                'script[data-player-calls="true"]'
            )
        ) {
            return;
        }

        const script = document.createElement("script");
        script.src = "player-calls.js?v=3";
        script.async = false;
        script.dataset.playerCalls = "true";
        script.addEventListener("error", () => {
            console.warn(
                "The player call system could not be loaded."
            );
        });

        document.body.append(script);
    }

    function loadDesktopNotifications() {
        if (
            document.querySelector(
                'script[data-desktop-notifications="true"]'
            )
        ) {
            return;
        }

        const script = document.createElement("script");
        script.src = "desktop-notifications.js?v=1";
        script.dataset.desktopNotifications = "true";
        script.addEventListener("error", () => {
            console.warn(
                "Desktop notifications could not be loaded."
            );
        });

        document.body.append(script);
    }

    function loadCardBotSystem() {
        const isHeartsPage =
            currentFile === "hearts-table.html";

        const scriptName = isHeartsPage
            ? "hearts-bots.js?v=30"
            : "card-bots.js?v=30";

        const datasetName = isHeartsPage
            ? "heartsBots"
            : "cardBots";

        if (
            document.querySelector(
                isHeartsPage
                    ? 'script[data-hearts-bots="true"]'
                    : 'script[data-card-bots="true"]'
            )
        ) {
            return;
        }

        const script = document.createElement("script");
        script.src = scriptName;
        script.dataset[datasetName] = "true";
        script.addEventListener("error", () => {
            console.warn(
                isHeartsPage
                    ? "The Hearts bot controller could not be loaded."
                    : "The card bot controller could not be loaded."
            );
        });

        document.body.append(script);
    }

    function loadCardGameGuide() {
        if (
            currentFile !== "poker.html"
            && !gamePageFiles.has(currentFile)
        ) {
            return;
        }

        if (
            document.querySelector(
                'script[data-card-game-guide="true"]'
            )
        ) {
            return;
        }

        const script = document.createElement("script");
        script.src = "card-game-guide.js?v=30";
        script.dataset.cardGameGuide = "true";
        script.addEventListener("error", () => {
            console.warn(
                "The card-game guide could not be loaded."
            );
        });

        document.body.append(script);
    }

    let friendshipNavbarChannel = null;

    function updateFriendRequestBadge(value) {
        const badge = document.querySelector(
            "#navbar-friend-request-count"
        );

        if (!badge) {
            return;
        }

        const count = Math.max(
            Number(value ?? 0),
            0
        );

        badge.textContent = count > 99
            ? "99+"
            : String(count);

        badge.hidden = count === 0;
        badge.title = count === 1
            ? "1 incoming friend request"
            : `${count} incoming friend requests`;
    }

    async function loadFriendRequestCount() {
        if (!window.supabaseClient) {
            return;
        }

        try {
            const {
                data,
                error
            } = await window.supabaseClient.rpc(
                "get_my_friend_request_count"
            );

            if (error) {
                return;
            }

            updateFriendRequestBadge(data);
        } catch (error) {
            console.warn(
                "Friend request count could not be loaded:",
                error
            );
        }
    }

    async function subscribeToNavbarFriendships() {
        if (
            !window.supabaseClient
            || friendshipNavbarChannel
        ) {
            return;
        }

        try {
            const {
                data: { user }
            } = await window.supabaseClient.auth.getUser();

            if (!user) {
                return;
            }

            friendshipNavbarChannel =
                window.supabaseClient
                    .channel(
                        `navbar-friendships-${user.id}`
                    )
                    .on(
                        "postgres_changes",
                        {
                            event: "*",
                            schema: "public",
                            table: "player_friendships"
                        },
                        () => {
                            loadFriendRequestCount();
                        }
                    )
                    .subscribe();
        } catch (error) {
            console.warn(
                "Friendship updates could not be subscribed:",
                error
            );
        }
    }

    async function loadLevelProgress() {
        if (!window.supabaseClient) {
            return;
        }

        try {
            const {
                data,
                error
            } = await window.supabaseClient.rpc(
                "get_my_level_progress"
            );

            if (error || !data) {
                return;
            }

            const levelLink =
                document.querySelector("#navbar-level-link");

            const levelText =
                document.querySelector("#navbar-level-text");

            const progressFill =
                document.querySelector("#navbar-xp-fill");

            if (!levelLink || !levelText || !progressFill) {
                return;
            }

            const xpIntoLevel =
                Math.max(Number(data.xp_into_level ?? 0), 0);

            const xpNeeded =
                Math.max(Number(data.xp_needed_for_level ?? 1), 1);

            const progress =
                Math.min(
                    Math.max(
                        xpIntoLevel / xpNeeded,
                        0
                    ),
                    1
                );

            levelText.textContent =
                `Lv. ${Number(data.level ?? 1)}`;

            progressFill.style.width =
                `${progress * 100}%`;

            levelLink.title =
                `${Number(data.xp ?? 0)} XP total · `
                + `${xpIntoLevel}/${xpNeeded} XP to next level`;

            levelLink.hidden = false;
        } catch (error) {
            console.warn(
                "Level progress could not be loaded:",
                error
            );
        }
    }

    async function showFriendlyModeBanner() {
        if (
            !gamePageFiles.has(currentFile)
            || !window.supabaseClient
        ) {
            return;
        }

        const tableId =
            new URLSearchParams(window.location.search)
                .get("id");

        if (!tableId) {
            return;
        }

        try {
            const {
                data,
                error
            } = await window.supabaseClient
                .from("poker_tables")
                .select("friendly_mode")
                .eq("id", tableId)
                .maybeSingle();

            if (
                error
                || !data?.friendly_mode
                || document.querySelector("#friendly-mode-banner")
            ) {
                return;
            }

            const banner = document.createElement("aside");
            banner.id = "friendly-mode-banner";
            banner.className = "friendly-mode-banner";

            const title = document.createElement("strong");
            title.textContent = "Friendly mode";

            const description = document.createElement("span");
            description.textContent =
                "Practice stacks only. Wallet chips cannot be won or lost, and this game awards no XP.";

            banner.append(title, description);

            const navbar =
                document.querySelector(".shared-site-nav");

            navbar?.insertAdjacentElement(
                "afterend",
                banner
            );
        } catch (error) {
            console.warn(
                "Friendly-mode status could not be loaded:",
                error
            );
        }
    }

    async function updateAdminNavigation() {
        const adminLinks = Array.from(
            document.querySelectorAll(
                '[data-admin-only="true"]'
            )
        );

        if (!adminLinks.length) {
            return;
        }

        adminLinks.forEach((link) => {
            link.hidden = true;
        });

        if (!window.supabaseClient) {
            return;
        }

        try {
            const {
                data: { user },
                error: userError
            } = await window.supabaseClient
                .auth
                .getUser();

            if (userError || !user) {
                return;
            }

            const {
                data: profile,
                error: profileError
            } = await window.supabaseClient
                .from("profiles")
                .select("is_admin")
                .eq("id", user.id)
                .maybeSingle();

            if (profileError) {
                console.warn(
                    "Admin navigation visibility could not be checked:",
                    profileError
                );
                return;
            }

            const showAdmin =
                profile?.is_admin === true;

            adminLinks.forEach((link) => {
                link.hidden = !showAdmin;
            });
        } catch (error) {
            console.warn(
                "Admin navigation visibility could not be checked:",
                error
            );
        }
    }


    function initialiseSharedNavbar() {
        loadUiOverhaulStyles();
        installDropdownDismissHandlers();
        mountNavbar();
        updateAdminNavigation().catch(() => {});
        window.dispatchEvent(new CustomEvent("shared-navbar-mounted"));

        const heartsSafeMode =
            currentFile === "hearts-table.html";

        /*
         * Hearts safe mode deliberately avoids the global profile/cosmetic
         * enhancer and unrelated synchronisation observers. The profile
         * enhancer watches Hearts seats with ResizeObserver and a whole-body
         * MutationObserver; changing the seat count can otherwise cause
         * repeated layout/decorate cycles.
         */
        if (!heartsSafeMode) {
            loadProfileLinkEnhancer();
            loadAchievementSync();
            loadDailyChallengeSync();

            window.addEventListener(
                "daily-challenges-completed",
                loadLevelProgress
            );

            loadFriendRequestCount();
            subscribeToNavbarFriendships();
        }

        loadCardBotSystem();
        loadCardGameGuide();
        loadDesktopNotifications();
        loadPlayerCallSystem();
        loadUiOverhaulScript();
        loadLevelProgress();
        showFriendlyModeBanner();
    }

    /*
        The script is loaded at the end of each page, after the navbar
        mount point exists. Mount immediately so page-specific scripts
        that run next can still find #logout-button.
    */
    initialiseSharedNavbar();
})();
