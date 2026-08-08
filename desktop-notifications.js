(() => {
    if (window.siteDesktopNotifications) {
        return;
    }

    const preferenceKey = "casino-desktop-notifications-enabled";
    const recentNotificationPrefix = "casino-desktop-notification:";
    let currentUser = null;
    let messageChannel = null;

    function isSupported() {
        return "Notification" in window && window.isSecureContext;
    }

    function permission() {
        return isSupported() ? Notification.permission : "unsupported";
    }

    function optedIn() {
        return window.localStorage.getItem(preferenceKey) === "true";
    }

    function updatePermissionControls() {
        const state = permission();
        const enabled = state === "granted" && optedIn();

        document
            .querySelectorAll("[data-enable-desktop-notifications]")
            .forEach((button) => {
                button.disabled = state === "unsupported";
                button.textContent = enabled
                    ? "Desktop notifications enabled"
                    : state === "denied"
                        ? "Notifications blocked in browser"
                        : "Enable desktop notifications";
            });

        document
            .querySelectorAll("[data-desktop-notification-status]")
            .forEach((element) => {
                if (state === "unsupported") {
                    element.textContent = window.isSecureContext
                        ? "This browser does not support desktop notifications."
                        : "Desktop notifications require HTTPS or localhost.";
                } else if (state === "denied") {
                    element.textContent =
                        "Notifications are blocked. Allow them in this site's browser permissions, then reload.";
                } else if (enabled) {
                    element.textContent =
                        "Incoming calls and messages can notify you while this site is open.";
                } else {
                    element.textContent =
                        "Enable notifications to see incoming calls and messages while another tab is active.";
                }
            });
    }

    async function requestPermission() {
        if (!isSupported()) {
            updatePermissionControls();
            return "unsupported";
        }

        let result = Notification.permission;

        if (result === "default") {
            result = await Notification.requestPermission();
        }

        window.localStorage.setItem(
            preferenceKey,
            String(result === "granted")
        );
        updatePermissionControls();
        return result;
    }

    function claimNotification(tag) {
        if (!tag) {
            return true;
        }

        const key = recentNotificationPrefix + tag;
        const now = Date.now();
        const lastClaim = Number(window.localStorage.getItem(key) || 0);

        if (now - lastClaim < 12000) {
            return false;
        }

        window.localStorage.setItem(key, String(now));
        return true;
    }

    function show(options = {}) {
        if (
            permission() !== "granted"
            || !optedIn()
            || (!options.force && document.visibilityState === "visible"
                && document.hasFocus())
            || !claimNotification(options.tag)
        ) {
            return null;
        }

        const notification = new Notification(
            options.title || "Casino",
            {
                body: options.body || "",
                tag: options.tag,
                renotify: Boolean(options.renotify),
                requireInteraction: Boolean(options.requireInteraction)
            }
        );

        notification.addEventListener("click", () => {
            window.focus();

            if (options.url) {
                window.location.href = options.url;
            }

            notification.close();
        });

        return notification;
    }

    function updateUnreadBadge(value) {
        const badge = document.querySelector(
            "#navbar-direct-message-count"
        );

        if (!badge) {
            return;
        }

        const count = Math.max(Number(value ?? 0), 0);
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = count === 0;
        badge.title = count === 1
            ? "1 unread direct message"
            : `${count} unread direct messages`;

        window.dispatchEvent(new CustomEvent(
            "direct-message-unread-count",
            { detail: { count } }
        ));
    }

    async function refreshUnreadCount() {
        if (!window.supabaseClient || !currentUser) {
            return;
        }

        const { data, error } = await window.supabaseClient.rpc(
            "get_unread_direct_message_count"
        );

        if (!error) {
            updateUnreadBadge(data);
        }
    }

    function handleIncomingMessage(message) {
        if (!message || message.recipient_id !== currentUser?.id) {
            return;
        }

        refreshUnreadCount();

        window.dispatchEvent(new CustomEvent(
            "direct-message-received",
            { detail: message }
        ));

        show({
            title: `Message from ${message.sender_username}`,
            body: message.content,
            tag: `direct-message-${message.id}`,
            url: `messages.html?user=${encodeURIComponent(message.sender_id)}`
        });
    }

    async function initialise() {
        updatePermissionControls();

        if (!window.supabaseClient) {
            return;
        }

        const { data: { user } } =
            await window.supabaseClient.auth.getUser();

        if (!user) {
            return;
        }

        currentUser = user;
        await refreshUnreadCount();

        messageChannel = window.supabaseClient
            .channel(`desktop-direct-messages-${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "direct_messages",
                    filter: `recipient_id=eq.${user.id}`
                },
                (payload) => handleIncomingMessage(payload.new)
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "direct_messages",
                    filter: `recipient_id=eq.${user.id}`
                },
                refreshUnreadCount
            )
            .subscribe();
    }

    document.addEventListener("click", (event) => {
        const button = event.target.closest(
            "[data-enable-desktop-notifications]"
        );

        if (button) {
            requestPermission().catch((error) => {
                console.warn("Notification permission failed:", error);
                updatePermissionControls();
            });
        }
    });

    window.addEventListener("site-desktop-notification", (event) => {
        show(event.detail || {});
    });
    window.addEventListener("shared-navbar-mounted", refreshUnreadCount);
    window.addEventListener("direct-messages-read", refreshUnreadCount);
    window.addEventListener("focus", refreshUnreadCount);
    window.addEventListener("beforeunload", () => {
        if (messageChannel && window.supabaseClient) {
            window.supabaseClient.removeChannel(messageChannel);
        }
    });

    window.siteDesktopNotifications = {
        requestPermission,
        refreshUnreadCount,
        show,
        get permission() {
            return permission();
        },
        get enabled() {
            return permission() === "granted" && optedIn();
        }
    };

    initialise().catch((error) => {
        console.warn("Desktop notifications could not be initialised:", error);
    });
})();
