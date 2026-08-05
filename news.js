(() => {
    const grid = document.querySelector("#news-grid");
    const featured = document.querySelector("#news-featured");
    const resultCount = document.querySelector("#news-result-count");
    const resultTitle = document.querySelector("#news-results-title");
    const lastUpdated = document.querySelector("#news-last-updated");
    const cacheCount = document.querySelector("#news-cache-count");
    const searchInput = document.querySelector("#news-search-input");
    const categoryBar = document.querySelector("#news-categories");
    const reloadButton = document.querySelector("#news-reload");

    let articles = [];
    let activeCategory = "all";

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

    function fullDate(value) {
        const date = new Date(value);

        if (!Number.isFinite(date.getTime())) {
            return "Unknown";
        }

        return new Intl.DateTimeFormat("en-AU", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    }

    function createImage(article, className) {
        const image = document.createElement("img");
        image.className = className;
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

        return image;
    }

    function createMeta(article) {
        const meta = document.createElement("div");
        meta.className = "news-meta";

        const category = document.createElement("span");
        category.className = "news-category";
        category.textContent = article.category || "News";

        const source = document.createElement("span");
        source.textContent = sourceName(article.url);

        const time = document.createElement("time");
        time.dateTime = article.published_at;
        time.textContent = relativeTime(article.published_at);
        time.title = fullDate(article.published_at);

        meta.append(category, source, time);
        return meta;
    }

    function createArticleLink(article, className) {
        const url = safeExternalUrl(article.url);
        const element = document.createElement(url ? "a" : "article");
        element.className = className;

        if (url) {
            element.href = url;
            element.target = "_blank";
            element.rel = "noopener noreferrer";
        }

        return element;
    }

    function createCard(article) {
        const card = createArticleLink(article, "panel news-card");
        const copy = document.createElement("div");
        copy.className = "news-card-copy";

        const title = document.createElement("h3");
        title.textContent = article.title;

        const summary = document.createElement("p");
        summary.textContent = article.summary || "Open the original article to read more.";

        copy.append(createMeta(article), title, summary);
        card.append(createImage(article, "news-card-image"), copy);
        return card;
    }

    function createFeatured(article) {
        const card = createArticleLink(article, "panel news-featured-card");
        const copy = document.createElement("div");
        copy.className = "news-featured-copy";

        const title = document.createElement("h2");
        title.textContent = article.title;

        const summary = document.createElement("p");
        summary.textContent = article.summary || "Open the original article to read more.";

        copy.append(createMeta(article), title, summary);
        card.append(createImage(article, "news-featured-image"), copy);
        return card;
    }

    function filteredArticles() {
        const query = searchInput.value.trim().toLocaleLowerCase();

        return articles.filter((article) => {
            const category = String(article.category || "other").toLowerCase();
            const categoryMatches = activeCategory === "all"
                || category === activeCategory
                || (
                    activeCategory === "other"
                    && ![
                        "business", "technology", "sports", "entertainment",
                        "politics", "science", "health"
                    ].includes(category)
                );

            if (!categoryMatches) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                article.title,
                article.summary,
                article.category,
                article.source_country,
                ...(Array.isArray(article.authors) ? article.authors : [])
            ]
                .filter(Boolean)
                .some((value) =>
                    String(value).toLocaleLowerCase().includes(query)
                );
        });
    }

    function renderArticles() {
        const filtered = filteredArticles();
        grid.replaceChildren();
        featured.replaceChildren();

        resultTitle.textContent = activeCategory === "all"
            ? "All headlines"
            : `${activeCategory[0].toUpperCase()}${activeCategory.slice(1)} headlines`;
        resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "story" : "stories"}`;

        if (!filtered.length) {
            featured.hidden = true;
            const empty = document.createElement("article");
            empty.className = "panel news-empty";
            empty.textContent = "No cached headlines match those filters.";
            grid.append(empty);
            return;
        }

        featured.append(createFeatured(filtered[0]));
        featured.hidden = false;

        for (const article of filtered.slice(1)) {
            grid.append(createCard(article));
        }

        if (filtered.length === 1) {
            const empty = document.createElement("article");
            empty.className = "panel news-empty";
            empty.textContent = "That is the only cached story matching these filters.";
            grid.append(empty);
        }
    }

    function showLoadError(message) {
        featured.hidden = true;
        grid.replaceChildren();
        const error = document.createElement("article");
        error.className = "panel news-empty error";
        error.textContent = message;
        grid.append(error);
        resultCount.textContent = "Unavailable";
    }

    async function loadNews() {
        reloadButton.disabled = true;
        resultCount.textContent = "Loading...";

        try {
            const {
                data: { user },
                error: userError
            } = await window.supabaseClient.auth.getUser();

            if (userError || !user) {
                window.location.href = "login.html";
                return;
            }

            const [articleResult, stateResult] = await Promise.all([
                window.supabaseClient
                    .from("news_articles")
                    .select(
                        "provider_id, title, summary, url, image_url, authors, category, language, source_country, sentiment, published_at"
                    )
                    .order("published_at", { ascending: false })
                    .limit(60),

                window.supabaseClient
                    .from("news_feed_state")
                    .select(
                        "last_success_at, article_count, last_error"
                    )
                    .eq("singleton", true)
                    .maybeSingle()
            ]);

            if (articleResult.error) {
                throw articleResult.error;
            }

            articles = Array.isArray(articleResult.data)
                ? articleResult.data
                : [];

            if (stateResult.error) {
                console.warn("Could not load news cache state:", stateResult.error);
            }

            const state = stateResult.data;
            lastUpdated.textContent = state?.last_success_at
                ? fullDate(state.last_success_at)
                : "Not refreshed yet";
            cacheCount.textContent = `${state?.article_count ?? articles.length} cached articles`;

            renderArticles();
        } catch (error) {
            console.error("Could not load cached news:", error);
            showLoadError("The cached news feed could not be loaded. Try again shortly.");
        } finally {
            reloadButton.disabled = false;
        }
    }

    categoryBar.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-category]");
        if (!button) {
            return;
        }

        activeCategory = button.dataset.category;
        categoryBar.querySelectorAll("button[data-category]").forEach((item) => {
            item.classList.toggle("active", item === button);
        });
        renderArticles();
    });

    searchInput.addEventListener("input", renderArticles);
    reloadButton.addEventListener("click", loadNews);
    loadNews();
})();
