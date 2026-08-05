(() => {
    const grid = document.querySelector("#home-news-grid");
    const status = document.querySelector("#home-news-status");

    if (!grid || !status || !window.supabaseClient) {
        return;
    }

    function safeExternalUrl(value) {
        try {
            const url = new URL(String(value || ""));
            return ["http:", "https:"].includes(url.protocol)
                ? url.href
                : null;
        } catch (error) {
            return null;
        }
    }

    function sourceName(value) {
        try {
            return new URL(value).hostname.replace(/^www\./, "");
        } catch (error) {
            return "News source";
        }
    }

    function relativeTime(value) {
        const published = new Date(value);
        const difference = published.getTime() - Date.now();

        if (!Number.isFinite(difference)) {
            return "Recently";
        }

        const formatter = new Intl.RelativeTimeFormat("en-AU", {
            numeric: "auto"
        });
        const absolute = Math.abs(difference);

        if (absolute < 60 * 60 * 1000) {
            return formatter.format(
                Math.round(difference / (60 * 1000)),
                "minute"
            );
        }

        if (absolute < 24 * 60 * 60 * 1000) {
            return formatter.format(
                Math.round(difference / (60 * 60 * 1000)),
                "hour"
            );
        }

        return formatter.format(
            Math.round(difference / (24 * 60 * 60 * 1000)),
            "day"
        );
    }

    function createHeadline(article) {
        const articleUrl = safeExternalUrl(article.url);
        const card = document.createElement(articleUrl ? "a" : "article");
        card.className = "panel home-news-card";

        if (articleUrl) {
            card.href = articleUrl;
            card.target = "_blank";
            card.rel = "noopener noreferrer";
        }

        const image = document.createElement("img");
        image.className = "home-news-image";
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";

        const imageUrl = safeExternalUrl(article.image_url);
        if (imageUrl) {
            image.src = imageUrl;
            image.addEventListener("error", () => {
                image.hidden = true;
            });
        } else {
            image.hidden = true;
        }

        const copy = document.createElement("div");
        copy.className = "home-news-copy";

        const meta = document.createElement("div");
        meta.className = "home-news-meta";

        const category = document.createElement("span");
        category.className = "home-news-category";
        category.textContent = article.category || "News";

        const source = document.createElement("span");
        source.textContent = sourceName(article.url);

        const time = document.createElement("time");
        time.dateTime = article.published_at;
        time.textContent = relativeTime(article.published_at);

        meta.append(category, source, time);

        const title = document.createElement("h3");
        title.textContent = article.title;

        const summary = document.createElement("p");
        summary.textContent = article.summary || "Open the article to read more.";

        copy.append(meta, title, summary);
        card.append(image, copy);
        return card;
    }

    async function loadHomeNews() {
        const { data, error } = await window.supabaseClient
            .from("news_articles")
            .select(
                "provider_id, title, summary, url, image_url, category, published_at"
            )
            .order("published_at", { ascending: false })
            .limit(3);

        grid.replaceChildren();

        if (error) {
            console.warn("Could not load cached news:", error);
            const message = document.createElement("article");
            message.className = "panel home-news-placeholder";
            message.textContent = "The news feed is unavailable right now.";
            grid.append(message);
            status.textContent = "Cached headlines could not be loaded.";
            status.classList.add("error");
            return;
        }

        if (!data?.length) {
            const message = document.createElement("article");
            message.className = "panel home-news-placeholder";
            message.textContent = "No headlines are cached yet. Run the first news refresh after installation.";
            grid.append(message);
            status.textContent = "Waiting for the first World News API update.";
            return;
        }

        for (const article of data) {
            grid.append(createHeadline(article));
        }

        status.textContent = "Headlines are read from the shared Supabase cache.";
    }

    loadHomeNews();
})();
