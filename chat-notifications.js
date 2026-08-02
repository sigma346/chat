(() => {
    if (!window.supabaseClient) {
        console.warn(
            "Chat notifications require supabase-client.js first."
        );
        return;
    }

    const MAX_CHAT_NOTIFICATIONS = 3;
    const MAX_STORED_NOTIFICATIONS = 20;
    const MAX_HIDDEN_KEYS = 100;
    const HIDDEN_STORAGE_KEY = "hidden-chat-notifications-v1";

    const notifications = new Map();
    const hiddenNotificationKeys = loadHiddenNotificationKeys();

    let currentUser = null;
    let publicChannel = null;
    let personalChannel = null;
    let renderQueued = false;
    let rendering = false;
    let chatObserver = null;


    function loadHiddenNotificationKeys() {
        try {
            const stored = JSON.parse(
                window.localStorage.getItem(HIDDEN_STORAGE_KEY) || "[]"
            );

            return new Set(
                Array.isArray(stored)
                    ? stored.filter((value) => typeof value === "string")
                    : []
            );
        } catch (error) {
            console.warn("Hidden notifications could not be loaded:", error);
            return new Set();
        }
    }


    function saveHiddenNotificationKeys() {
        try {
            const keys = [...hiddenNotificationKeys].slice(-MAX_HIDDEN_KEYS);
            window.localStorage.setItem(
                HIDDEN_STORAGE_KEY,
                JSON.stringify(keys)
            );
        } catch (error) {
            console.warn("Hidden notifications could not be saved:", error);
        }
    }


    function formatTime(value) {
        return new Intl.DateTimeFormat(
            "en-GB",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(new Date(value));
    }


    function isUsefulNotification(notification) {
        const eventKey = String(notification.event_key ?? "");

        if (
            eventKey.startsWith("roulette-warning:")
            || eventKey.startsWith("roulette-spin:")
        ) {
            return false;
        }

        return Boolean(
            notification.id
            && notification.title
            && notification.message
            && notification.created_at
        );
    }


    function notificationKey(notification) {
        return `${notification.source}:${notification.id}`;
    }


    function storeNotification(notification) {
        if (!isUsefulNotification(notification)) {
            return;
        }

        const key = notificationKey(notification);

        if (hiddenNotificationKeys.has(key)) {
            return;
        }

        notifications.set(key, notification);

        const ordered = [...notifications.values()].sort(
            (left, right) =>
                new Date(right.created_at)
                - new Date(left.created_at)
        );

        for (const stale of ordered.slice(MAX_STORED_NOTIFICATIONS)) {
            notifications.delete(notificationKey(stale));
        }
    }


    function hideNotification(notification) {
        const key = notificationKey(notification);
        hiddenNotificationKeys.add(key);
        notifications.delete(key);
        saveHiddenNotificationKeys();
        queueRender();
    }


    function findChatMessageList() {
        const selectors = [
            "#chat-messages",
            ".chat-messages",
            "[data-chat-messages]",
            "#messages",
            ".messages",
            "#messages-container",
            ".messages-container"
        ];

        for (const selector of selectors) {
            const candidate = document.querySelector(selector);

            if (candidate) {
                return candidate;
            }
        }

        return null;
    }


    function ensureFallbackMount() {
        let fallback = document.querySelector(
            "#chat-notification-fallback"
        );

        if (fallback) {
            return fallback;
        }

        fallback = document.createElement("section");
        fallback.id = "chat-notification-fallback";
        fallback.className = "chat-notification-fallback";
        fallback.setAttribute("aria-label", "Chat notifications");

        const navbar = document.querySelector(".shared-site-nav");

        if (navbar) {
            navbar.insertAdjacentElement("afterend", fallback);
        } else {
            const main = document.querySelector("main") || document.body;
            main.prepend(fallback);
        }

        return fallback;
    }


    function resolveNotificationLink(value) {
        const rawValue = String(value ?? "").trim();

        if (!rawValue) {
            return null;
        }

        /*
         * Preserve explicit protocols and in-page anchors. For ordinary site
         * pages, remove a leading slash and resolve from the current project
         * directory. This keeps links inside /chat/ on GitHub Pages rather
         * than sending them to the domain root.
         */
        if (
            /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(rawValue)
            || rawValue.startsWith("#")
        ) {
            return rawValue;
        }

        const projectBase = new URL(
            "./",
            window.location.href
        );

        return new URL(
            rawValue.replace(/^\/+/, ""),
            projectBase
        ).href;
    }


    function createNotificationMessage(notification) {
        const article = document.createElement("article");
        article.className =
            `chat-system-notification notification-${notification.category}`;
        article.dataset.chatNotification = notificationKey(notification);

        const icon = document.createElement("span");
        icon.className = "chat-system-notification-icon";
        icon.setAttribute("aria-hidden", "true");

        if (notification.category === "roulette") {
            icon.textContent = "◉";
        } else if (notification.category === "donation") {
            icon.textContent = "◆";
        } else if (notification.category === "horse_racing") {
            icon.textContent = "♞";
        } else {
            icon.textContent = "●";
        }

        const content = document.createElement("div");
        content.className = "chat-system-notification-content";

        const summary = document.createElement("div");
        summary.className = "chat-system-notification-summary";

        const title = document.createElement("strong");
        title.textContent = notification.title;

        const message = document.createElement("span");
        message.className = "chat-system-notification-message";
        message.textContent = notification.message;
        message.title = notification.message;

        summary.append(title, message);
        content.append(summary);

        const actions = document.createElement("div");
        actions.className = "chat-system-notification-actions";

        const time = document.createElement("time");
        time.dateTime = notification.created_at;
        time.textContent = formatTime(notification.created_at);
        actions.append(time);

        if (notification.link_url) {
            const link = document.createElement("a");
            link.href = resolveNotificationLink(
                notification.link_url
            );
            link.textContent = "Open";
            link.className = "chat-system-notification-link";
            actions.append(link);
        }

        const hideButton = document.createElement("button");
        hideButton.type = "button";
        hideButton.className = "chat-system-notification-hide";
        hideButton.textContent = "Hide";
        hideButton.title = "Hide this notification";
        hideButton.setAttribute(
            "aria-label",
            `Hide notification: ${notification.title}`
        );
        hideButton.addEventListener("click", () => {
            hideNotification(notification);
        });
        actions.append(hideButton);

        article.append(icon, content, actions);
        return article;
    }


    function renderNotifications() {
        if (rendering) {
            return;
        }

        rendering = true;
        chatObserver?.disconnect();

        try {
            const chatList = findChatMessageList();
            const fallback = document.querySelector(
                "#chat-notification-fallback"
            );

            document
                .querySelectorAll("[data-chat-notification]")
                .forEach((element) => element.remove());

            const recent = [...notifications.values()]
                .sort(
                    (left, right) =>
                        new Date(left.created_at)
                        - new Date(right.created_at)
                )
                .slice(-MAX_CHAT_NOTIFICATIONS);

            if (!recent.length) {
                fallback?.remove();
                return;
            }

            const mount = chatList || fallback || ensureFallbackMount();

            for (const notification of recent) {
                mount.append(
                    createNotificationMessage(notification)
                );
            }

            if (chatList && fallback) {
                fallback.remove();
            }
        } finally {
            rendering = false;
            observeChatRenders();
        }
    }


    function queueRender() {
        if (renderQueued) {
            return;
        }

        renderQueued = true;

        window.requestAnimationFrame(() => {
            renderQueued = false;
            renderNotifications();
        });
    }


    async function loadRecentNotifications() {
        const [publicResult, personalResult] = await Promise.all([
            window.supabaseClient
                .from("site_notifications")
                .select(
                    "id, event_key, category, title, message, link_url, created_at"
                )
                .order("created_at", { ascending: false })
                .limit(20),

            window.supabaseClient
                .from("user_notifications")
                .select(
                    "id, category, title, message, link_url, created_at, read_at"
                )
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false })
                .limit(20)
        ]);

        if (publicResult.error) {
            throw publicResult.error;
        }

        if (personalResult.error) {
            throw personalResult.error;
        }

        for (const item of publicResult.data ?? []) {
            storeNotification({
                ...item,
                source: "public"
            });
        }

        for (const item of personalResult.data ?? []) {
            storeNotification({
                ...item,
                event_key: null,
                source: "personal"
            });
        }

        queueRender();
    }


    function subscribeToNotifications() {
        publicChannel = window.supabaseClient
            .channel("chat-public-event-notifications")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "site_notifications"
                },
                (payload) => {
                    storeNotification({
                        ...payload.new,
                        source: "public"
                    });
                    queueRender();
                }
            )
            .subscribe();

        personalChannel = window.supabaseClient
            .channel(`chat-personal-notifications-${currentUser.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "user_notifications",
                    filter: `user_id=eq.${currentUser.id}`
                },
                (payload) => {
                    storeNotification({
                        ...payload.new,
                        event_key: null,
                        source: "personal"
                    });
                    queueRender();
                }
            )
            .subscribe();
    }


    function observeChatRenders() {
        if (!chatObserver) {
            chatObserver = new MutationObserver(() => {
                if (!rendering) {
                    queueRender();
                }
            });
        }

        chatObserver.disconnect();
        chatObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }


    async function initialiseChatNotifications() {
        try {
            const {
                data: { user },
                error
            } = await window.supabaseClient.auth.getUser();

            if (error) {
                throw error;
            }

            if (!user) {
                return;
            }

            currentUser = user;

            await loadRecentNotifications();
            subscribeToNotifications();
            observeChatRenders();
        } catch (error) {
            console.warn(
                "Chat notifications could not be loaded:",
                error
            );
        }
    }


    window.addEventListener("beforeunload", () => {
        if (publicChannel) {
            window.supabaseClient.removeChannel(publicChannel);
        }

        if (personalChannel) {
            window.supabaseClient.removeChannel(personalChannel);
        }
    });


    initialiseChatNotifications();
})();
