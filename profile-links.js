(() => {
    const candidateSelector = [
        ".message-author",
        ".leaderboard-player strong",
        "#current-user",
        "[data-profile-username]",
        ".horse-bet-username",
        ".horse-bettor-item strong",
        ".roulette-bet-username",
        ".public-bet-row > div > strong:first-child",
        ".public-bet-username",
        ".bet-username",
        ".bettor-name",
        ".player-username",
        ".player-name",
        ".seat-player-name",
        ".queue-player-name",
        "[data-user-id] [data-username]",
        "[data-user-id] .username"
    ].join(", ");

    function injectStyles() {
        if (document.querySelector("#player-profile-link-styles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "player-profile-link-styles";
        style.textContent = `
            .player-profile-link {
                color: inherit;
                text-decoration: none;
                cursor: pointer;
            }

            .player-profile-link:hover,
            .player-profile-link:focus-visible {
                color: #ffffff;
                text-decoration: underline;
                text-decoration-color: rgba(98, 230, 189, 0.72);
                text-decoration-thickness: 2px;
                text-underline-offset: 0.18em;
                outline: none;
            }

            .player-profile-link .message-author,
            .player-profile-link .leaderboard-player {
                color: inherit;
            }
        `;

        document.head.append(style);
    }

    function cleanUsername(value) {
        return String(value ?? "")
            .trim()
            .replace(/^@/, "");
    }

    function profileHref(element) {
        const userContainer = element.closest("[data-user-id]");
        const userId =
            element.dataset.profileUserId
            || element.dataset.userId
            || userContainer?.dataset.userId
            || null;

        if (userId) {
            return `profile.html?id=${encodeURIComponent(userId)}`;
        }

        const username = cleanUsername(
            element.dataset.profileUsername
            || element.textContent
        );

        if (!username || username === "Loading...") {
            return null;
        }

        return `profile.html?username=${encodeURIComponent(username)}`;
    }

    function linkElement(element) {
        if (
            !(element instanceof HTMLElement)
            || element.dataset.profileLinked === "true"
            || element.closest("a, button")
        ) {
            return;
        }

        const href = profileHref(element);

        if (!href) {
            return;
        }

        const link = document.createElement("a");
        link.href = href;
        link.className = "player-profile-link";
        link.title = `View ${cleanUsername(element.textContent)}'s profile`;

        element.dataset.profileLinked = "true";
        element.parentNode?.insertBefore(link, element);
        link.append(element);
    }

    function enhanceProfileLinks(root = document) {
        if (root instanceof HTMLElement && root.matches(candidateSelector)) {
            linkElement(root);
        }

        root
            .querySelectorAll?.(candidateSelector)
            .forEach(linkElement);
    }

    injectStyles();
    enhanceProfileLinks();

    const observer = new MutationObserver((records) => {
        for (const record of records) {
            if (record.target instanceof HTMLElement) {
                enhanceProfileLinks(record.target);
            }

            for (const node of record.addedNodes) {
                if (node instanceof HTMLElement) {
                    enhanceProfileLinks(node);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
