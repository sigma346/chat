(() => {
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
        "solitaire-table.html"
    ]);

    const navigationItems = [
        {
            label: "Chat",
            href: "index.html",
            files: ["index.html", ""]
        },
        {
            label: "Games",
            href: "poker.html",
            files: [
                "poker.html",
                ...gamePageFiles
            ]
        },
        {
            label: "Horse Race",
            href: "horse-racing.html",
            files: ["horse-racing.html"]
        },
        {
            label: "Roulette",
            href: "community-roulette.html",
            files: ["community-roulette.html"]
        },
        {
            label: "Penguin Cross",
            href: "penguin-cross.html",
            files: ["penguin-cross.html"]
        },
        {
            label: "Leaderboards",
            href: "leaderboards.html",
            files: ["leaderboards.html"]
        },
        {
            label: "Donate",
            href: "donate.html",
            files: ["donate.html"]
        },
        {
            label: "Recovery",
            href: "recovery.html",
            files: ["recovery.html"]
        },
        {
            label: "Plinko",
            href: "plinko.html",
            files: ["plinko.html"]
        },
        {
            label: "Account",
            href: "account.html",
            files: ["account.html"]
        },
        {
            label: "Disclaimer",
            href: "disclaimer.html",
            files: ["disclaimer.html"]
        }
    ];

    function buildNavbar() {
        const navbar = document.createElement("nav");
        navbar.className = "site-nav shared-site-nav";
        navbar.setAttribute("aria-label", "Main navigation");

        const links = document.createElement("div");
        links.className = "site-nav-links";

        for (const item of navigationItems) {
            const link = document.createElement("a");
            link.href = item.href;
            link.className = "nav-link";
            link.textContent = item.label;

            if (item.files.includes(currentFile)) {
                link.classList.add("active");
                link.setAttribute("aria-current", "page");
            }

            links.append(link);
        }

        const accountControls = document.createElement("div");
        accountControls.className = "site-nav-account";

        const levelLink = document.createElement("a");
        levelLink.id = "navbar-level-link";
        levelLink.className = "navbar-level-link";
        levelLink.href = "account.html";
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

        accountControls.append(levelLink, logoutButton);
        navbar.append(links, accountControls);

        return navbar;
    }

    function navbarMountTarget() {
        return document.querySelector("#site-navbar");
    }

    function pageLayout() {
        return document.querySelector(
            ".poker-layout, .plinko-layout, .recovery-layout, "
            + ".draw-layout, .hearts-layout, .blackjack-layout, "
            + ".disclaimer-layout, .horse-racing-layout, "
            + ".community-roulette-layout, .penguin-cross-layout, .leaderboards-layout, "
            + ".donation-layout"
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

    function initialiseSharedNavbar() {
        mountNavbar();
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
