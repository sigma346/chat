(() => {
    const currentFile =
        window.location.pathname
            .split("/")
            .pop()
        || "index.html";

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
                "poker-table.html",
                "blackjack-table.html"
            ]
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
        }
    ];

    function buildNavbar() {
        const navbar = document.createElement("nav");
        navbar.className = "site-nav";
        navbar.setAttribute("aria-label", "Main navigation");

        for (const item of navigationItems) {
            const link = document.createElement("a");
            link.href = item.href;
            link.className = "nav-link";
            link.textContent = item.label;

            if (item.files.includes(currentFile)) {
                link.classList.add("active");
                link.setAttribute("aria-current", "page");
            }

            navbar.append(link);
        }

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

        navbar.append(logoutButton);

        return navbar;
    }

    function mountNavbar() {
        const navbar = buildNavbar();
        const mount = document.querySelector("#site-navbar");

        // Remove old copied navbars. Existing pages can be
        // migrated gradually without displaying two navbars.
        document
            .querySelectorAll(".site-nav")
            .forEach((oldNavbar) => oldNavbar.remove());

        if (mount) {
            mount.replaceWith(navbar);
            return;
        }

        const layout =
            document.querySelector(
                ".poker-layout, .plinko-layout, .recovery-layout"
            )
            || document.querySelector("main > div")
            || document.querySelector("main")
            || document.body;

        layout.prepend(navbar);
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            mountNavbar,
            { once: true }
        );
    } else {
        mountNavbar();
    }
})();
