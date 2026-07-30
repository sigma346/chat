(() => {
    if (!window.supabaseClient) {
        console.warn(
            "Chat event notifications require supabase-client.js first."
        );
        return;
    }

    const renderedNotificationIds = new Set();
    let notificationChannel = null;


    function formatNotificationTime(value) {
        return new Intl.DateTimeFormat(
            "en-GB",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(new Date(value));
    }


    function findChatMount() {
        return document.querySelector(
            "#chat-container, .chat-container, .chat-panel, "
            + "#messages-container, .messages-container, main"
        ) || document.body;
    }


    function createNotificationPanel() {
        const existing = document.querySelector(
            "#global-event-notifications"
        );

        if (existing) {
            return existing;
        }

        const panel = document.createElement("section");
        panel.id = "global-event-notifications";
        panel.className = "global-event-notifications";

        const heading = document.createElement("button");
        heading.type = "button";
        heading.className = "event-notification-heading";
        heading.setAttribute("aria-expanded", "true");

        const headingCopy = document.createElement("span");

        const title = document.createElement("strong");
        title.textContent = "Global event notifications";

        const description = document.createElement("small");
        description.textContent =
            "Roulette results and other shared events";

        headingCopy.append(title, description);

        const toggleText = document.createElement("span");
        toggleText.className = "event-notification-toggle";
        toggleText.textContent = "Hide";

        heading.append(headingCopy, toggleText);

        const list = document.createElement("div");
        list.id = "global-event-notification-list";
        list.className = "global-event-notification-list";

        const empty = document.createElement("p");
        empty.className = "empty-event-notification";
        empty.textContent = "No global event notifications yet.";

        list.append(empty);
        panel.append(heading, list);

        heading.addEventListener(
            "click",
            () => {
                const collapsed = panel.classList.toggle(
                    "collapsed"
                );

                heading.setAttribute(
                    "aria-expanded",
                    String(!collapsed)
                );

                toggleText.textContent = collapsed
                    ? "Show"
                    : "Hide";
            }
        );

        const mount = findChatMount();

        const likelyMessageList = mount.querySelector(
            "#chat-messages, .chat-messages, #messages, "
            + ".messages, [data-chat-messages]"
        );

        if (likelyMessageList) {
            likelyMessageList.before(panel);
        } else {
            mount.prepend(panel);
        }

        return panel;
    }


    function createNotificationCard(notification) {
        const card = document.createElement("article");
        card.className =
            `event-notification-card event-${notification.category}`;
        card.dataset.notificationId = String(notification.id);

        const icon = document.createElement("span");
        icon.className = "event-notification-icon";
        icon.textContent = notification.category === "roulette"
            ? "◉"
            : "◆";

        const copy = document.createElement("div");
        copy.className = "event-notification-copy";

        const header = document.createElement("div");

        const title = document.createElement("strong");
        title.textContent = notification.title;

        const time = document.createElement("time");
        time.dateTime = notification.created_at;
        time.textContent = formatNotificationTime(
            notification.created_at
        );

        header.append(title, time);

        const message = document.createElement("p");
        message.textContent = notification.message;

        copy.append(header, message);

        if (notification.link_url) {
            const link = document.createElement("a");
            link.href = notification.link_url;
            link.textContent = "Open event";
            link.className = "event-notification-link";
            copy.append(link);
        }

        card.append(icon, copy);
        return card;
    }


    function renderNotification(
        notification,
        prepend = true
    ) {
        const id = String(notification.id);

        if (renderedNotificationIds.has(id)) {
            return;
        }

        renderedNotificationIds.add(id);

        const list = document.querySelector(
            "#global-event-notification-list"
        );

        if (!list) {
            return;
        }

        list.querySelector(
            ".empty-event-notification"
        )?.remove();

        const card = createNotificationCard(notification);

        if (prepend) {
            list.prepend(card);
        } else {
            list.append(card);
        }

        while (list.children.length > 15) {
            const finalChild = list.lastElementChild;

            if (finalChild) {
                renderedNotificationIds.delete(
                    finalChild.dataset.notificationId
                );
                finalChild.remove();
            }
        }
    }


    function showNotificationToast(notification) {
        let toast = document.querySelector(
            "#global-event-toast"
        );

        if (!toast) {
            toast = document.createElement("a");
            toast.id = "global-event-toast";
            toast.className = "global-event-toast";
            document.body.append(toast);
        }

        toast.href = notification.link_url || "#";
        toast.textContent =
            `${notification.title}: ${notification.message}`;

        toast.classList.add("visible");

        window.clearTimeout(
            showNotificationToast.timeout
        );

        showNotificationToast.timeout =
            window.setTimeout(
                () => {
                    toast.classList.remove("visible");
                },
                6500
            );
    }


    async function loadRecentNotifications() {
        const {
            data,
            error
        } = await window.supabaseClient
            .from("site_notifications")
            .select(
                "id, category, title, message, link_url, created_at"
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(15);

        if (error) {
            throw error;
        }

        for (const notification of [...(data ?? [])].reverse()) {
            renderNotification(notification, false);
        }
    }


    function subscribeToNotifications() {
        notificationChannel = window.supabaseClient
            .channel("chat-global-event-notifications")

            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "site_notifications"
                },
                (payload) => {
                    renderNotification(
                        payload.new,
                        true
                    );

                    showNotificationToast(
                        payload.new
                    );
                }
            )

            .subscribe();
    }


    async function initialiseChatNotifications() {
        try {
            const {
                data: {
                    user
                }
            } = await window.supabaseClient.auth.getUser();

            if (!user) {
                return;
            }

            createNotificationPanel();
            await loadRecentNotifications();
            subscribeToNotifications();
        } catch (error) {
            console.warn(
                "Global chat notifications could not be loaded:",
                error
            );
        }
    }


    window.addEventListener(
        "beforeunload",
        () => {
            if (notificationChannel) {
                window.supabaseClient.removeChannel(
                    notificationChannel
                );
            }
        }
    );


    initialiseChatNotifications();
})();
