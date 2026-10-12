/* =============================================
   SITE CONTENT
   Managed in the website editor at /admin (Decap CMS).
   Reads the JSON files in /content and fills in the page.
   The HTML keeps the current content as a fallback, so the
   page still reads correctly if a file can't load.
   ============================================= */
(function () {
    const TZ = "America/Los_Angeles";
    const SHOW_POSTS = 3;

    const ICONS = {
        wrench:      "fa-wrench",
        droplet:     "fa-droplet",
        tags:        "fa-tags",
        flame:       "fa-fire-flame-simple",
        gauge:       "fa-gauge",
        faucet:      "fa-faucet",
        house:       "fa-house",
        thermometer: "fa-temperature-half",
        tools:       "fa-screwdriver-wrench",
        calendar:    "fa-calendar-check"
    };

    /* ---- Helpers ---- */
    async function load(name) {
        try {
            const res = await fetch("content/" + name + ".json", { cache: "no-store" });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) { return null; }
    }

    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function reveal(node) {
        if (typeof revealObserver !== "undefined") revealObserver.observe(node);
        else node.classList.add("is-visible");
    }

    function todayInSF() {
        return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
    }

    function prettyDate(ymd) {
        const [y, m, d] = String(ymd).split("-").map(Number);
        if (!y || !m || !d) return ymd;
        return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }

    function setText(key, value) {
        if (!value) return;
        document.querySelectorAll('[data-cms-text="' + key + '"]').forEach(n => { n.textContent = value; });
    }

    function setHref(key, value) {
        document.querySelectorAll('[data-cms-href="' + key + '"]').forEach(n => n.setAttribute("href", value));
    }

    /* ---- Announcement banner ---- */
    function applyNotice(n) {
        const notice = document.getElementById("closureNotice");
        const text   = document.getElementById("closureText");
        if (!notice || !text || !n || !n.enabled) return;

        const today = todayInSF();
        if (n.show_from && today < n.show_from) return;
        if (n.hide_on && today >= n.hide_on) { notice.remove(); return; }

        const isClosed = n.closed_from && today >= n.closed_from;
        const label    = isClosed ? (n.label_during || n.label_before) : n.label_before;
        const message  = isClosed ? (n.message_during || n.message_before) : n.message_before;
        if (!message) return;

        text.textContent = "";
        if (label) {
            text.appendChild(el("strong", null, label + ":"));
            text.appendChild(document.createTextNode(" "));
        }
        text.appendChild(document.createTextNode(message));

        notice.hidden = false;
        document.body.classList.add("has-notice");
    }

    /* ---- Contact info & hours ---- */
    function applyContact(c) {
        if (!c) return;
        const digits = String(c.phone || "").replace(/\D/g, "");

        ["phone", "email", "street", "city", "state", "zip", "license"].forEach(k => setText(k, c[k]));
        if (digits.length >= 10) {
            setHref("tel", "tel:" + digits);
            setHref("sms", "sms:" + digits);
        }
        if (c.email) setHref("mailto", "mailto:" + c.email);

        const hours = document.getElementById("hoursList");
        if (hours && Array.isArray(c.hours) && c.hours.length) {
            hours.textContent = "";
            c.hours.forEach(h => {
                const row = el("p", "hours-row");
                row.append(el("span", null, h.day || ""), el("span", null, h.time || ""));
                hours.appendChild(row);
            });
        }

        // Keep the search engine data in sync
        const ld = document.querySelector('script[type="application/ld+json"]');
        if (ld) {
            try {
                const data = JSON.parse(ld.textContent);
                if (digits.length >= 10) data.telephone = "+1" + digits.slice(-10);
                if (c.email) data.email = c.email;
                if (data.address) {
                    if (c.street) data.address.streetAddress   = c.street;
                    if (c.city)   data.address.addressLocality = c.city;
                    if (c.state)  data.address.addressRegion   = c.state;
                    if (c.zip)    data.address.postalCode      = c.zip;
                }
                ld.textContent = JSON.stringify(data);
            } catch (e) { /* leave original data in place */ }
        }
    }

    /* ---- Services & pricing ---- */
    function applyPricing(p) {
        const grid = document.querySelector(".services-grid");
        if (!grid || !p || !Array.isArray(p.services) || !p.services.length) return;

        grid.textContent = "";
        p.services.forEach((s, i) => {
            const card = el("div", "service-card animate-up" + (s.featured ? " featured" : ""));
            card.dataset.delay = String((i % 4) + 1);
            const inner = el("div", "service-card-inner");

            if (s.badge) inner.appendChild(el("div", "service-badge-tag", s.badge));
            inner.appendChild(el("div", "service-num", String(i + 1).padStart(2, "0")));

            const iconWrap = el("div", "service-icon-wrap");
            iconWrap.appendChild(el("i", "fa-solid " + (ICONS[s.icon] || "fa-wrench")));
            inner.appendChild(iconWrap);

            inner.appendChild(el("h3", null, s.title || ""));

            if (s.price) {
                const price = el("div", "service-price", s.price + " ");
                if (s.unit) price.appendChild(el("span", null, "/ " + s.unit));
                inner.appendChild(price);
            }

            if (Array.isArray(s.discounts) && s.discounts.length) {
                const list = el("div", "service-price-list");
                s.discounts.forEach(d => {
                    const row = el("p");
                    row.append(el("span", "price-pct", d.amount || ""), document.createTextNode(d.text || ""));
                    list.appendChild(row);
                });
                inner.appendChild(list);
            }

            if (s.description) inner.appendChild(el("p", null, s.description));

            card.appendChild(inner);
            grid.appendChild(card);
            reveal(card);
        });
    }

    /* ---- News & updates ---- */
    function applyUpdates(u) {
        const section = document.getElementById("updatesSection");
        const list    = document.getElementById("updatesList");
        if (!section || !list || !u || !Array.isArray(u.posts)) return;

        const today = todayInSF();
        const posts = u.posts
            .filter(p => p && p.title && p.date && p.date <= today)
            .sort((a, b) => b.date.localeCompare(a.date));
        if (!posts.length) return;

        list.textContent = "";
        const hiddenCards = [];

        posts.forEach((p, i) => {
            const card = el("article", "update-card animate-up");
            const date = el("time", "update-date", prettyDate(p.date));
            date.dateTime = p.date;
            card.appendChild(date);
            card.appendChild(el("h3", null, p.title));

            if (p.image) {
                const img = el("img", "update-img");
                img.src = p.image;
                img.alt = p.image_alt || "";
                img.loading = "lazy";
                card.appendChild(img);
            }

            String(p.body || "").split(/\n\s*\n/).forEach(par => {
                if (par.trim()) card.appendChild(el("p", null, par.trim()));
            });

            list.appendChild(card);
            if (i < SHOW_POSTS) reveal(card);
            else { card.hidden = true; hiddenCards.push(card); }
        });

        const more = document.getElementById("updatesMore");
        if (more && hiddenCards.length) {
            more.hidden = false;
            more.querySelector("button").addEventListener("click", () => {
                hiddenCards.forEach(c => { c.hidden = false; reveal(c); });
                more.hidden = true;
            });
        }

        section.hidden = false;
        const divider = document.getElementById("updatesDivider");
        const navItem = document.getElementById("navUpdates");
        if (divider) divider.hidden = false;
        if (navItem) navItem.hidden = false;
    }

    /* ---- Load everything ---- */
    Promise.all(["notice", "contact", "pricing", "updates"].map(load)).then(([notice, contact, pricing, updates]) => {
        applyNotice(notice);
        applyContact(contact);
        applyPricing(pricing);
        applyUpdates(updates);
    });
})();
