(() => {
    if (window.__playerCosmeticEnhancerLoaded) {
        return;
    }

    window.__playerCosmeticEnhancerLoaded = true;

    const badgeSymbols = {
        badge_ace: "♠",
        badge_penguin: "🐧",
        badge_dice: "⚄",
        badge_crown: "♛",
        badge_admin_shield: "🛡",
        badge_daily_challenger: "✓",
        badge_easy_going: "★",
        badge_busy_day: "⚡",
        badge_handshake: "🤝",
        badge_club_founder: "⚑",
        badge_slot_spinner: "🎰",
        badge_rr_survivor: "☠",
        badge_first_trade: "↗",
        badge_bull_market: "▲",
        badge_crypto_pioneer: "₿",
        badge_crypto_bull: "◆"
    };

    const richPlayerCards = [
        {
            cardSelector: ".live-player-seat:not(.empty-live-seat)",
            headingSelector: ".live-seat-heading",
            nameSelector: ".live-seat-heading strong"
        },
        {
            cardSelector: ".blackjack-player-card",
            headingSelector: ".blackjack-player-heading",
            nameSelector: ".blackjack-player-heading strong"
        },
        {
            cardSelector: ".draw-player-seat",
            headingSelector: ".draw-seat-heading",
            nameSelector: ".draw-seat-heading > strong"
        },
        {
            cardSelector: ".hearts-player-seat",
            headingSelector: ".hearts-seat-heading",
            nameSelector: ".hearts-seat-heading > strong"
        },
        {
            cardSelector: ".player-card[data-user-id], .player-seat[data-user-id]",
            headingSelector: ".player-heading, .seat-heading, .player-nameplate",
            nameSelector: ".player-name, .player-username, [data-profile-username]"
        }
    ];

    const mediumNameConfigurations = [
        {
            selector: ".leaderboard-player strong",
            showTitle: true,
            showBadge: true
        },
        {
            selector: ".horse-bettor-item strong",
            showTitle: false,
            showBadge: true
        },
        {
            selector: ".public-bet-row > div > strong:first-child",
            showTitle: false,
            showBadge: true
        },
        {
            selector: ".hearts-score-chip > span:first-child",
            showTitle: false,
            showBadge: true
        },
        {
            selector: ".message-author",
            showTitle: false,
            showBadge: true
        }
    ];

    const compactNameSelectors = [
        "#current-user",
        "#current-username",
        ".player-username",
        ".player-name",
        ".seat-player-name",
        ".queue-player-name",
        ".trick-card-item > span:last-child",
        "#action-history li > strong",
        ".action-history li > strong",
        "[data-profile-username]",
        "[data-user-id] [data-username]",
        "[data-user-id] .username"
    ].join(", ");

    const splitTextChipSelectors = [
        ".blackjack-queue-chip",
        ".queue-player-chip"
    ].join(", ");

    const profilePromises = new Map();
    const requestQueue = [];
    let runningRequests = 0;
    const maximumConcurrentRequests = 4;

    const richCardResizeObserver =
        typeof ResizeObserver === "function"
            ? new ResizeObserver(() => {
                scheduleRichCardDensityRefresh();
            })
            : null;

    let densityRefreshFrame = 0;

    function richCardsInGroup(card) {
        const parent = card.parentElement;

        if (!parent) {
            return [card];
        }

        return Array.from(
            parent.querySelectorAll(
                ":scope > .cosmetic-rich-player-card"
            )
        ).filter((candidate) => !candidate.hidden);
    }

    function densityForCard(card, groupCount) {
        const width = card.getBoundingClientRect().width;

        if (
            groupCount >= 7
            || (width > 0 && width < 145)
        ) {
            return "minimal";
        }

        if (
            groupCount >= 4
            || (width > 0 && width < 215)
        ) {
            return "compact";
        }

        return "full";
    }

    function updateRichCardDensities() {
        const cards = Array.from(
            document.querySelectorAll(
                ".cosmetic-rich-player-card"
            )
        );

        const visitedParents = new Set();

        for (const card of cards) {
            const parent = card.parentElement;

            if (!parent || visitedParents.has(parent)) {
                continue;
            }

            visitedParents.add(parent);

            const group = richCardsInGroup(card);
            const groupCount = group.length;

            parent.classList.toggle(
                "cosmetic-five-player-grid",
                parent.classList.contains("draw-player-grid")
                    && groupCount === 5
            );

            for (const groupedCard of group) {
                const density = densityForCard(
                    groupedCard,
                    groupCount
                );

                groupedCard.classList.toggle(
                    "cosmetic-density-compact",
                    density === "compact"
                );

                groupedCard.classList.toggle(
                    "cosmetic-density-minimal",
                    density === "minimal"
                );

                groupedCard.classList.toggle(
                    "cosmetic-density-full",
                    density === "full"
                );

                richCardResizeObserver?.observe(groupedCard);
            }

            richCardResizeObserver?.observe(parent);
        }
    }

    function scheduleRichCardDensityRefresh() {
        if (densityRefreshFrame) {
            return;
        }

        densityRefreshFrame = window.requestAnimationFrame(() => {
            densityRefreshFrame = 0;
            updateRichCardDensities();
        });
    }

    function injectStyles() {
        if (document.querySelector("#player-cosmetic-presence-styles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "player-cosmetic-presence-styles";
        style.textContent = `
            .player-profile-link {
                color: inherit;
                text-decoration: none;
                cursor: pointer;
                border-radius: 0.28rem;
                outline-offset: 3px;
            }

            .player-profile-link:hover,
            .player-profile-link:focus-visible {
                color: #ffffff;
                text-decoration: underline;
                text-decoration-color: rgba(98, 230, 189, 0.78);
                text-decoration-thickness: 2px;
                text-underline-offset: 0.18em;
            }

            .cosmetic-rich-player-card {
                --player-theme-accent: rgba(98, 230, 189, 0.52);
                --player-theme-soft: rgba(98, 230, 189, 0.09);
                --player-theme-surface: rgba(11, 18, 28, 0.78);
                border-color: color-mix(
                    in srgb,
                    var(--player-theme-accent) 46%,
                    rgba(148, 163, 184, 0.24)
                ) !important;
                box-shadow:
                    inset 3px 0 0 var(--player-theme-accent),
                    0 10px 24px rgba(0, 0, 0, 0.14);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_ocean"] {
                --player-theme-accent: rgba(77, 178, 255, 0.72);
                --player-theme-soft: rgba(77, 178, 255, 0.13);
                --player-theme-surface: rgba(8, 30, 48, 0.82);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_crimson"] {
                --player-theme-accent: rgba(255, 78, 111, 0.7);
                --player-theme-soft: rgba(255, 78, 111, 0.12);
                --player-theme-surface: rgba(48, 15, 26, 0.82);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_aurora"] {
                --player-theme-accent: rgba(125, 220, 210, 0.76);
                --player-theme-soft: rgba(135, 116, 255, 0.12);
                --player-theme-surface: rgba(20, 20, 48, 0.82);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_royal_felt"] {
                --player-theme-accent: rgba(240, 202, 87, 0.82);
                --player-theme-soft: rgba(34, 150, 101, 0.17);
                --player-theme-surface: rgba(8, 43, 31, 0.88);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_frozen_crossing"] {
                --player-theme-accent: rgba(174, 237, 255, 0.86);
                --player-theme-soft: rgba(73, 179, 222, 0.17);
                --player-theme-surface: rgba(8, 35, 54, 0.88);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_midnight_web"] {
                --player-theme-accent: rgba(190, 145, 255, 0.8);
                --player-theme-soft: rgba(117, 71, 210, 0.18);
                --player-theme-surface: rgba(19, 12, 39, 0.9);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_moonshot"] {
                --player-theme-accent: rgba(214, 228, 250, 0.84);
                --player-theme-soft: rgba(100, 139, 201, 0.17);
                --player-theme-surface: rgba(13, 27, 50, 0.9);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_crimson_trick"] {
                --player-theme-accent: rgba(255, 104, 137, 0.82);
                --player-theme-soft: rgba(185, 37, 76, 0.18);
                --player-theme-surface: rgba(55, 10, 25, 0.9);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_casino_neon"] {
                --player-theme-accent: rgba(61, 225, 255, 0.84);
                --player-theme-soft: rgba(255, 58, 191, 0.15);
                --player-theme-surface: rgba(20, 14, 43, 0.9);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_high_stakes"] {
                --player-theme-accent: rgba(244, 198, 80, 0.86);
                --player-theme-soft: rgba(180, 31, 52, 0.16);
                --player-theme-surface: rgba(33, 9, 13, 0.92);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_vault"] {
                --player-theme-accent: rgba(232, 201, 99, 0.86);
                --player-theme-soft: rgba(28, 151, 102, 0.18);
                --player-theme-surface: rgba(8, 42, 29, 0.9);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_challenge_master"] {
                --player-theme-accent: rgba(115, 211, 255, 0.88);
                --player-theme-soft: rgba(117, 91, 235, 0.2);
                --player-theme-surface: rgba(14, 18, 51, 0.92);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_triple_crown"] {
                --player-theme-accent: rgba(255, 216, 101, 0.9);
                --player-theme-soft: rgba(75, 211, 185, 0.18);
                --player-theme-surface: rgba(31, 20, 51, 0.92);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_clubhouse"] {
                --player-theme-accent: rgba(255, 132, 149, 0.92);
                --player-theme-soft: rgba(95, 164, 255, 0.2);
                --player-theme-surface: rgba(31, 24, 68, 0.94);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_cosmic_jackpot"] {
                --player-theme-accent: rgba(127, 232, 255, 0.9);
                --player-theme-soft: rgba(206, 82, 255, 0.19);
                --player-theme-surface: rgba(22, 14, 57, 0.93);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_chamber_champion"] {
                --player-theme-accent: rgba(238, 75, 94, 0.9);
                --player-theme-soft: rgba(190, 38, 61, 0.18);
                --player-theme-surface: rgba(35, 13, 18, 0.94);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_exchange_floor"] {
                --player-theme-accent: rgba(102, 233, 192, 0.9);
                --player-theme-soft: rgba(241, 197, 82, 0.17);
                --player-theme-surface: rgba(7, 45, 41, 0.93);
            }

            .cosmetic-rich-player-card[data-player-theme="theme_blockchain_grid"] {
                --player-theme-accent: rgba(57, 232, 255, 0.92);
                --player-theme-soft: rgba(181, 74, 255, 0.2);
                --player-theme-surface: rgba(7, 12, 39, 0.94);
            }

            .cosmetic-rich-player-card.admin-player-card {
                --player-theme-accent: rgba(248, 214, 109, 0.82);
                --player-theme-soft: rgba(248, 214, 109, 0.12);
            }

            .cosmetic-nameplate {
                position: relative;
                isolation: isolate;
                display: grid !important;
                grid-template-columns: auto minmax(0, 1fr) auto;
                align-items: center !important;
                gap: 0.62rem !important;
                width: 100%;
                min-width: 0;
                padding: 0.52rem 0.58rem !important;
                border: 1px solid rgba(148, 163, 184, 0.13);
                border-radius: 0.74rem;
                overflow: hidden;
            }

            .cosmetic-nameplate::before {
                content: "";
                position: absolute;
                inset: 0;
                z-index: -1;
                background:
                    linear-gradient(
                        115deg,
                        var(--player-theme-soft),
                        transparent 66%
                    ),
                    var(--player-theme-surface);
                pointer-events: none;
            }

            .cosmetic-nameplate[data-player-theme="theme_aurora"]::before {
                background:
                    radial-gradient(
                        circle at 12% 18%,
                        rgba(94, 234, 212, 0.17),
                        transparent 42%
                    ),
                    radial-gradient(
                        circle at 88% 75%,
                        rgba(167, 139, 250, 0.16),
                        transparent 45%
                    ),
                    var(--player-theme-surface);
            }

            .cosmetic-identity-copy {
                min-width: 0;
                display: grid;
                align-content: center;
                gap: 0.12rem;
            }

            .cosmetic-player-name-row {
                min-width: 0;
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 0.34rem;
            }

            .cosmetic-player-name-row .player-profile-link {
                min-width: 0;
                overflow-wrap: anywhere;
                font-weight: 800;
            }

            .cosmetic-player-title {
                display: block;
                max-width: 100%;
                overflow: hidden;
                color: color-mix(
                    in srgb,
                    var(--player-theme-accent) 78%,
                    #ffffff
                );
                font-size: 0.68rem;
                font-weight: 800;
                letter-spacing: 0.055em;
                line-height: 1.2;
                text-overflow: ellipsis;
                text-transform: uppercase;
                white-space: nowrap;
            }

            .cosmetic-player-badge {
                display: inline-grid;
                place-items: center;
                flex: 0 0 auto;
                min-width: 1.42rem;
                height: 1.42rem;
                padding: 0 0.3rem;
                border: 1px solid rgba(255, 255, 255, 0.17);
                border-radius: 999px;
                background: rgba(8, 13, 22, 0.78);
                color: #f8fafc;
                font-size: 0.82rem;
                line-height: 1;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
                vertical-align: middle;
            }

            .cosmetic-player-badge.admin-badge {
                border-color: rgba(248, 214, 109, 0.48);
                background: rgba(93, 65, 12, 0.7);
                color: #fff2af;
            }

            .cosmetic-inline-identity-row {
                display: inline-flex;
                align-items: center;
                justify-content: flex-start;
                gap: 0.34rem;
                width: max-content;
                max-width: 100%;
                min-width: 0;
                justify-self: start;
                align-self: center;
                vertical-align: middle;
                white-space: nowrap;
            }

            .cosmetic-inline-identity-row > .player-profile-link {
                display: inline-block;
                min-width: 0;
                max-width: min(18rem, 100%);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                vertical-align: middle;
            }

            .cosmetic-inline-badge {
                display: inline-grid !important;
                flex: 0 0 auto !important;
                width: max-content !important;
                min-width: 1.28rem !important;
                max-width: max-content !important;
                height: 1.28rem !important;
                padding: 0 0.27rem !important;
                justify-self: start !important;
                align-self: center !important;
                vertical-align: middle;
            }

            .cosmetic-inline-identity-row .cosmetic-inline-title {
                flex: 0 1 auto;
                min-width: 0;
                margin-left: 0;
                vertical-align: middle;
            }

            .cosmetic-inline-title {
                display: inline-block;
                max-width: 10rem;
                margin-left: 0;
                overflow: hidden;
                color: #93a4ba;
                font-size: 0.72rem;
                font-weight: 700;
                line-height: 1.2;
                text-overflow: ellipsis;
                text-transform: uppercase;
                vertical-align: middle;
                white-space: nowrap;
            }

            .cosmetic-inline-badge {
                margin-left: 0.32rem;
                transform: translateY(-0.02rem);
            }

            .game-profile-avatar-frame {
                position: relative;
                display: grid;
                place-items: center;
                flex: 0 0 auto;
                width: 2.55rem;
                height: 2.55rem;
                padding: 2px;
                border: 2px solid rgba(148, 163, 184, 0.38);
                border-radius: 0.78rem;
                background: rgba(8, 13, 22, 0.76);
                box-shadow: 0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .game-profile-avatar {
                display: grid;
                place-items: center;
                width: 100%;
                height: 100%;
                overflow: hidden;
                border-radius: 0.57rem;
                background:
                    linear-gradient(
                        145deg,
                        var(--player-theme-soft),
                        rgba(255, 255, 255, 0.025)
                    ),
                    #151d2a;
                color: #f8fafc;
                font-size: 0.82rem;
                font-weight: 900;
                letter-spacing: 0.035em;
            }

            .game-profile-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .game-profile-avatar-frame[data-player-frame="frame_bronze"] {
                border-color: #c6894d;
                background: linear-gradient(145deg, #d39a5a, #6f3c1f);
            }

            .game-profile-avatar-frame[data-player-frame="frame_neon"] {
                border-color: #6ee7ff;
                box-shadow:
                    0 0 0 2px rgba(110, 231, 255, 0.14),
                    0 0 16px rgba(110, 231, 255, 0.32),
                    0 7px 18px rgba(0, 0, 0, 0.22);
                animation: cosmetic-neon-frame-pulse 2.1s ease-in-out infinite;
            }

            .game-profile-avatar-frame[data-player-frame="frame_frost"] {
                border-color: #dff7ff;
                background:
                    linear-gradient(145deg, #dff7ff, #52a8d4 48%, #173b5f);
            }

            .game-profile-avatar-frame[data-player-frame="frame_royal"] {
                border-color: #f8d66d;
                background:
                    linear-gradient(145deg, #fff1a8, #c89225 52%, #6f4307);
                box-shadow:
                    0 0 0 2px rgba(248, 214, 109, 0.13),
                    0 8px 20px rgba(111, 67, 7, 0.34);
            }

            .game-profile-avatar-frame[data-player-frame="frame_wanderer"] {
                border-color: #66d5c8;
                background:
                    conic-gradient(
                        from 45deg,
                        #286d69,
                        #d8b766,
                        #286d69,
                        #d8b766,
                        #286d69
                    );
            }

            .game-profile-avatar-frame[data-player-frame="frame_bronze_edge"] {
                border-color: #d59656;
                background:
                    linear-gradient(145deg, #f0bd76, #9a5e2e 48%, #4f2b17);
            }

            .game-profile-avatar-frame[data-player-frame="frame_silver_pulse"] {
                border-color: #e6edf7;
                background:
                    linear-gradient(145deg, #f8fbff, #8c9bae 48%, #303946);
                box-shadow:
                    0 0 0 2px rgba(220, 231, 244, 0.14),
                    0 0 16px rgba(183, 207, 235, 0.32),
                    0 7px 18px rgba(0, 0, 0, 0.22);
                animation:
                    cosmetic-achievement-silver-pulse
                    2.4s ease-in-out infinite;
            }

            .game-profile-avatar-frame[data-player-frame="frame_royal_prestige"] {
                border-color: #ffd86f;
                background:
                    conic-gradient(
                        from 30deg,
                        #6d3fb4,
                        #ffe08a,
                        #8c55d5,
                        #d7a937,
                        #6d3fb4
                    );
                box-shadow:
                    0 0 0 2px rgba(255, 216, 111, 0.15),
                    0 0 16px rgba(132, 77, 202, 0.28),
                    0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .game-profile-avatar-frame[data-player-frame="frame_hot_streak"] {
                border-color: #ffb34f;
                background:
                    linear-gradient(145deg, #ffd36b, #ef612f 48%, #8b1725);
                box-shadow:
                    0 0 16px rgba(255, 99, 51, 0.32),
                    0 7px 18px rgba(0, 0, 0, 0.22);
                animation:
                    cosmetic-achievement-fire-pulse
                    1.7s ease-in-out infinite;
            }

            .game-profile-avatar-frame[data-player-frame="frame_classic_felt"] {
                border-color: #e3c66d;
                background:
                    linear-gradient(145deg, #e3c66d, #177050 48%, #083626);
            }

            .game-profile-avatar-frame[data-player-frame="frame_speedrun"] {
                border-color: #72e8ff;
                background:
                    linear-gradient(
                        125deg,
                        #d6f9ff 0 18%,
                        #45d5f2 19% 42%,
                        #1d75cf 43% 68%,
                        #102849 69%
                    );
                box-shadow:
                    0 0 15px rgba(69, 213, 242, 0.3),
                    0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .game-profile-avatar-frame[data-player-frame="frame_webbed_gold"] {
                border-color: #f2cf62;
                background:
                    repeating-radial-gradient(
                        circle at 50% 50%,
                        #efcf6d 0 1px,
                        #171716 1px 5px
                    );
            }

            .game-profile-avatar-frame[data-player-frame="frame_frost_trail"] {
                border-color: #e1faff;
                background:
                    linear-gradient(
                        145deg,
                        #f2fdff,
                        #70d8ee 42%,
                        #2e78af 68%,
                        #173750
                    );
                box-shadow:
                    0 0 14px rgba(83, 197, 229, 0.3),
                    0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .game-profile-avatar-frame[data-player-frame="frame_five_card_flame"] {
                border-color: #ffc45d;
                background:
                    conic-gradient(
                        from 190deg,
                        #7d1221,
                        #f14c28,
                        #ffd067,
                        #e43a25,
                        #7d1221
                    );
            }

            .game-profile-avatar-frame[data-player-frame="frame_challenge_chain"] {
                border-color: #73d9d0;
                background:
                    repeating-linear-gradient(
                        135deg,
                        #193b4c 0 5px,
                        #79ddd0 5px 8px,
                        #293060 8px 13px
                    );
                box-shadow:
                    0 0 0 2px rgba(115, 217, 208, 0.13),
                    0 0 15px rgba(100, 185, 230, 0.26),
                    0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .game-profile-avatar-frame[data-player-frame="frame_hard_mode"] {
                border-color: #ff6f89;
                background:
                    conic-gradient(
                        from 45deg,
                        #170d17,
                        #a41e3f,
                        #ff8b62,
                        #3f1026,
                        #170d17
                    );
                box-shadow:
                    0 0 16px rgba(235, 69, 102, 0.3),
                    0 7px 18px rgba(0, 0, 0, 0.24);
            }

            .game-profile-avatar-frame[data-player-frame="frame_challenge_marathon"] {
                border-color: #9bbdff;
                background:
                    conic-gradient(
                        from 0deg,
                        #16284d,
                        #63d6ef,
                        #8b69df,
                        #f2c76d,
                        #16284d
                    );
                box-shadow:
                    0 0 0 2px rgba(155, 189, 255, 0.14),
                    0 0 18px rgba(125, 115, 226, 0.3),
                    0 7px 18px rgba(0, 0, 0, 0.22);
                animation:
                    cosmetic-challenge-marathon-pulse
                    2.3s ease-in-out infinite;
            }

            .game-profile-avatar-frame[data-player-frame="frame_inner_circle"] {
                border-color: #ffc972;
                background:
                    conic-gradient(
                        from 20deg,
                        #f6d889,
                        #d36c8c,
                        #7253ba,
                        #55bca7,
                        #f6d889
                    );
                box-shadow:
                    0 0 0 2px rgba(255, 201, 114, 0.14),
                    0 0 16px rgba(211, 108, 140, 0.27),
                    0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .game-profile-avatar-frame[data-player-frame="frame_reel_runner"] {
                border-color: #ffdd61;
                background:
                    repeating-linear-gradient(
                        90deg,
                        #ef405d 0 5px,
                        #ffd85a 5px 10px,
                        #34d9cf 10px 15px,
                        #342663 15px 20px
                    );
                box-shadow:
                    0 0 0 2px rgba(255, 221, 97, 0.13),
                    0 0 16px rgba(52, 217, 207, 0.27),
                    0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .game-profile-avatar-frame[data-player-frame="frame_steel_nerve"] {
                border-color: #e4e8ed;
                background:
                    conic-gradient(
                        from 0deg,
                        #22272e,
                        #c7d0d8,
                        #671f2a,
                        #eef2f5,
                        #22272e
                    );
                box-shadow:
                    0 0 0 2px rgba(228, 232, 237, 0.13),
                    0 0 16px rgba(198, 33, 56, 0.26),
                    0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .game-profile-avatar-frame[data-player-frame="frame_market_maker"] {
                border-color: #7af2c7;
                background:
                    linear-gradient(
                        130deg,
                        #153b37 0 22%,
                        #63e0b8 23% 40%,
                        #f2c85e 41% 54%,
                        #1e5f58 55% 78%,
                        #0c2826 79%
                    );
                box-shadow:
                    0 0 0 2px rgba(122, 242, 199, 0.13),
                    0 0 16px rgba(57, 210, 160, 0.27),
                    0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .game-profile-avatar-frame[data-player-frame="frame_new_frontier"] {
                border-color: #d8e6ff;
                background:
                    conic-gradient(
                        from 35deg,
                        #59e1bd,
                        #5fa7ff,
                        #b676f3,
                        #f2c85e,
                        #f26d77,
                        #59e1bd
                    );
                box-shadow:
                    0 0 0 2px rgba(216, 230, 255, 0.15),
                    0 0 19px rgba(114, 130, 245, 0.34),
                    0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .game-profile-avatar-frame[data-player-frame="frame_hash_chain"] {
                border-color: #43e4ff;
                background:
                    repeating-conic-gradient(
                        #43e4ff 0 10deg,
                        #5423a6 10deg 20deg,
                        #0a1736 20deg 30deg
                    );
                box-shadow:
                    0 0 0 2px rgba(67, 228, 255, 0.14),
                    0 0 18px rgba(145, 67, 255, 0.34),
                    0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .game-profile-avatar-frame[data-player-frame="frame_diamond_hands"] {
                border-color: #d8fbff;
                background:
                    conic-gradient(
                        from 22deg,
                        #ffffff,
                        #65e7ff,
                        #7d78ff,
                        #d67cff,
                        #ffffff
                    );
                box-shadow:
                    inset 0 0 0 1px rgba(255, 255, 255, 0.35),
                    0 0 20px rgba(103, 224, 255, 0.42),
                    0 7px 18px rgba(0, 0, 0, 0.22);
            }

            .profile-enhanced-text-chip {
                display: inline-flex !important;
                align-items: center;
                flex-wrap: wrap;
                gap: 0.24rem;
            }

            @keyframes cosmetic-challenge-marathon-pulse {
                0%,
                100% {
                    filter: saturate(0.9);
                    transform: translateZ(0) scale(1);
                }

                50% {
                    filter: saturate(1.3);
                    transform: translateZ(0) scale(1.035);
                }
            }

            @keyframes cosmetic-achievement-silver-pulse {
                0%,
                100% {
                    box-shadow:
                        0 0 0 2px rgba(220, 231, 244, 0.12),
                        0 0 12px rgba(183, 207, 235, 0.22),
                        0 7px 18px rgba(0, 0, 0, 0.22);
                }

                50% {
                    box-shadow:
                        0 0 0 2px rgba(230, 239, 250, 0.22),
                        0 0 21px rgba(183, 207, 235, 0.44),
                        0 7px 18px rgba(0, 0, 0, 0.22);
                }
            }

            @keyframes cosmetic-achievement-fire-pulse {
                0%,
                100% {
                    filter: saturate(0.95);
                }

                50% {
                    filter: saturate(1.28);
                }
            }

            @keyframes cosmetic-neon-frame-pulse {
                0%, 100% {
                    box-shadow:
                        0 0 0 2px rgba(110, 231, 255, 0.12),
                        0 0 11px rgba(110, 231, 255, 0.22),
                        0 7px 18px rgba(0, 0, 0, 0.22);
                }

                50% {
                    box-shadow:
                        0 0 0 2px rgba(110, 231, 255, 0.22),
                        0 0 21px rgba(110, 231, 255, 0.42),
                        0 7px 18px rgba(0, 0, 0, 0.22);
                }
            }


            /*
             * Player cosmetics become progressively simpler as more seats
             * share the table. The theme and badge remain visible, while
             * titles and large avatars stop trying to occupy half a postcode.
             */
            .cosmetic-rich-player-card.cosmetic-density-compact {
                gap: 6px !important;
                padding: 9px !important;
            }

            .cosmetic-density-compact .cosmetic-nameplate {
                grid-template-columns: auto minmax(0, 1fr) auto;
                gap: 0.38rem !important;
                min-height: 2.75rem;
                padding: 0.34rem 0.4rem !important;
                border-radius: 0.62rem;
            }

            .cosmetic-density-compact .game-profile-avatar-frame {
                width: 2rem;
                height: 2rem;
                border-width: 1px;
                border-radius: 0.58rem;
            }

            .cosmetic-density-compact .game-profile-avatar {
                border-radius: 0.43rem;
                font-size: 0.66rem;
            }

            .cosmetic-density-compact .cosmetic-identity-copy {
                display: block;
                min-width: 0;
            }

            .cosmetic-density-compact .cosmetic-player-name-row {
                flex-wrap: nowrap;
                min-width: 0;
                gap: 0.22rem;
            }

            .cosmetic-density-compact
            .cosmetic-player-name-row
            .player-profile-link {
                display: block;
                min-width: 0;
                max-width: 100%;
                overflow: hidden;
                overflow-wrap: normal !important;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .cosmetic-density-compact .cosmetic-player-title {
                display: none;
            }

            .cosmetic-density-compact .cosmetic-player-badge {
                min-width: 1.18rem;
                height: 1.18rem;
                padding: 0 0.18rem;
                font-size: 0.65rem;
            }

            .cosmetic-density-compact .poker-badge,
            .cosmetic-density-compact .draw-badge,
            .cosmetic-density-compact .blackjack-badge,
            .cosmetic-density-compact .hearts-badge {
                padding: 0.22rem 0.34rem;
                font-size: 0.55rem;
            }

            .cosmetic-density-minimal .cosmetic-nameplate {
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 0.25rem !important;
                min-height: 2.25rem;
                padding: 0.3rem 0.34rem !important;
            }

            .cosmetic-density-minimal
            .game-profile-avatar-frame {
                display: none;
            }

            .cosmetic-density-minimal
            .cosmetic-player-title {
                display: none;
            }

            .cosmetic-density-minimal
            .cosmetic-player-name-row {
                flex-wrap: nowrap;
                min-width: 0;
            }

            .cosmetic-density-minimal
            .cosmetic-player-name-row
            .player-profile-link {
                display: block;
                min-width: 0;
                overflow: hidden;
                overflow-wrap: normal !important;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .cosmetic-density-minimal .cosmetic-player-badge {
                min-width: 1.05rem;
                height: 1.05rem;
                padding: 0 0.14rem;
                font-size: 0.58rem;
            }

            .cosmetic-density-minimal.cosmetic-rich-player-card {
                padding: 7px !important;
            }

            /*
             * Five-Card Draw can fit five sensible compact seats across on
             * desktop. The original auto-fit grid chose four, leaving one
             * player stranded on a second row like an unpopular dinner guest.
             */
            @media (min-width: 880px) {
                .draw-player-grid.cosmetic-five-player-grid {
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                    gap: 8px;
                }

                .draw-player-grid.cosmetic-five-player-grid
                .draw-player-seat {
                    padding: 9px;
                }

                .draw-player-grid.cosmetic-five-player-grid
                .draw-mini-cards {
                    gap: 3px;
                }

                .draw-player-grid.cosmetic-five-player-grid
                .draw-mini-card {
                    width: clamp(21px, 2.15vw, 25px);
                }

                .draw-player-grid.cosmetic-five-player-grid
                .draw-seat-details {
                    gap: 4px;
                    font-size: 0.66rem;
                }
            }

            @media (max-width: 480px) {
                .cosmetic-inline-identity-row .cosmetic-inline-title {
                    display: none;
                }
            }

            @media (max-width: 620px) {
                .cosmetic-nameplate {
                    grid-template-columns: auto minmax(0, 1fr);
                }

                .cosmetic-nameplate > .poker-badge-row,
                .cosmetic-nameplate > .blackjack-badges {
                    grid-column: 1 / -1;
                }

                .game-profile-avatar-frame {
                    width: 2.25rem;
                    height: 2.25rem;
                }

                .cosmetic-inline-title {
                    display: none;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .game-profile-avatar-frame[data-player-frame="frame_neon"],
                .game-profile-avatar-frame[data-player-frame="frame_silver_pulse"],
                .game-profile-avatar-frame[data-player-frame="frame_hot_streak"],
                .game-profile-avatar-frame[data-player-frame="frame_challenge_marathon"] {
                    animation: none;
                }
            }
        `;

        document.head.append(style);
    }

    function cleanUsername(value) {
        return String(value ?? "")
            .replace(/^@/, "")
            .trim();
    }

    function initialsFromUsername(username) {
        const parts = cleanUsername(username)
            .replaceAll("_", " ")
            .split(/\s+/)
            .filter(Boolean);

        if (!parts.length) {
            return "?";
        }

        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }

        return `${parts[0][0]}${parts[parts.length - 1][0]}`
            .toUpperCase();
    }

    function badgeSymbol(profile) {
        return badgeSymbols[profile?.badge?.id] ?? "";
    }

    function identityFromElement(element) {
        const userContainer = element.closest("[data-user-id]");
        const userId =
            element.dataset.profileUserId
            || element.dataset.userId
            || userContainer?.dataset.userId
            || null;

        const username = cleanUsername(
            element.dataset.profileUsername
            || element.dataset.username
            || element.textContent
        );

        if (!userId && (!username || username === "Loading...")) {
            return null;
        }

        return {
            userId,
            username
        };
    }

    function profileCacheKey(identity) {
        return identity.userId
            ? `id:${identity.userId}`
            : `username:${identity.username.toLocaleLowerCase()}`;
    }

    function profileHref(identity, profile = null) {
        const userId = profile?.id || identity.userId;

        if (userId) {
            return `profile.html?id=${encodeURIComponent(userId)}`;
        }

        return `profile.html?username=${encodeURIComponent(identity.username)}`;
    }

    function drainRequestQueue() {
        while (
            runningRequests < maximumConcurrentRequests
            && requestQueue.length > 0
        ) {
            const task = requestQueue.shift();
            runningRequests += 1;

            task.run()
                .then(task.resolve, task.resolve)
                .finally(() => {
                    runningRequests -= 1;
                    drainRequestQueue();
                });
        }
    }

    function loadProfile(identity) {
        if (!identity || !window.supabaseClient) {
            return Promise.resolve(null);
        }

        const key = profileCacheKey(identity);

        if (profilePromises.has(key)) {
            return profilePromises.get(key);
        }

        const promise = new Promise((resolve) => {
            requestQueue.push({
                resolve,
                run: async () => {
                    try {
                        const { data, error } =
                            await window.supabaseClient.rpc(
                                "get_public_player_profile",
                                {
                                    p_user_id: identity.userId || null,
                                    p_username: identity.userId
                                        ? null
                                        : identity.username
                                }
                            );

                        if (error) {
                            throw error;
                        }

                        return data ?? null;
                    } catch (error) {
                        console.warn(
                            `Could not load cosmetics for ${identity.username}:`,
                            error
                        );

                        return null;
                    }
                }
            });

            drainRequestQueue();
        });

        profilePromises.set(key, promise);
        return promise;
    }

    function ensureProfileLink(element, identity, profile = null) {
        const existingLink = element.closest("a.player-profile-link");

        if (existingLink) {
            existingLink.href = profileHref(identity, profile);
            return existingLink;
        }

        if (element.closest("a, button")) {
            return null;
        }

        const link = document.createElement("a");
        link.className = "player-profile-link";
        link.href = profileHref(identity, profile);
        link.title = `View ${identity.username}'s profile`;
        link.setAttribute(
            "aria-label",
            `View ${identity.username}'s profile`
        );

        element.parentNode?.insertBefore(link, element);
        link.append(element);
        return link;
    }

    function ensureIdentityCopy(link, heading) {
        let copy = link.parentElement;

        if (!copy || copy === heading) {
            const wrapper = document.createElement("div");
            wrapper.className = "cosmetic-identity-copy";
            link.parentNode?.insertBefore(wrapper, link);
            wrapper.append(link);
            copy = wrapper;
        } else {
            copy.classList.add("cosmetic-identity-copy");
        }

        let nameRow = copy.querySelector(
            ":scope > .cosmetic-player-name-row"
        );

        if (!nameRow) {
            nameRow = document.createElement("div");
            nameRow.className = "cosmetic-player-name-row";
            link.parentNode?.insertBefore(nameRow, link);
            nameRow.append(link);
        }

        return {
            copy,
            nameRow
        };
    }

    function createBadge(profile, className = "") {
        const symbol = badgeSymbol(profile);

        if (!symbol) {
            return null;
        }

        const badge = document.createElement("span");
        badge.className =
            `cosmetic-player-badge ${className}`.trim();
        badge.textContent = symbol;
        badge.title = profile.badge?.name ?? "Player badge";
        badge.setAttribute("aria-label", badge.title);

        if (profile.is_admin) {
            badge.classList.add("admin-badge");
        }

        return badge;
    }

    function createAvatar(profile) {
        const frame = document.createElement("span");
        frame.className = "game-profile-avatar-frame";
        frame.dataset.playerFrame =
            profile.frame?.id ?? "frame_standard";
        frame.title = profile.frame?.name ?? "Profile frame";

        const avatar = document.createElement("span");
        avatar.className = "game-profile-avatar";

        if (profile.avatar_url) {
            const image = document.createElement("img");
            image.src = profile.avatar_url;
            image.alt = `${profile.username}'s profile picture`;
            image.loading = "lazy";
            image.referrerPolicy = "no-referrer";
            image.addEventListener("error", () => {
                avatar.replaceChildren(
                    document.createTextNode(
                        initialsFromUsername(profile.username)
                    )
                );
            });
            avatar.append(image);
        } else {
            avatar.textContent = initialsFromUsername(profile.username);
        }

        frame.append(avatar);
        return frame;
    }

    function applyRichProfile(
        card,
        heading,
        nameElement,
        identity,
        profile
    ) {
        const link = ensureProfileLink(
            nameElement,
            identity,
            profile
        );

        if (!link) {
            return;
        }

        const themeId = profile.theme?.id ?? "theme_midnight";
        const { copy, nameRow } = ensureIdentityCopy(link, heading);

        card.classList.add("cosmetic-rich-player-card");
        card.classList.toggle("admin-player-card", profile.is_admin === true);
        card.dataset.playerTheme = themeId;

        heading.classList.add("cosmetic-nameplate");
        heading.dataset.playerTheme = themeId;

        if (!heading.querySelector(":scope > .game-profile-avatar-frame")) {
            heading.prepend(createAvatar(profile));
        }

        if (!nameRow.querySelector(".cosmetic-player-badge")) {
            const badge = createBadge(profile);

            if (badge) {
                nameRow.append(badge);
            }
        }

        const titleName = profile.title?.name ?? "";

        if (
            titleName
            && !copy.querySelector(":scope > .cosmetic-player-title")
        ) {
            const title = document.createElement("span");
            title.className = "cosmetic-player-title";
            title.textContent = titleName;
            copy.append(title);
        }

        link.title = [
            `View ${profile.username}'s profile`,
            titleName,
            profile.badge?.name
        ].filter(Boolean).join(" · ");

        scheduleRichCardDensityRefresh();
    }

    async function enhanceRichName(card, configuration) {
        const heading = card.querySelector(configuration.headingSelector);
        const nameElement = card.querySelector(configuration.nameSelector);

        if (
            !heading
            || !nameElement
            || nameElement.dataset.cosmeticProfileState
        ) {
            return;
        }

        const identity = identityFromElement(nameElement);

        if (!identity) {
            return;
        }

        nameElement.dataset.cosmeticProfileState = "loading";
        ensureProfileLink(nameElement, identity);

        const profile = await loadProfile(identity);

        if (!nameElement.isConnected) {
            return;
        }

        if (!profile) {
            nameElement.dataset.cosmeticProfileState = "linked";
            return;
        }

        applyRichProfile(
            card,
            heading,
            nameElement,
            identity,
            profile
        );

        nameElement.dataset.cosmeticProfileState = "complete";
    }

    function ensureInlineIdentityRow(link) {
        const existingRow = link.closest(
            ".cosmetic-inline-identity-row"
        );

        if (existingRow) {
            return existingRow;
        }

        const parent = link.parentElement;

        if (!parent) {
            return null;
        }

        const row = document.createElement("span");
        row.className = "cosmetic-inline-identity-row";

        parent.insertBefore(row, link);
        row.append(link);

        return row;
    }

    function applyInlineProfile(
        nameElement,
        identity,
        profile,
        configuration
    ) {
        const link = ensureProfileLink(
            nameElement,
            identity,
            profile
        );

        if (!link) {
            return;
        }

        const identityRow = ensureInlineIdentityRow(link);

        if (!identityRow) {
            return;
        }

        const titleName = profile.title?.name ?? "";

        if (
            configuration.showTitle
            && titleName
            && !identityRow.querySelector(
                ":scope > .cosmetic-inline-title"
            )
        ) {
            const title = document.createElement("span");
            title.className = "cosmetic-inline-title";
            title.textContent = titleName;
            title.title = titleName;
            identityRow.append(title);
        }

        if (
            configuration.showBadge
            && !identityRow.querySelector(
                ":scope > .cosmetic-inline-badge"
            )
        ) {
            const badge = createBadge(
                profile,
                "cosmetic-inline-badge"
            );

            if (badge) {
                identityRow.append(badge);
            }
        }

        link.title = [
            `View ${profile.username}'s profile`,
            titleName,
            profile.badge?.name
        ].filter(Boolean).join(" · ");
    }

    async function enhanceInlineName(nameElement, configuration) {
        if (
            !(nameElement instanceof HTMLElement)
            || nameElement.dataset.cosmeticProfileState
            || nameElement.closest(".cosmetic-rich-player-card")
        ) {
            return;
        }

        const identity = identityFromElement(nameElement);

        if (!identity) {
            return;
        }

        nameElement.dataset.cosmeticProfileState = "loading";
        ensureProfileLink(nameElement, identity);

        const profile = await loadProfile(identity);

        if (!nameElement.isConnected) {
            return;
        }

        if (profile) {
            applyInlineProfile(
                nameElement,
                identity,
                profile,
                configuration
            );
        }

        nameElement.dataset.cosmeticProfileState = profile
            ? "complete"
            : "linked";
    }

    function createNameElement(username) {
        const element = document.createElement("strong");
        element.className = "profile-chip-username";
        element.textContent = username;
        return element;
    }

    async function enhanceSplitTextChip(element) {
        if (
            !(element instanceof HTMLElement)
            || element.dataset.cosmeticProfileState
        ) {
            return;
        }

        const originalText = element.textContent.trim();
        const splitIndex = originalText.indexOf("·");

        if (splitIndex < 1) {
            return;
        }

        const username = cleanUsername(
            originalText.slice(0, splitIndex)
        );
        const remainder = originalText.slice(splitIndex).trim();

        if (!username) {
            return;
        }

        element.dataset.cosmeticProfileState = "loading";
        element.classList.add("profile-enhanced-text-chip");

        const nameElement = createNameElement(username);
        const identity = {
            userId: element.dataset.userId || null,
            username
        };
        const link = ensureProfileLink(nameElement, identity);
        const rest = document.createElement("span");
        rest.textContent = remainder;

        element.replaceChildren(link, rest);

        const profile = await loadProfile(identity);

        if (!element.isConnected) {
            return;
        }

        if (profile) {
            const badge = createBadge(
                profile,
                "cosmetic-inline-badge"
            );

            if (badge) {
                link.insertAdjacentElement("afterend", badge);
            }

            link.href = profileHref(identity, profile);
            link.title = [
                `View ${profile.username}'s profile`,
                profile.title?.name,
                profile.badge?.name
            ].filter(Boolean).join(" · ");
        }

        element.dataset.cosmeticProfileState = profile
            ? "complete"
            : "linked";
    }

    function enhanceRoot(root = document) {
        for (const configuration of richPlayerCards) {
            if (
                root instanceof HTMLElement
                && root.matches(configuration.cardSelector)
            ) {
                enhanceRichName(root, configuration);
            }

            root
                .querySelectorAll?.(configuration.cardSelector)
                .forEach((card) => {
                    enhanceRichName(card, configuration);
                });
        }

        for (const configuration of mediumNameConfigurations) {
            if (
                root instanceof HTMLElement
                && root.matches(configuration.selector)
            ) {
                enhanceInlineName(root, configuration);
            }

            root
                .querySelectorAll?.(configuration.selector)
                .forEach((element) => {
                    enhanceInlineName(element, configuration);
                });
        }

        if (
            root instanceof HTMLElement
            && root.matches(compactNameSelectors)
        ) {
            enhanceInlineName(root, {
                showTitle: false,
                showBadge: false
            });
        }

        root
            .querySelectorAll?.(compactNameSelectors)
            .forEach((element) => {
                enhanceInlineName(element, {
                    showTitle: false,
                    showBadge: false
                });
            });

        if (
            root instanceof HTMLElement
            && root.matches(splitTextChipSelectors)
        ) {
            enhanceSplitTextChip(root);
        }

        root
            .querySelectorAll?.(splitTextChipSelectors)
            .forEach(enhanceSplitTextChip);
    }

    injectStyles();
    enhanceRoot();
    scheduleRichCardDensityRefresh();

    window.addEventListener(
        "resize",
        scheduleRichCardDensityRefresh,
        {
            passive: true
        }
    );

    const observer = new MutationObserver((records) => {
        for (const record of records) {
            if (record.target instanceof HTMLElement) {
                enhanceRoot(record.target);
            }

            for (const node of record.addedNodes) {
                if (node instanceof HTMLElement) {
                    enhanceRoot(node);
                }
            }
        }

        scheduleRichCardDensityRefresh();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
