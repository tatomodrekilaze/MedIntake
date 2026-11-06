/* MedIntake — clinician case review.

   Layout of this file:
     - small helpers and the render functions. These return HTML strings and
       don't touch the DOM, so they can be run (and tested) under Node.
     - createApi(): a thin fetch wrapper for /api/review/*.
     - createWorkspace(): everything that touches the page. Only runs when
       #review-app exists.

   Anything that comes back from the API goes through esc() before it is put
   into HTML. Patient answers are free text, so never skip that. */
(function (root) {
  "use strict";

  const LANGS = ["ka", "en"];
  const POLL_MS = 2500;
  const POLL_LIMIT_MS = 90000;
  const AUTOSAVE_MS = 800;
  const REFRESH_MS = 20000;
  const LANG_KEY = "medintake_review_lang";
  const FILTERS = ["attention", "new", "in_review", "reviewed", "all"];
  const SAFETY_LEVELS = ["emergency", "urgent", "routine"];
  const WEIGHTS = { stronger: 3, possible: 2, less_likely: 1 };
  const ACTION_KINDS = ["safety", "history", "exam", "records", "investigation", "interpret", "monitor", "decision"];
  const ENUM_KINDS = [
    "safety_level",
    "case_status",
    "workflow",
    "review_status",
    "decision_status",
    "assessment_status",
    "weight",
    "action_kind",
    "completion_reason",
    "context_status",
    "result_status",
    "generated_by",
    "role",
  ];

  // --- primitives ---

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

  function str(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
  }

  function esc(value) {
    return str(value).replace(/[&<>"'`]/g, (c) => ESC[c]);
  }

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function obj(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function objs(value) {
    return arr(value).filter((item) => item && typeof item === "object" && !Array.isArray(item));
  }

  function texts(value) {
    return arr(value)
      .map((item) => (typeof item === "string" ? str(item) : str(obj(item).text)))
      .filter(Boolean);
  }

  function normLang(lang) {
    return LANGS.includes(lang) ? lang : "ka";
  }

  function strings(lang) {
    const all = root.REVIEW_I18N || {};
    return obj(all[normLang(lang)]);
  }

  function t(lang, key, vars) {
    let text = strings(lang)[key];
    if (typeof text !== "string") text = strings("ka")[key];
    if (typeof text !== "string") return "";
    if (vars) text = text.replace(/\{(\w+)\}/g, (m, name) => (vars[name] === undefined || vars[name] === null ? "" : String(vars[name])));
    return text;
  }

  function tn(lang, key, n) {
    const one = strings(lang)[key + "_one"];
    if (n === 1 && typeof one === "string") return one;
    return t(lang, key, { n });
  }

  function T(lang, key, vars) {
    return esc(t(lang, key, vars));
  }

  function statusLabel(kind, value, lang) {
    const v = str(value);
    if (!v) return "";
    const map = obj(obj(strings(lang).enums)[kind]);
    if (typeof map[v] === "string") return map[v];
    return t(lang, "enum.unknown");
  }

  function sexLabel(sex, lang) {
    const v = str(sex);
    if (!v) return "";
    if (v.toLowerCase() === "female") return t(lang, "patient.female");
    if (v.toLowerCase() === "male") return t(lang, "patient.male");
    return v;
  }

  function demographics(patient, lang) {
    const p = obj(patient);
    const parts = [];
    if (typeof p.age === "number" && Number.isFinite(p.age)) parts.push(t(lang, "patient.age", { n: p.age }));
    const sex = sexLabel(p.sex, lang);
    if (sex) parts.push(sex);
    return parts.join(" · ");
  }

  function maskId(id) {
    const s = str(id);
    if (!s) return "";
    const tail = s.length > 6 ? s.slice(-3) : "";
    return "•".repeat(Math.max(4, s.length - tail.length)) + tail;
  }

  function can(session) {
    const s = obj(session);
    const perms = new Set(arr(s.permissions).map(str));
    const clinical = perms.has("clinical:read") && s.role !== "CLINIC_STAFF";
    return {
      cases: perms.has("cases:read"),
      clinical,
      decision: clinical && perms.has("decision:write"),
      workflow: perms.has("workflow:write"),
    };
  }

  function parseTime(iso) {
    const ms = Date.parse(str(iso));
    return Number.isFinite(ms) ? ms : null;
  }

  function timeAgo(iso, lang, now) {
    const ms = parseTime(iso);
    if (ms === null) return "";
    const minutes = Math.max(0, (typeof now === "number" ? now : Date.now()) - ms) / 60000;
    if (minutes < 1) return t(lang, "time.just");
    if (minutes < 60) return t(lang, "time.min", { n: Math.floor(minutes) });
    if (minutes < 1440) return t(lang, "time.hour", { n: Math.floor(minutes / 60) });
    return t(lang, "time.day", { n: Math.floor(minutes / 1440) });
  }

  function formatTime(iso, lang) {
    const ms = parseTime(iso);
    if (ms === null) return "";
    try {
      return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ka-GE", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(ms));
    } catch (e) {
      return new Date(ms).toISOString().slice(0, 16).replace("T", " ");
    }
  }

  function timeTag(iso, text) {
    const ms = parseTime(iso);
    if (ms === null || !text) return "";
    return `<time datetime="${esc(new Date(ms).toISOString())}">${esc(text)}</time>`;
  }

  function truncate(text, max) {
    const s = str(text);
    if (s.length <= max) return s;
    return s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  }

  // --- icons ---

  const ICON_PATHS = {
    emergency: '<path d="M7 2.5h6l4.5 4.5v6L13 17.5H7L2.5 13V7z"/><path d="M10 6.2v4.6"/><circle cx="10" cy="13.6" r=".9" fill="currentColor" stroke="none"/>',
    urgent: '<path d="M10 3 18 16.8H2z"/><path d="M10 8v4"/><circle cx="10" cy="14.4" r=".9" fill="currentColor" stroke="none"/>',
    routine: '<circle cx="10" cy="10" r="7.3"/><path d="m6.7 10.3 2.2 2.2 4.4-4.6"/>',
    unknown: '<circle cx="10" cy="10" r="7.3"/><path d="M6.8 10h6.4"/>',
    ai: '<path d="M10 2.8 11.5 7l4.2 1.5-4.2 1.5L10 14.2 8.5 10 4.3 8.5 8.5 7z" fill="currentColor" stroke="none"/><path d="M15.4 12.6l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="currentColor" stroke="none"/>',
    human: '<path d="M4 16l.9-3.6L12.6 4.7l2.7 2.7-7.7 7.7z"/><path d="M11 6.3l2.7 2.7"/>',
    back: '<path d="M12 4.5 6.5 10l5.5 5.5"/>',
    search: '<circle cx="8.7" cy="8.7" r="5.2"/><path d="m12.6 12.6 4 4"/>',
    plus: '<path d="M10 5v10M5 10h10"/>',
    minus: '<path d="M5 10h10"/>',
    question: '<circle cx="10" cy="10" r="7.3"/><path d="M8 8a2 2 0 1 1 2.8 1.8c-.6.3-.8.7-.8 1.3v.4"/><circle cx="10" cy="14" r=".8" fill="currentColor" stroke="none"/>',
    arrow: '<path d="M4 10h11M11 6l4 4-4 4"/>',
    chevron: '<path d="m7 5 5 5-5 5"/>',
    lock: '<rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>',
    external: '<path d="M11 4h5v5"/><path d="M16 4 9 11"/><path d="M14 12v3.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5H8"/>',
    contradiction: '<path d="M4 6h9l-3-3M16 14H7l3 3"/>',
    check: '<path d="m5 10.5 3.2 3.2L15 6.8"/>',
    eye: '<path d="M2.5 10S5.2 4.8 10 4.8 17.5 10 17.5 10 14.8 15.2 10 15.2 2.5 10 2.5 10z"/><circle cx="10" cy="10" r="2.3"/>',
    logout: '<path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/><path d="M12 6.5 15.5 10 12 13.5M15.5 10H8"/>',
    flask: '<path d="M8 3h4M8.6 3v5L4.4 15a1.3 1.3 0 0 0 1.1 2h9a1.3 1.3 0 0 0 1.1-2l-4.2-7V3"/><path d="M6.4 12.5h7.2"/>',
    steth: '<path d="M5 3v4a4 4 0 0 0 8 0V3"/><path d="M9 11v1.5a3.5 3.5 0 0 0 7 0v-1"/><circle cx="16" cy="10" r="1.6"/>',
  };

  function icon(name, cls) {
    const path = ICON_PATHS[name];
    if (!path) return "";
    return `<svg class="ic${cls ? " " + cls : ""}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
  }

  const BRAND_MARK =
    '<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z" fill="currentColor"/></svg></span>';

  function safetyKey(level) {
    const v = str(level);
    return SAFETY_LEVELS.includes(v) ? v : "unknown";
  }

  function safetyTag(level, lang, extraClass) {
    const v = str(level);
    if (!v) return "";
    const k = safetyKey(v);
    return `<span class="safety-tag safety-${k}${extraClass ? " " + extraClass : ""}">${icon(k)}<span>${esc(statusLabel("safety_level", v, lang))}</span></span>`;
  }

  function pill(kind, value, lang, prefix) {
    const label = statusLabel(kind, value, lang);
    if (!label) return "";
    const v = str(value).toLowerCase().replace(/[^a-z_]/g, "");
    return `<span class="pill pill-${kind} is-${v || "unknown"}">${prefix ? `<span class="visually-hidden">${esc(prefix)} </span>` : ""}${esc(label)}</span>`;
  }

  // --- queue logic ---

  function isPinned(c) {
    const s = obj(c);
    return s.workflow !== "reviewed" && (s.status === "escalated" || s.requires_escalation === true);
  }

  function needsAttention(c) {
    const s = obj(c);
    return (
      s.workflow !== "reviewed" &&
      (s.status === "escalated" || s.requires_escalation === true || s.safety_level === "emergency" || s.safety_level === "urgent")
    );
  }

  function matchesFilter(c, filter) {
    const s = obj(c);
    switch (filter) {
      case "attention":
        return needsAttention(s);
      case "new":
        return s.workflow === "new";
      case "in_review":
        return s.workflow === "in_review";
      case "reviewed":
        return s.workflow === "reviewed";
      default:
        return true;
    }
  }

  function matchesQuery(c, query) {
    const q = str(query).toLowerCase();
    if (!q) return true;
    const s = obj(c);
    const p = obj(s.patient);
    const hay = [p.name, s.complaint, s.case_id].map((v) => str(v).toLowerCase()).join("\n");
    if (hay.includes(q)) return true;
    const pid = str(p.personal_id).toLowerCase();
    if (pid && pid.includes(q.replace(/\s+/g, ""))) return true;
    const digits = q.replace(/\D/g, "");
    return digits.length >= 3 && pid.replace(/\D/g, "").includes(digits);
  }

  function caseTime(c) {
    const s = obj(c);
    const v = parseTime(s.submitted_at);
    if (v !== null) return v;
    const created = parseTime(s.created_at);
    if (created !== null) return created;
    return parseTime(s.updated_at) || 0;
  }

  function sortCases(cases) {
    const rank = { emergency: 0, urgent: 1 };
    return objs(cases)
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const pin = Number(isPinned(b.c)) - Number(isPinned(a.c));
        if (pin) return pin;
        if (isPinned(a.c)) {
          const ra = rank[a.c.safety_level] ?? 2;
          const rb = rank[b.c.safety_level] ?? 2;
          if (ra !== rb) return ra - rb;
        }
        return caseTime(b.c) - caseTime(a.c) || a.i - b.i;
      })
      .map((x) => x.c);
  }

  function filterCases(cases, filter, query) {
    return sortCases(cases).filter((c) => matchesFilter(c, filter) && matchesQuery(c, query));
  }

  function queueCounts(cases) {
    const counts = {};
    const list = objs(cases);
    for (const f of FILTERS) counts[f] = list.filter((c) => matchesFilter(c, f)).length;
    return counts;
  }

  // --- shell renders ---

  function renderTopbar(session, lang, opts) {
    const o = obj(opts);
    const s = obj(session);
    const authed = s.authenticated === true;
    const role = authed ? statusLabel("role", s.role, lang) : "";
    const badges = [];
    if (authed && s.mode === "local-dev") badges.push(`<span class="env-badge">${T(lang, "app.localDev")}</span>`);
    if (o.fixture) badges.push(`<span class="env-badge env-fixture">${T(lang, "app.fixture")}</span>`);
    const langBtn = (code, label) =>
      `<button type="button" class="lang-btn" data-lang="${code}" lang="${code}" aria-pressed="${normLang(lang) === code}">${label}</button>`;
    return `<div class="top-inner">
      <a class="brand" href="#" data-action="home">${BRAND_MARK}<span class="brand-text"><span class="brand-name">${T(lang, "app.product")}</span><span class="brand-sub">${T(lang, "app.workspace")}</span></span></a>
      <div class="top-tools">
        ${badges.join("")}
        ${
          role
            ? `<span class="who"><span class="visually-hidden">${T(lang, "app.signedInAs")} </span><span class="role-badge">${esc(role)}</span>${str(s.name) ? `<span class="who-name">${esc(s.name)}</span>` : ""}</span>`
            : ""
        }
        <div class="lang" role="group" aria-label="${T(lang, "app.language")}">${langBtn("ka", "ქარ")}${langBtn("en", "EN")}</div>
        ${
          authed && s.mode !== "local-dev"
            ? `<button type="button" class="btn btn-quiet btn-sm" data-action="logout">${icon("logout")}<span>${T(lang, "app.logout")}</span></button>`
            : ""
        }
      </div>
    </div>`;
  }

  function renderLogin(lang, opts) {
    const o = obj(opts);
    const error = str(o.error);
    return `<div class="login">
      <div class="login-card">
        ${BRAND_MARK}
        <p class="eyebrow">${T(lang, "login.eyebrow")}</p>
        <h1 class="login-title" id="login-title" tabindex="-1">${T(lang, "login.title")}</h1>
        <p class="login-lead">${T(lang, "login.lead")}</p>
        <form id="login-form" class="login-form" novalidate>
          <label class="field-label" for="login-key">${T(lang, "login.key")}</label>
          <input class="field" id="login-key" name="key" type="password" autocomplete="off" spellcheck="false" autocapitalize="off" required aria-describedby="login-error"${error ? ' aria-invalid="true"' : ""} />
          <p class="field-error" id="login-error" role="alert">${error ? `${icon("urgent")}<span>${esc(error)}</span>` : ""}</p>
          <button type="submit" class="btn btn-primary btn-block"${o.busy ? ' aria-disabled="true" disabled' : ""}>${o.busy ? T(lang, "login.busy") : T(lang, "login.submit")}</button>
        </form>
        <p class="login-foot">${icon("lock")}<span>${T(lang, "login.foot")}</span></p>
      </div>
    </div>`;
  }

  function renderMessage(kind, lang, opts) {
    const o = obj(opts);
    const k = ["unavailable", "forbidden", "notfound", "error"].includes(kind) ? kind : "error";
    const actions = [];
    if (o.retry) actions.push(`<button type="button" class="btn btn-primary" data-action="${esc(o.retry)}">${T(lang, "msg.retry")}</button>`);
    if (o.back) actions.push(`<button type="button" class="btn btn-quiet" data-action="back">${icon("back")}<span>${T(lang, "msg.back")}</span></button>`);
    return `<div class="message message-${k}">
      <span class="message-icon">${icon(k === "forbidden" ? "lock" : "unknown")}</span>
      <h1 class="message-title" tabindex="-1">${T(lang, `msg.${k}.title`)}</h1>
      <p>${T(lang, `msg.${k}.body`)}</p>
      ${actions.length ? `<div class="message-actions">${actions.join("")}</div>` : ""}
    </div>`;
  }

  function renderQueueShell(lang, session) {
    return `<div class="queue-head">
        <div class="queue-intro">
          <h1 class="queue-title" id="queue-title" tabindex="-1">${T(lang, "queue.title")}</h1>
          <p class="queue-lead">${T(lang, "queue.lead")}</p>
        </div>
        <p class="queue-status" id="queue-status"></p>
      </div>
      <div class="queue-tools">
        <div id="queue-filters" class="queue-filters"></div>
        <div class="search">
          <label class="visually-hidden" for="queue-search">${T(lang, "queue.search")}</label>
          ${icon("search", "search-ic")}
          <input class="field search-field" id="queue-search" type="search" autocomplete="off" spellcheck="false" placeholder="${T(lang, "queue.searchPh")}" aria-describedby="queue-keys" />
        </div>
      </div>
      <p class="visually-hidden" id="queue-keys">${T(lang, "queue.keys")}</p>
      <div id="queue-list" class="queue-list"></div>`;
  }

  function renderFilters(counts, active, lang) {
    const c = obj(counts);
    const button = (f) => {
      const n = typeof c[f] === "number" ? c[f] : 0;
      const hot = f === "attention" && n > 0 ? " is-hot" : "";
      return `<button type="button" class="seg-btn${hot}" data-filter="${f}" aria-pressed="${f === active}">${f === "attention" ? icon("urgent") : ""}<span>${T(lang, "filter." + f)}</span><span class="seg-count">${n}</span></button>`;
    };
    return `<div class="seg" role="group" aria-label="${T(lang, "queue.filters")}">${["all", "new", "attention"].map(button).join("")}</div><details class="other-filters"${["in_review", "reviewed"].includes(active) ? " open" : ""}><summary>${lang === "en" ? "Other patients" : "სხვა პაციენტები"}</summary><div class="seg">${["in_review", "reviewed"].map(button).join("")}</div></details>`;
  }

  function renderQueueSkeleton() {
    const row = `<li class="q-item"><div class="q-row q-skel" aria-hidden="true"><span class="skel skel-tag"></span><span class="q-main"><span class="skel skel-line w-40"></span><span class="skel skel-line w-80"></span><span class="skel skel-line w-60"></span></span><span class="q-meta"><span class="skel skel-line w-50"></span></span></div></li>`;
    return `<ul class="q-list q-loading" aria-hidden="true">${row.repeat(4)}</ul>`;
  }

  function renderRow(c, lang, access, now, selectedId) {
    const p = obj(c.patient);
    const id = str(c.case_id);
    const level = str(c.safety_level);
    const k = level ? safetyKey(level) : "none";
    const name = str(p.name) || id;
    const demo = demographics(p, lang);
    const complaint = truncate(c.complaint, 170);
    const when = c.submitted_at || c.created_at;
    const ago = timeAgo(when, lang, now);
    const tags = [];
    if (c.requires_escalation === true) tags.push(`<span class="tag tag-danger">${icon("emergency")}<span>${T(lang, "row.escalation")}</span></span>`);
    if (c.status === "in_progress") tags.push(`<span class="tag tag-info">${esc(statusLabel("case_status", c.status, lang))}</span>`);
    let ai = "";
    if (access.clinical) {
      const assess = statusLabel("assessment_status", c.assessment_status, lang);
      const aiText = assess || (c.review_status && c.review_status !== "ready" ? statusLabel("review_status", c.review_status, lang) : "");
      const leading = str(c.leading_condition);
      if (aiText || leading) {
        ai = `<span class="q-ai">${aiText ? `<span class="ai-chip">${icon("ai")}<span>${esc(aiText)}</span></span>` : ""}${leading ? `<span class="q-leading"><span class="q-leading-k">${T(lang, "row.leading")}</span> ${esc(leading)}</span>` : ""}</span>`;
      }
    }
    const count = typeof c.question_count === "number" ? tn(lang, "row.questions", c.question_count) : "";
    const decision = str(c.decision_status);
    return `<li class="q-item">
      <a class="q-row safety-${k}${isPinned(c) ? " is-pinned" : ""}${id && id === selectedId ? " is-selected" : ""}" href="#case=${esc(encodeURIComponent(id))}" data-case-id="${esc(id)}">
        <span class="q-safety">${safetyTag(level, lang)}</span>
        <span class="q-main">
          <span class="q-title"><span class="q-name">${esc(name)}</span>${demo ? `<span class="q-demo">${esc(demo)}</span>` : ""}</span>
          ${complaint ? `<span class="q-complaint" lang="${esc(normLang(c.language))}">“${esc(complaint)}”</span>` : ""}
          ${tags.length ? `<span class="q-tags">${tags.join("")}</span>` : ""}
        </span>
        <span class="q-meta">
          ${ago ? `<span class="q-time">${timeTag(when, ago)}</span>` : ""}
          <span class="q-pills">${pill("workflow", c.workflow, lang)}${decision && decision !== "none" ? pill("decision_status", decision, lang, t(lang, "row.decision")) : ""}</span>
          <span class="q-open">${lang === "en" ? "Open →" : "გახსნა →"}</span>
        </span>
      </a>
    </li>`;
  }

  function renderEmpty(kind, lang, query) {
    return `<div class="empty">
      <span class="empty-mark" aria-hidden="true">${icon(kind === "none" ? "check" : "search")}</span>
      <h2 class="empty-title">${T(lang, `queue.empty.${kind}.title`)}</h2>
      <p>${T(lang, `queue.empty.${kind}.body`, { q: truncate(query, 60) })}</p>
      ${kind === "none" ? "" : `<button type="button" class="btn btn-quiet" data-action="clear-filters">${T(lang, "queue.clear")}</button>`}
    </div>`;
  }

  function renderQueue(cases, filter, query, opts) {
    const o = obj(opts);
    const lang = normLang(o.lang);
    const access = can(o.session);
    const now = typeof o.now === "number" ? o.now : Date.now();
    if (o.loading) return renderQueueSkeleton();
    const all = objs(cases);
    const f = FILTERS.includes(filter) ? filter : "all";
    const shown = filterCases(all, f, query);
    const warn = o.error ? `<p class="inline-warn" role="status">${icon("urgent")}<span>${T(lang, "queue.refreshError")}</span></p>` : "";
    if (!shown.length) {
      const kind = !all.length ? "none" : str(query) ? "search" : "filter";
      return warn + renderEmpty(kind, lang, query);
    }
    const pinned = shown.filter(isPinned);
    const rest = shown.filter((c) => !isPinned(c));
    const list = (items) => `<ul class="q-list">${items.map((c) => renderRow(c, lang, access, now, str(o.selectedId))).join("")}</ul>`;
    let html = warn;
    if (pinned.length) {
      html += `<section class="q-group q-group-pinned" aria-labelledby="q-pinned-h"><h2 class="q-group-title" id="q-pinned-h">${icon("emergency")}<span>${T(lang, "queue.pinned")}</span><span class="q-group-n">${pinned.length}</span></h2>${list(pinned)}</section>`;
    }
    if (rest.length) {
      const heading = pinned.length
        ? `<h2 class="q-group-title" id="q-rest-h"><span>${T(lang, "queue.others")}</span><span class="q-group-n">${rest.length}</span></h2>`
        : `<h2 class="visually-hidden" id="q-rest-h">${T(lang, "queue.all")}</h2>`;
      html += `<section class="q-group" aria-labelledby="q-rest-h">${heading}${list(rest)}</section>`;
    }
    return html;
  }

  // --- case renders ---

  function buildContext(detail, lang) {
    const d = obj(detail);
    const answers = new Map();
    if (str(d.complaint)) {
      answers.set("chief", { dom: "rv-ans-chief", short: t(lang, "cite.chief"), aria: t(lang, "cite.chiefAria"), title: str(d.complaint) });
    }
    objs(d.answers).forEach((a, i) => {
      const id = str(a.id);
      if (!id || answers.has(id)) return;
      const n = typeof a.n === "number" && Number.isFinite(a.n) ? a.n : i + 1;
      answers.set(id, { dom: `rv-ans-${i}`, short: "#" + n, n, aria: t(lang, "cite.aria", { n, q: truncate(a.question, 90) }), title: str(a.question) });
    });
    return { lang, answers };
  }

  function cites(ids, ctx) {
    const out = [];
    const seen = new Set();
    for (const raw of arr(ids)) {
      const id = str(raw);
      if (!id || seen.has(id)) continue;
      const ref = ctx.answers.get(id);
      if (!ref) continue;
      seen.add(id);
      out.push(`<button type="button" class="cite" data-cite="${esc(ref.dom)}" aria-label="${esc(ref.aria)}" title="${esc(ref.title)}">${esc(ref.short)}</button>`);
    }
    return out.length ? ` <span class="cites" role="group" aria-label="${T(ctx.lang, "cite.group")}">${out.join("")}</span>` : "";
  }

  function citedItems(items, ctx) {
    return arr(items)
      .map((item) => {
        if (typeof item === "string") return str(item) ? { text: str(item), ids: [] } : null;
        const o = obj(item);
        return str(o.text) ? { text: str(o.text), ids: arr(o.source_ids) } : null;
      })
      .filter(Boolean)
      .map((item) => `<li>${esc(item.text)}${cites(item.ids, ctx)}</li>`);
  }

  function reasonGrid(supporting, against, missing, ctx) {
    const lang = ctx.lang;
    const cols = [];
    const sup = citedItems(supporting, ctx);
    const ag = texts(against).map((x) => `<li>${esc(x)}</li>`);
    const mi = texts(missing).map((x) => `<li>${esc(x)}</li>`);
    if (sup.length) cols.push(`<div class="reason reason-for"><h4 class="reason-h">${icon("plus")}<span>${T(lang, "ai.supporting")}</span></h4><ul>${sup.join("")}</ul></div>`);
    if (ag.length) cols.push(`<div class="reason reason-against"><h4 class="reason-h">${icon("minus")}<span>${T(lang, "ai.against")}</span></h4><ul>${ag.join("")}</ul></div>`);
    if (mi.length) cols.push(`<div class="reason reason-missing"><h4 class="reason-h">${icon("question")}<span>${T(lang, "ai.missing")}</span></h4><ul>${mi.join("")}</ul></div>`);
    return cols.length ? `<div class="reason-grid">${cols.join("")}</div>` : "";
  }

  function labelled(label, value, cls) {
    const v = str(value);
    if (!v) return "";
    return `<div class="kv${cls ? " " + cls : ""}"><dt>${esc(label)}</dt><dd>${esc(v)}</dd></div>`;
  }

  function section(id, title, body, o) {
    const opt = obj(o);
    if (!body) return "";
    return `<section class="rv-sec${opt.cls ? " " + opt.cls : ""}" id="sec-${id}" data-section="${id}" aria-labelledby="sec-${id}-h"${opt.lang ? ` lang="${esc(opt.lang)}"` : ""}>
      <h2 class="rv-h" id="sec-${id}-h">${opt.icon ? icon(opt.icon) : ""}<span>${esc(title)}</span>${opt.count ? `<span class="rv-count">${esc(opt.count)}</span>` : ""}</h2>
      ${body}
    </section>`;
  }

  function collapsible(id, title, body, open, o) {
    const opt = obj(o);
    if (!body) return "";
    return `<section class="rv-sec rv-collapsible${opt.cls ? " " + opt.cls : ""}" id="sec-${id}" data-section="${id}"${opt.lang ? ` lang="${esc(opt.lang)}"` : ""}>
      <h2 class="rv-h"><button type="button" class="rv-toggle" id="sec-${id}-h" aria-expanded="${open ? "true" : "false"}" aria-controls="sec-${id}-body" data-toggle="${id}">${icon("chevron", "rv-chev")}<span>${esc(title)}</span>${opt.count ? `<span class="rv-count">${esc(opt.count)}</span>` : ""}</button></h2>
      <div class="rv-collapse-body" id="sec-${id}-body" role="region" aria-labelledby="sec-${id}-h"${open ? "" : " hidden"}>${body}</div>
    </section>`;
  }

  function renderSafetyBanner(d, rv, access, lang, opts) {
    const safety = rv ? obj(rv.safety) : {};
    const level = str(safety.level) || str(d.safety_level);
    const escalate = safety.requires_escalation === true || d.requires_escalation === true;
    if ((!level || level === "routine") && !escalate) return "";
    const k = level && level !== "routine" ? safetyKey(level) : "unknown";
    const titleKey = k === "emergency" || k === "urgent" ? `safety.title.${k}` : "safety.title.other";
    const items = rv && access.clinical ? objs(safety.items).filter((i) => str(i.title) || str(i.why) || str(i.action)) : [];
    const list = items.length
      ? `<ul class="safety-items"${rv ? ` lang="${esc(normLang(rv.language))}"` : ""}>${items
          .map(
            (i) => `<li class="safety-item">${str(i.title) ? `<p class="safety-item-title">${esc(i.title)}</p>` : ""}${
              str(i.why) ? `<p><span class="safety-k">${T(lang, "safety.why")}:</span> ${esc(i.why)}</p>` : ""
            }${str(i.action) ? `<p class="safety-act"><span class="safety-k">${T(lang, "safety.action")}:</span> ${esc(i.action)}</p>` : ""}</li>`
          )
          .join("")}</ul>`
      : "";
    const actions = [];
    if (rv && access.clinical && objs(rv.action_plan).length) actions.push(`<a class="btn btn-sm btn-on-alert" href="#sec-plan" data-jump="sec-plan">${T(lang, "safety.toPlan")}</a>`);
    if (rv && access.clinical && objs(rv.dangerous_alternatives).length) actions.push(`<a class="btn btn-sm btn-quiet-alert" href="#sec-dangerous" data-jump="sec-dangerous">${T(lang, "safety.toDanger")}</a>`);
    return `<section class="safety-banner safety-${k}" data-section="safety" aria-labelledby="safety-h"${opts.alert ? ' role="alert"' : ""}>
      <span class="safety-banner-ic">${icon(k === "unknown" ? "urgent" : k)}</span>
      <div class="safety-banner-body">
        <h2 class="safety-banner-title" id="safety-h">${T(lang, titleKey)}</h2>
        <p class="safety-banner-tags">${safetyTag(level, lang, "on-alert")}${escalate ? `<span class="tag tag-danger">${T(lang, "safety.escalation")}</span>` : ""}</p>
        ${list}
        ${!access.clinical ? `<p class="safety-staff">${T(lang, "safety.staff")}</p>` : ""}
        ${actions.length ? `<p class="safety-actions">${actions.join("")}</p>` : ""}
      </div>
    </section>`;
  }

  function pidBlock(pid, lang, compact) {
    const id = str(pid);
    if (!id) return "";
    return `<span class="pid${compact ? " pid-compact" : ""}"><span class="pid-value" data-pid>${esc(maskId(id))}</span><button type="button" class="pid-btn" data-action="reveal-id" aria-pressed="false" aria-label="${T(lang, "case.revealLabel")}">${icon("eye")}<span class="pid-btn-text">${T(lang, "case.reveal")}</span></button></span>`;
  }

  function renderCaseBar(detail, session, opts) {
    const d = obj(detail);
    const lang = normLang(obj(opts).lang);
    const p = obj(d.patient);
    return `<div class="case-bar-inner">
      <button type="button" class="btn btn-quiet btn-sm back-btn" data-action="back" aria-label="${T(lang, "case.backLong")}">${icon("back")}<span>${T(lang, "case.back")}</span></button>
      <span class="case-bar-name">${esc(str(p.name) || str(d.case_id))}</span>
      <span class="case-bar-tags">${safetyTag(d.safety_level, lang)}${pill("workflow", d.workflow, lang, t(lang, "case.workflow"))}</span>
    </div>`;
  }

  function renderCaseHeader(d, access, lang) {
    const p = obj(d.patient);
    const demo = demographics(p, lang);
    const interview = obj(d.interview);
    const qCount = typeof interview.question_count === "number" ? interview.question_count : d.question_count;
    const reason = str(interview.completion_reason) || str(d.completion_reason);
    const reasonLabel = reason
      ? (obj(obj(strings(lang).enums).completion_reason)[reason] || str(interview.completion_label) || t(lang, "enum.unknown"))
      : str(interview.completion_label);
    const interviewText = [typeof qCount === "number" ? tn(lang, "case.questions", qCount) : "", reasonLabel].filter(Boolean).join(" · ");
    const submitted = d.submitted_at ? `${timeTag(d.submitted_at, formatTime(d.submitted_at, lang))}` : esc(t(lang, "case.notSubmitted"));
    let wfAction = "";
    if (access.workflow) {
      wfAction =
        d.workflow === "reviewed"
          ? `<button type="button" class="btn btn-quiet btn-sm" data-action="workflow" data-value="in_review">${T(lang, "case.reopen")}</button>`
          : `<button type="button" class="btn btn-quiet btn-sm" data-action="workflow" data-value="reviewed">${icon("check")}<span>${T(lang, "case.markReviewed")}</span></button>`;
    }
    return `<header class="case-head" data-section="header">
      <p class="case-eyebrow"><span>${T(lang, "case.idLabel")} ${esc(d.case_id)}</span>${pill("case_status", d.status, lang)}</p>
      <h1 class="case-name" id="case-title" tabindex="-1">${esc(str(p.name) || str(d.case_id))}</h1>
      <p class="case-demo">${demo ? `<span>${esc(demo)}</span>` : ""}${str(p.personal_id) ? `<span class="case-pid"><span class="case-pid-k">${T(lang, "case.pid")}</span> ${pidBlock(p.personal_id, lang)}</span>` : ""}</p>
      ${
        str(d.complaint)
          ? `<figure class="complaint"><figcaption class="complaint-k">${T(lang, "case.complaint")}</figcaption><blockquote lang="${esc(normLang(d.language))}"><p>“${esc(d.complaint)}”</p></blockquote></figure>`
          : ""
      }
      ${d.status === "in_progress" ? `<p class="inline-info">${icon("unknown")}<span>${T(lang, "case.inProgress")}</span></p>` : ""}
      <dl class="case-facts">
        <div class="kv"><dt>${T(lang, "case.submitted")}</dt><dd>${submitted}</dd></div>
        ${interviewText ? `<div class="kv"><dt>${T(lang, "case.interview")}</dt><dd>${esc(interviewText)}</dd></div>` : ""}
        <div class="kv kv-wf"><dt>${T(lang, "case.workflow")}</dt><dd>${pill("workflow", d.workflow, lang) || esc(t(lang, "enum.unknown"))}${wfAction}</dd></div>
      </dl>
    </header>`;
  }

  function renderSynthesisState(status, lang, opts, d) {
    const o = obj(opts);
    const gen = obj(o.gen);
    if (gen.active || status === "generating") {
      return `<section class="rv-sec syn syn-generating" data-section="synthesis" aria-labelledby="syn-h" aria-busy="${gen.slow ? "false" : "true"}">
        <span class="syn-orb" aria-hidden="true"><span></span></span>
        <h2 class="syn-title" id="syn-h">${T(lang, "syn.generating.title")}</h2>
        <p class="syn-body">${gen.slow ? T(lang, "syn.slow") : T(lang, "syn.generating.body")}</p>
        ${gen.slow ? `<button type="button" class="btn btn-quiet" data-action="poll-again">${T(lang, "syn.check")}</button>` : ""}
        <div class="syn-skel" aria-hidden="true"><span class="skel skel-line w-80"></span><span class="skel skel-line w-60"></span><span class="skel skel-line w-70"></span></div>
      </section>`;
    }
    const failed = status === "failed" || gen.error === "failed";
    const forbidden = gen.error === "forbidden";
    const title = failed ? "syn.failed.title" : "syn.notStarted.title";
    const body = forbidden ? "syn.forbidden" : failed ? "syn.failed.body" : "syn.notStarted.body";
    return `<section class="rv-sec syn ${failed ? "syn-failed" : "syn-idle"}" data-section="synthesis" aria-labelledby="syn-h">
      <span class="syn-mark" aria-hidden="true">${icon(failed ? "urgent" : "ai")}</span>
      <h2 class="syn-title" id="syn-h">${T(lang, title)}</h2>
      <p class="syn-body">${T(lang, body)}</p>
      ${obj(d).status === "in_progress" ? `<p class="syn-note">${T(lang, "case.inProgress")}</p>` : ""}
      ${forbidden ? "" : `<button type="button" class="btn btn-ai" data-action="generate">${icon("ai")}<span>${T(lang, failed ? "syn.retry" : "syn.generate")}</span></button>`}
    </section>`;
  }

  function renderLangNotice(rv, lang, opts) {
    const gen = obj(obj(opts).gen);
    const rvLang = str(rv.language);
    if (!rvLang || rvLang === normLang(lang)) {
      return gen.active ? `<p class="lang-notice" role="status">${T(lang, "syn.langPending")}</p>` : "";
    }
    if (gen.active) {
      return `<p class="lang-notice is-busy" role="status"><span class="dot-pulse" aria-hidden="true"></span><span>${T(lang, "syn.langPending")}</span></p>`;
    }
    const failed = gen.error ? `<span class="lang-notice-err">${T(lang, "syn.langFailed")}</span>` : "";
    return `<p class="lang-notice">${icon("unknown")}<span>${T(lang, "syn.langNotice")}</span>${failed}<button type="button" class="btn btn-quiet btn-sm" data-action="generate">${T(lang, "syn.langAction")}</button></p>`;
  }

  function secSummary(rv, lang) {
    const headline = str(rv.headline);
    const summary = str(rv.executive_summary);
    if (!headline && !summary) return "";
    const when = formatTime(rv.generated_at, lang);
    const by = statusLabel("generated_by", rv.generated_by, lang);
    const meta = [when ? t(lang, "ai.meta", { t: when }) : "", by].filter(Boolean).join(" · ");
    return section(
      "summary",
      t(lang, "sec.summary"),
      `${headline ? `<p class="headline">${esc(headline)}</p>` : ""}${summary ? `<p class="exec">${esc(summary)}</p>` : ""}${meta ? `<p class="ai-meta">${icon("ai")}<span>${esc(meta)}</span></p>` : ""}`,
      { cls: "card card-summary" }
    );
  }

  function secAssessment(rv, ctx) {
    const lang = ctx.lang;
    const a = obj(rv.assessment);
    const statusText = statusLabel("assessment_status", a.status, lang);
    const statement = str(a.statement);
    const lead = obj(a.leading);
    const hasLead = !!(str(lead.condition) || str(lead.why));
    if (!statusText && !statement && !hasLead) return "";
    const leadHtml = hasLead
      ? `<div class="leading">
          <p class="leading-k">${T(lang, "ai.leading")}</p>
          ${str(lead.condition) ? `<h3 class="leading-name">${esc(lead.condition)}</h3>` : ""}
          ${str(lead.why) ? `<p class="leading-why"><span class="kv-inline">${T(lang, "ai.why")}:</span> ${esc(lead.why)}</p>` : ""}
          ${reasonGrid(lead.supporting, lead.against, lead.missing, ctx)}
        </div>`
      : "";
    return section(
      "assessment",
      t(lang, "sec.assessment"),
      `<p class="ai-flag">${icon("ai")}<span>${T(lang, "ai.badge")}</span></p>
       ${statusText ? `<p class="assess-status"><span class="pill pill-ai">${esc(statusText)}</span></p>` : ""}
       ${statement ? `<p class="assess-statement">${esc(statement)}</p>` : ""}
       ${leadHtml}`,
      { cls: "card card-ai" }
    );
  }

  function branchRows(branches, lang) {
    const rows = objs(branches)
      .filter((b) => str(b.if) || str(b.then))
      .map(
        (b) => `<li class="branch">
          <span class="branch-if"><span class="branch-k">${T(lang, "plan.if")}</span>${esc(b.if)}</span>
          <span class="branch-arrow" aria-hidden="true">${icon("arrow")}</span>
          <span class="branch-then"><span class="branch-k">${T(lang, "plan.then")}</span>${esc(b.then)}</span>
        </li>`
      );
    return rows.length ? `<ul class="branches">${rows.join("")}</ul>` : "";
  }

  function secPlan(rv, ctx) {
    const lang = ctx.lang;
    const steps = objs(rv.action_plan)
      .filter((s) => str(s.title) || str(s.detail))
      .map((s, i) => ({ s, i, n: Number.isInteger(s.step) && s.step > 0 ? s.step : i + 1 }))
      .sort((a, b) => a.n - b.n || a.i - b.i);
    if (!steps.length) return "";
    const items = steps.map(({ s }, idx) => {
      const n = idx + 1;
      const kind = ACTION_KINDS.includes(s.kind) ? s.kind : "other";
      const kindLabel = statusLabel("action_kind", s.kind, lang);
      return `<li class="step kind-${kind}">
        <span class="step-num" aria-hidden="true">${n}</span>
        <div class="step-body">
          ${kindLabel ? `<p class="step-kind">${esc(kindLabel)}</p>` : ""}
          <h3 class="step-title"><span class="visually-hidden">${T(lang, "plan.step", { n })}: </span>${esc(str(s.title) || str(s.detail))}</h3>
          ${str(s.title) && str(s.detail) ? `<p class="step-detail">${esc(s.detail)}</p>` : ""}
          ${str(s.why) ? `<p class="step-why"><span class="kv-inline">${T(lang, "plan.why")}:</span> ${esc(s.why)}</p>` : ""}
          ${branchRows(s.branches, lang)}
        </div>
      </li>`;
    });
    return section("plan", t(lang, "sec.plan"), `<ol class="stepper">${items.join("")}</ol>`, { count: String(steps.length) });
  }

  function secInvestigations(rv, ctx) {
    const lang = ctx.lang;
    const items = objs(rv.investigations).filter((x) => str(x.name));
    if (!items.length) return "";
    const cards = items.map((x) => {
      const result = statusLabel("result_status", x.result_status || "not_available", lang);
      const pos = str(x.if_positive);
      const neg = str(x.if_negative);
      return `<li class="inv-card">
        <h3 class="inv-name">${icon("flask")}<span>${esc(x.name)}</span></h3>
        ${str(x.clinical_question) ? `<p class="inv-q"><span class="inv-q-k">${T(lang, "inv.question")}</span>${esc(x.clinical_question)}</p>` : ""}
        <dl class="inv-dl">
          ${labelled(t(lang, "inv.why"), x.why)}
          ${labelled(t(lang, "inv.evaluates"), x.evaluates)}
          <div class="kv"><dt>${T(lang, "inv.result")}</dt><dd><span class="result-pill">${icon("unknown")}<span>${esc(result)}</span></span></dd></div>
        </dl>
        ${
          pos || neg
            ? `<div class="inv-split">${pos ? `<div class="inv-pos"><p class="inv-split-k">${icon("plus")}<span>${T(lang, "inv.ifPositive")}</span></p><p>${esc(pos)}</p></div>` : ""}${
                neg ? `<div class="inv-neg"><p class="inv-split-k">${icon("minus")}<span>${T(lang, "inv.ifNegative")}</span></p><p>${esc(neg)}</p></div>` : ""
              }</div>`
            : ""
        }
        ${str(x.branch) ? `<p class="inv-branch">${icon("arrow")}<span><span class="kv-inline">${T(lang, "inv.branch")}:</span> ${esc(x.branch)}</span></p>` : ""}
      </li>`;
    });
    return section("investigations", t(lang, "sec.investigations"), `<ul class="inv-grid">${cards.join("")}</ul>`, { count: String(items.length) });
  }

  function secChanges(rv, ctx) {
    const lang = ctx.lang;
    const rows = objs(rv.decision_changes).filter((x) => str(x.finding));
    if (!rows.length) return "";
    const h = [t(lang, "ch.finding"), t(lang, "ch.differential"), t(lang, "ch.urgency"), t(lang, "ch.next")];
    const body = rows
      .map(
        (x) => `<tr>
          <th scope="row" data-label="${esc(h[0])}">${esc(x.finding)}</th>
          <td data-label="${esc(h[1])}">${esc(x.differential_effect) || "<span class=\"muted\">—</span>"}</td>
          <td data-label="${esc(h[2])}">${esc(x.urgency_effect) || "<span class=\"muted\">—</span>"}</td>
          <td data-label="${esc(h[3])}">${esc(x.next_action) || "<span class=\"muted\">—</span>"}</td>
        </tr>`
      )
      .join("");
    return section(
      "changes",
      t(lang, "sec.changes"),
      `<div class="dc-wrap"><table class="dc-table"><caption class="visually-hidden">${T(lang, "sec.changes")}</caption><thead><tr>${h.map((x) => `<th scope="col">${esc(x)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`
    );
  }

  function weightTag(weight, lang) {
    const label = statusLabel("weight", weight, lang);
    if (!label) return "";
    const level = WEIGHTS[weight] || 0;
    const dots = [1, 2, 3].map((i) => `<i class="${i <= level ? "on" : ""}"></i>`).join("");
    return `<span class="weight weight-${level}"><span class="weight-dots" aria-hidden="true">${dots}</span><span>${esc(label)}</span></span>`;
  }

  function secDifferential(rv, ctx) {
    const lang = ctx.lang;
    const items = objs(rv.differential).filter((x) => str(x.condition));
    if (!items.length) return "";
    const cards = items.map(
      (x) => `<li class="dx-card">
        <div class="dx-top"><h3 class="dx-name">${esc(x.condition)}</h3>${weightTag(x.weight, lang)}</div>
        ${str(x.why) ? `<p class="dx-why">${esc(x.why)}</p>` : ""}
        ${reasonGrid(x.supporting, x.against, x.missing, ctx)}
      </li>`
    );
    return section("differential", t(lang, "sec.differential"), `<ul class="dx-list">${cards.join("")}</ul>`, { count: String(items.length) });
  }

  function secDangerous(rv, ctx) {
    const lang = ctx.lang;
    const items = objs(rv.dangerous_alternatives).filter((x) => str(x.condition));
    if (!items.length) return "";
    const cards = items.map((x) => {
      const sup = citedItems(x.supporting, ctx);
      const unknown = texts(x.unknown);
      return `<li class="dz-card">
        <h3 class="dz-name">${icon("urgent")}<span>${esc(x.condition)}</span></h3>
        <dl class="dz-dl">
          ${labelled(t(lang, "dz.matters"), x.why_it_matters)}
          ${str(x.why_here) || sup.length ? `<div class="kv"><dt>${T(lang, "dz.here")}</dt><dd>${esc(x.why_here)}${sup.length ? `<ul class="dz-sup">${sup.join("")}</ul>` : ""}</dd></div>` : ""}
          ${unknown.length ? `<div class="kv"><dt>${T(lang, "dz.unknown")}</dt><dd><ul class="dz-unknown">${unknown.map((u) => `<li>${esc(u)}</li>`).join("")}</ul></dd></div>` : ""}
        </dl>
        ${str(x.what_to_check) ? `<div class="dz-check"><p class="dz-check-k">${icon("check")}<span>${T(lang, "dz.check")}</span></p><p>${esc(x.what_to_check)}</p></div>` : ""}
        ${str(x.investigation) ? `<p class="dz-inv"><span class="kv-inline">${T(lang, "dz.investigation")}:</span> ${esc(x.investigation)}</p>` : ""}
      </li>`;
    });
    return section("dangerous", t(lang, "sec.dangerous"), `<ul class="dz-list">${cards.join("")}</ul>`, { cls: "sec-danger", count: String(items.length) });
  }

  function secDiscriminators(rv, ctx) {
    const lang = ctx.lang;
    const items = objs(rv.discriminators).filter((x) => str(x.question));
    if (!items.length) return "";
    const rows = items.map((x) => {
      const sep = texts(x.separates);
      return `<li class="disc">
        <p class="disc-q">${esc(x.question)}</p>
        ${sep.length ? `<p class="disc-sep"><span class="kv-inline">${T(lang, "disc.separates")}:</span> ${sep.map((s) => `<span class="disc-chip">${esc(s)}</span>`).join('<span class="disc-vs" aria-hidden="true">/</span>')}</p>` : ""}
        ${str(x.why) ? `<p class="disc-why">${esc(x.why)}</p>` : ""}
      </li>`;
    });
    return section("discriminators", t(lang, "sec.discriminators"), `<ol class="disc-list">${rows.join("")}</ol>`);
  }

  function secPicture(rv, ctx) {
    const lang = ctx.lang;
    const cp = obj(rv.clinical_picture);
    const parts = [];
    const timeline = objs(cp.timeline).filter((x) => str(x.what));
    if (timeline.length) {
      parts.push(`<div class="pic-block pic-timeline"><h3 class="pic-h">${T(lang, "pic.timeline")}</h3><ol class="timeline">${timeline
        .map((x) => `<li><span class="tl-when">${esc(x.when)}</span><span class="tl-what">${esc(x.what)}${cites(x.source_ids, ctx)}</span></li>`)
        .join("")}</ol></div>`);
    }
    const pos = citedItems(cp.key_positives, ctx);
    const neg = citedItems(cp.key_negatives, ctx);
    if (pos.length || neg.length) {
      parts.push(`<div class="pic-pair">${pos.length ? `<div class="pic-block pic-pos"><h3 class="pic-h">${icon("plus")}<span>${T(lang, "pic.positives")}</span></h3><ul class="pic-list">${pos.join("")}</ul></div>` : ""}${
        neg.length ? `<div class="pic-block pic-neg"><h3 class="pic-h">${icon("minus")}<span>${T(lang, "pic.negatives")}</span></h3><ul class="pic-list">${neg.join("")}</ul></div>` : ""
      }</div>`);
    }
    const unknowns = objs(cp.unknowns).filter((x) => str(x.text));
    if (unknowns.length) {
      parts.push(`<div class="pic-block pic-unknown"><h3 class="pic-h">${icon("question")}<span>${T(lang, "pic.unknowns")}</span></h3><ul class="pic-list">${unknowns
        .map((x) => `<li><span class="unk-text">${esc(x.text)}</span>${str(x.why_it_matters) ? `<span class="unk-why">${esc(x.why_it_matters)}</span>` : ""}</li>`)
        .join("")}</ul></div>`);
    }
    const contra = objs(cp.contradictions).filter((x) => str(x.text));
    if (contra.length) {
      parts.push(`<div class="pic-block pic-contra"><h3 class="pic-h">${icon("contradiction")}<span>${T(lang, "pic.contradictions")}</span></h3><ul class="contra-list">${contra
        .map((x) => `<li class="contra"><span class="contra-tag">${T(lang, "pic.contradiction")}</span><span>${esc(x.text)}${cites(x.source_ids, ctx)}</span></li>`)
        .join("")}</ul></div>`);
    }
    return parts.length ? section("picture", t(lang, "sec.picture"), parts.join("")) : "";
  }

  function secWorkup(rv, lang) {
    const groups = [
      ["work.exam", objs(rv.exam_priorities).map((x) => [x.exam, x.why])],
      ["work.records", objs(rv.records_to_review).map((x) => [x.record, x.why])],
      ["work.monitoring", objs(rv.monitoring).map((x) => [x.what, x.why])],
      ["work.specialist", objs(rv.specialist).map((x) => [x.specialty, x.why])],
    ]
      .map(([key, rows]) => [key, rows.filter(([a]) => str(a))])
      .filter(([, rows]) => rows.length);
    if (!groups.length) return "";
    const html = groups
      .map(
        ([key, rows]) => `<div class="work-block"><h3 class="pic-h">${T(lang, key)}</h3><ul class="work-list">${rows
          .map(([a, b]) => `<li><span class="work-a">${esc(a)}</span>${str(b) ? `<span class="work-b">${esc(b)}</span>` : ""}</li>`)
          .join("")}</ul></div>`
      )
      .join("");
    return section("workup", t(lang, "sec.workup"), `<div class="work-grid">${html}</div>`);
  }

  function safeUrl(url) {
    const u = str(url);
    return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : "";
  }

  function secEvidence(rv, lang) {
    const items = objs(rv.evidence).filter((x) => str(x.title) || str(x.source));
    if (!items.length) return section("evidence", t(lang, "sec.evidence"), `<p class="empty-inline">${T(lang, "ev.none")}</p>`);
    const rows = items.map((x) => {
      const url = safeUrl(x.url);
      const title = esc(str(x.title) || str(x.source));
      const link = url
        ? `<a class="ev-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${title}${icon("external")}<span class="visually-hidden"> ${T(lang, "ev.newTab")}</span></a>`
        : `<span class="ev-link">${title}</span>`;
      return `<li class="ev">${link}${str(x.source) && str(x.title) ? `<span class="ev-src">${esc(x.source)}</span>` : ""}${
        str(x.supports) ? `<p class="ev-sup"><span class="kv-inline">${T(lang, "ev.supports")}:</span> ${esc(x.supports)}</p>` : ""
      }</li>`;
    });
    return section("evidence", t(lang, "sec.evidence"), `<ul class="ev-list">${rows.join("")}</ul>`);
  }

  function secFootnote(rv, lang) {
    const verify = texts(rv.verification);
    const limits = texts(rv.limitations);
    const dis = objs(rv.disagreements).filter((x) => str(x.topic) || str(x.detail));
    if (!verify.length && !limits.length && !dis.length) return "";
    const blocks = [];
    if (verify.length) blocks.push(`<div class="foot-block"><h3 class="pic-h">${T(lang, "foot.verify")}</h3><ul>${verify.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`);
    if (dis.length)
      blocks.push(`<div class="foot-block"><h3 class="pic-h">${T(lang, "foot.disagreements")}</h3><ul>${dis
        .map((x) => `<li>${str(x.topic) ? `<strong>${esc(x.topic)}</strong>${str(x.detail) ? " — " : ""}` : ""}${esc(x.detail)}</li>`)
        .join("")}</ul></div>`);
    if (limits.length) blocks.push(`<div class="foot-block"><h3 class="pic-h">${T(lang, "foot.limitations")}</h3><ul>${limits.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`);
    return section("footnote", t(lang, "sec.footnote"), `<div class="foot-grid">${blocks.join("")}</div>`, { cls: "sec-foot", lang: normLang(rv.language) });
  }

  function secTranscript(d, ctx, open) {
    const lang = ctx.lang;
    const answers = objs(d.answers);
    const patientLang = normLang(d.language);
    const parts = [];
    if (str(d.complaint)) {
      parts.push(`<div class="qa qa-chief" id="rv-ans-chief" tabindex="-1"><span class="qa-n" aria-hidden="true">${icon("steth")}</span><div class="qa-body"><p class="qa-q">${T(lang, "tr.chief")}</p><p class="qa-a" lang="${patientLang}">${esc(d.complaint)}</p></div></div>`);
    }
    const contra = texts(d.contradictions);
    if (contra.length) {
      parts.push(`<div class="tr-contra"><p class="tr-contra-k">${icon("contradiction")}<span>${T(lang, "tr.inconsistent")}</span></p><ul>${contra.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`);
    }
    if (answers.length) {
      parts.push(`<ol class="qa-list">${answers
        .map((a, i) => {
          const n = typeof a.n === "number" && Number.isFinite(a.n) ? a.n : i + 1;
          return `<li class="qa" id="rv-ans-${i}" tabindex="-1">
            <span class="qa-n" aria-hidden="true">${esc(n)}</span>
            <div class="qa-body">
              <p class="qa-q"><span class="visually-hidden">${esc(n)}. </span>${esc(a.question)}${str(a.topic) ? ` <span class="topic">${esc(a.topic)}</span>` : ""}</p>
              <p class="qa-a" lang="${patientLang}">${esc(a.answer) || '<span class="muted">—</span>'}</p>
              ${str(a.note) ? `<p class="qa-note"><span class="kv-inline">${T(lang, "tr.note")}:</span> ${esc(a.note)}</p>` : ""}
            </div>
          </li>`;
        })
        .join("")}</ol>`);
    } else {
      parts.push(`<p class="empty-inline">${T(lang, "tr.empty")}</p>`);
    }
    if (str(d.final_note)) {
      parts.push(`<div class="tr-final"><p class="qa-q">${T(lang, "tr.final")}</p><p class="qa-a" lang="${patientLang}">${esc(d.final_note)}</p></div>`);
    }
    return collapsible("transcript", t(lang, "sec.transcript"), parts.join(""), open, { count: answers.length ? tn(lang, "tr.answers", answers.length) : "" });
  }

  function secPatient(d, lang, open, access) {
    const p = obj(d.patient);
    const groups = [];
    const pid = str(p.personal_id);
    const identity = [
      labelled(t(lang, "p.name"), p.name),
      labelled(t(lang, "p.father"), p.father_name),
      pid ? `<div class="kv"><dt>${T(lang, "p.pid")}</dt><dd>${pidBlock(pid, lang, true)}</dd></div>` : "",
      labelled(t(lang, "p.dob"), p.dob),
      typeof p.age === "number" ? labelled(t(lang, "p.age"), t(lang, "patient.age", { n: p.age })) : "",
      labelled(t(lang, "p.sex"), sexLabel(p.sex, lang)),
    ].join("");
    if (identity) groups.push(`<div class="pd-block"><h3 class="pic-h">${T(lang, "p.identity")}</h3><dl class="pd-dl">${identity}</dl></div>`);
    const contact = [labelled(t(lang, "p.phone"), p.phone), labelled(t(lang, "p.email"), p.email), labelled(t(lang, "p.address"), p.address), labelled(t(lang, "p.city"), p.city)].join("");
    if (contact) groups.push(`<div class="pd-block"><h3 class="pic-h">${T(lang, "p.contact")}</h3><dl class="pd-dl">${contact}</dl></div>`);
    const ins = labelled(t(lang, "p.insurance"), p.insurance);
    if (ins) groups.push(`<div class="pd-block"><h3 class="pic-h">${T(lang, "p.coverage")}</h3><dl class="pd-dl">${ins}</dl></div>`);
    if (access.clinical) {
      const ctxItems = objs(d.context).filter((x) => str(x.label));
      if (ctxItems.length) {
        groups.push(`<div class="pd-block pd-context"><h3 class="pic-h">${T(lang, "p.context")}</h3><ul class="ctx-list">${ctxItems
          .map((x) => `<li class="ctx is-${esc(str(x.status).replace(/[^a-z_]/g, "") || "unknown")}"><span class="ctx-label">${esc(x.label)}</span>${str(x.value) ? `<span class="ctx-value">${esc(x.value)}</span>` : ""}${
            str(x.status) ? `<span class="ctx-status">${esc(statusLabel("context_status", x.status, lang))}</span>` : ""
          }</li>`)
          .join("")}</ul></div>`);
      }
    }
    const body = groups.length ? `<div class="pd-grid">${groups.join("")}</div>` : `<p class="empty-inline">${T(lang, "p.none")}</p>`;
    return collapsible("patient", t(lang, "sec.patient"), body, open);
  }

  function renderToc(entries, lang) {
    if (entries.length < 3) return "";
    return `<details class="section-finder"><summary>${lang === "en" ? "Find a section" : "ჩანაწერის სექციები"}</summary><nav class="toc" aria-label="${T(lang, "case.toc")}"><ul>${entries
      .map(([id, label]) => `<li><a href="#sec-${id}" data-jump="sec-${id}">${esc(label)}</a></li>`)
      .join("")}</ul></nav></details>`;
  }

  function renderCaseMain(detail, review, session, opts) {
    const d = obj(detail);
    const o = obj(opts);
    const lang = normLang(o.lang);
    const access = can(session);
    const open = o.open instanceof Set ? o.open : new Set(arr(o.open));
    const ctx = buildContext(d, lang);
    const rv = access.clinical && review && typeof review === "object" && !Array.isArray(review) ? review : null;
    const status = str(o.reviewStatus) || (rv ? "ready" : "not_started");
    const out = [];
    out.push(renderSafetyBanner(d, rv, access, lang, { alert: o.alert !== false }));
    out.push(renderCaseHeader(d, access, lang));
    if (access.decision) out.push(`<button class="btn btn-quiet" type="button" data-jump="dec-title">${lang === "en" ? "Write my assessment and plan ↓" : "ჩემი შეფასებისა და გეგმის ჩაწერა ↓"}</button>`);
    const tocEntries = [];
    const track = (id, key, html) => {
      if (html) tocEntries.push([id, t(lang, key)]);
      return html;
    };
    let body = "";
    if (access.clinical) {
      if (rv) {
        const rvLang = normLang(str(rv.language) || lang);
        const ai = [
          track("summary", "sec.summary", secSummary(rv, lang)),
          track("assessment", "sec.assessment", secAssessment(rv, ctx)),
          track("plan", "sec.plan", secPlan(rv, ctx)),
          track("investigations", "sec.investigations", secInvestigations(rv, ctx)),
          track("dangerous", "sec.dangerous", secDangerous(rv, ctx)),
          `<details class="clinical-details"><summary>${lang === "en" ? "View detailed analysis and sources" : "დეტალური ანალიზი და წყაროები"}</summary>`,
          track("changes", "sec.changes", secChanges(rv, ctx)),
          track("differential", "sec.differential", secDifferential(rv, ctx)),
          secDiscriminators(rv, ctx),
          track("picture", "sec.picture", secPicture(rv, ctx)),
          track("workup", "sec.workup", secWorkup(rv, lang)),
          track("evidence", "sec.evidence", secEvidence(rv, lang)),
          "</details>",
        ].join("");
        body += renderLangNotice(rv, lang, o);
        body += `<div class="ai-zone" lang="${rvLang}"><p class="ai-zone-k">${icon("ai")}<span lang="${lang}">${T(lang, "ai.zone")}</span></p>${ai}</div>`;
      } else {
        body += renderSynthesisState(status, lang, o, d);
      }
      body += track("transcript", "sec.transcript", secTranscript(d, ctx, open.has("transcript")));
    } else {
      body += `<section class="rv-sec syn syn-locked" data-section="no-access" aria-labelledby="noaccess-h"><span class="syn-mark" aria-hidden="true">${icon("lock")}</span><h2 class="syn-title" id="noaccess-h">${T(lang, "syn.noAccess.title")}</h2><p class="syn-body">${T(lang, "syn.noAccess.body")}</p></section>`;
    }
    body += track("patient", "sec.patient", secPatient(d, lang, open.has("patient") || !access.clinical, access));
    if (rv) body += secFootnote(rv, lang);
    out.push(renderToc(tocEntries, lang));
    out.push(body);
    return out.join("");
  }

  function saveStatusText(save, lang) {
    const s = obj(save);
    switch (s.state) {
      case "dirty":
        return t(lang, "dec.save.dirty");
      case "saving":
        return t(lang, "dec.save.saving");
      case "saved": {
        const when = formatTime(s.at, lang);
        return when ? t(lang, "dec.save.savedAt", { t: when }) : t(lang, "dec.save.saved");
      }
      case "error":
        return t(lang, "dec.save.error");
      case "forbidden":
        return t(lang, "dec.save.forbidden");
      case "needs_assessment":
        return t(lang, "dec.needsAssessment");
      case "final":
        return t(lang, "dec.save.final");
      default:
        return "";
    }
  }

  function decisionMeta(dec, lang) {
    const d = obj(dec);
    const who = str(d.author);
    if (!who) return "";
    const final = d.status === "final";
    const when = formatTime(final ? d.finalized_at || d.updated_at : d.updated_at, lang);
    const line = [who, statusLabel("role", d.role, lang), when].filter(Boolean).join(" · ");
    return t(lang, final ? "dec.signed" : "dec.edited", { who: line });
  }

  function renderDecisionPanel(decision, session, opts) {
    const o = obj(opts);
    const lang = normLang(o.lang);
    const access = can(session);
    const dec = decision && typeof decision === "object" && !Array.isArray(decision) ? decision : null;
    const final = !!dec && dec.status === "final";
    const meta = dec ? decisionMeta(dec, lang) : "";
    const head = `<div class="dec-head">
        <p class="human-badge">${icon("human")}<span>${T(lang, "dec.badge")}</span></p>
        <h2 class="dec-title" id="dec-title">${T(lang, "dec.title")}</h2>
        <p class="dec-lead">${T(lang, "dec.lead")}</p>
      </div>`;
    if (!access.clinical) {
      const statusText = statusLabel("decision_status", dec ? dec.status || "none" : o.decisionStatus || "none", lang);
      return `<div class="dec-card is-readonly" data-section="decision">${head}<p class="dec-state"><span class="kv-inline">${T(lang, "dec.status")}:</span> ${esc(statusText)}</p>${meta ? `<p class="dec-meta">${esc(meta)}</p>` : ""}</div>`;
    }
    const fields = [
      ["assessment", "dec.assessment"],
      ["plan", "dec.plan"],
      ["note", "dec.note"],
    ];
    if (!access.decision || final) {
      const values = fields.filter(([k]) => dec && str(dec[k]));
      const body = values.length
        ? `<dl class="dec-read">${values.map(([k, key]) => `<div class="kv"><dt>${T(lang, key)}</dt><dd>${esc(dec[k])}</dd></div>`).join("")}</dl>`
        : `<p class="empty-inline">${T(lang, "dec.none")}</p>`;
      return `<div class="dec-card${final ? " is-final" : " is-readonly"}" data-section="decision">${head}
        ${final ? `<p class="dec-lock">${icon("lock")}<span>${T(lang, "dec.locked")}</span></p>` : `<p class="dec-ro">${T(lang, "dec.readonly")}</p>`}
        ${body}
        ${meta ? `<p class="dec-meta">${esc(meta)}</p>` : ""}
        <p class="save-status" id="dec-status" role="status" aria-live="polite">${esc(final && o.save && o.save.state === "final" ? saveStatusText(o.save, lang) : "")}</p>
      </div>`;
    }
    const value = (k) => (dec ? esc(dec[k]) : "");
    const saveState = obj(o.save).state || "";
    return `<div class="dec-card is-editable" data-section="decision">${head}
      <form class="dec-form" id="dec-form" novalidate>
        ${fields
          .map(
            ([k, key]) => `<div class="dec-field">
            <label class="field-label" for="dec-${k}">${T(lang, key)}</label>
            ${k === "assessment" ? `<p class="field-hint" id="dec-${k}-hint">${T(lang, "dec.assessmentHint")}</p>` : ""}
            <textarea class="field dec-input" id="dec-${k}" name="${k}" data-decision-field="${k}" rows="${k === "note" ? 2 : 4}"${k === "assessment" ? ` aria-describedby="dec-${k}-hint dec-status"` : ""}>${value(k)}</textarea>
          </div>`
          )
          .join("")}
        <p class="save-status is-${esc(saveState || "idle")}" id="dec-status" role="status" aria-live="polite">${esc(saveStatusText(o.save, lang))}</p>
        <p class="dec-retry-wrap"${saveState === "error" ? "" : " hidden"}><button type="button" class="btn btn-quiet btn-sm" data-action="retry-save">${T(lang, "dec.retry")}</button></p>
        <p class="dec-meta" id="dec-meta">${esc(meta)}</p>
        <button type="button" class="btn btn-human btn-block" data-action="finalize">${icon("check")}<span>${T(lang, "dec.finalize")}</span></button>
      </form>
    </div>`;
  }

  function renderConfirm(lang) {
    return `<form method="dialog" class="confirm">
      <h2 class="confirm-title" id="confirm-title">${T(lang, "dec.confirm.title")}</h2>
      <p class="confirm-body" id="confirm-body">${T(lang, "dec.confirm.body")}</p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-quiet" data-action="cancel-finalize">${T(lang, "dec.confirm.cancel")}</button>
        <button type="button" class="btn btn-human" data-action="confirm-finalize">${icon("check")}<span>${T(lang, "dec.confirm.ok")}</span></button>
      </div>
    </form>`;
  }

  function renderCase(detail, review, decision, session, opts) {
    const o = obj(opts);
    return `<div class="case-bar" id="case-bar">${renderCaseBar(detail, session, o)}</div>
      <div class="case-layout">
        <div class="case-main" id="case-main">${renderCaseMain(detail, review, session, o)}</div>
        <aside class="case-side" id="case-side" aria-labelledby="dec-title">${renderDecisionPanel(decision, session, Object.assign({}, o, { decisionStatus: obj(detail).decision_status }))}</aside>
      </div>`;
  }

  function renderCaseSkeleton(lang) {
    return `<div class="case-layout case-skeleton" aria-busy="true">
      <div class="case-main"><p class="visually-hidden" role="status">${T(lang, "case.loading")}</p>
        <div class="case-head" aria-hidden="true"><span class="skel skel-line w-30"></span><span class="skel skel-title"></span><span class="skel skel-line w-50"></span><span class="skel skel-block"></span></div>
        <div class="rv-sec card" aria-hidden="true"><span class="skel skel-line w-40"></span><span class="skel skel-line w-90"></span><span class="skel skel-line w-80"></span></div>
      </div>
      <aside class="case-side" aria-hidden="true"><div class="dec-card"><span class="skel skel-line w-50"></span><span class="skel skel-block"></span></div></aside>
    </div>`;
  }

  // --- API client ---

  function apiError(status, code) {
    const err = new Error(code || "http_" + status);
    err.status = status;
    err.code = code || "";
    return err;
  }

  function createApi(fetchImpl) {
    const doFetch = fetchImpl || ((url, init) => root.fetch(url, init));
    async function call(method, url, body) {
      let res;
      try {
        res = await doFetch(url, {
          method,
          credentials: "same-origin",
          cache: "no-store",
          headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (e) {
        throw apiError(0, "network");
      }
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }
      if (!res.ok) throw apiError(res.status, data && typeof data.error === "string" ? data.error : "");
      return data && typeof data === "object" ? data : {};
    }
    return {
      session: () => call("GET", "/api/session"),
      login: (key) => call("POST", "/api/login", { key }),
      logout: () => call("POST", "/api/logout", {}),
      cases: () => call("GET", "/api/review/cases"),
      getCase: (id) => call("GET", "/api/review/case?case_id=" + encodeURIComponent(id)),
      generate: (id, language) => call("POST", "/api/review/generate", { case_id: id, language }),
      saveDecision: (id, fields, status) =>
        call("POST", "/api/review/decision", { case_id: id, assessment: fields.assessment, plan: fields.plan, note: fields.note, status }),
      setWorkflow: (id, workflow) => call("POST", "/api/review/workflow", { case_id: id, workflow }),
    };
  }

  // --- DOM wiring ---

  function createWorkspace(api, env) {
    const doc = root.document;
    const app = doc.getElementById("review-app");
    const $ = (sel) => app.querySelector(sel);
    const els = {
      top: doc.getElementById("rv-top"),
      main: doc.getElementById("main"),
      boot: doc.getElementById("view-boot"),
      login: doc.getElementById("view-login"),
      queue: doc.getElementById("view-queue"),
      kase: doc.getElementById("view-case"),
      msg: doc.getElementById("view-message"),
      live: doc.getElementById("rv-live"),
      dialog: doc.getElementById("confirm-dialog"),
    };
    const reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = {
      session: null,
      lang: initialLang(),
      view: "boot",
      cases: [],
      casesKey: "",
      casesLoaded: false,
      casesError: false,
      updatedAt: 0,
      filter: "all",
      query: "",
      caseId: "",
      caseToken: 0,
      detail: null,
      review: null,
      reviewStatus: "",
      decision: null,
      alerted: "",
      open: new Set(),
      revealId: false,
      gen: { active: false },
      genToken: 0,
      pollTimer: 0,
      save: { state: "idle" },
      saveTimer: 0,
      saving: null,
      saveQueued: false,
      stash: null,
      lastCaseId: "",
      fromQueue: false,
    };

    function initialLang() {
      try {
        const stored = root.localStorage && root.localStorage.getItem(LANG_KEY);
        if (LANGS.includes(stored)) return stored;
      } catch (e) {
        /* storage blocked */
      }
      return "ka";
    }

    function announce(text) {
      if (!els.live || !text) return;
      els.live.textContent = "";
      root.setTimeout(() => {
        els.live.textContent = text;
      }, 60);
    }

    function setView(view) {
      const map = { boot: els.boot, login: els.login, queue: els.queue, case: els.kase, message: els.msg };
      for (const [name, el] of Object.entries(map)) {
        if (!el) continue;
        const show = name === view;
        if (show && el.hidden) {
          el.hidden = false;
          el.classList.remove("view-enter");
          void el.offsetWidth;
          el.classList.add("view-enter");
        } else if (!show) {
          el.hidden = true;
        }
      }
      state.view = view;
      app.dataset.view = view;
      els.top.hidden = view === "boot";
    }

    function applyLang() {
      doc.documentElement.lang = state.lang;
      doc.title = t(state.lang, "app.docTitle");
      const skip = doc.querySelector(".skip-link");
      if (skip) skip.textContent = t(state.lang, "app.skip");
    }

    function renderTop() {
      els.top.innerHTML = renderTopbar(state.session, state.lang, { fixture: env.fixture });
    }

    function focusKey() {
      const a = doc.activeElement;
      if (!a || !app.contains(a) || !a.dataset) return null;
      if (a.dataset.caseId) return ["data-case-id", a.dataset.caseId];
      if (a.dataset.filter) return ["data-filter", a.dataset.filter];
      if (a.dataset.lang) return ["data-lang", a.dataset.lang];
      if (a.dataset.toggle) return ["data-toggle", a.dataset.toggle];
      if (a.dataset.action) return ["data-action", a.dataset.action];
      if (a.id) return ["id", a.id];
      return null;
    }

    function restoreFocus(key) {
      if (!key) return;
      const [attr, value] = key;
      const match = Array.from(app.querySelectorAll(`[${attr}]`)).find((el) => el.getAttribute(attr) === value);
      if (match && doc.activeElement !== match) match.focus({ preventScroll: true });
    }

    // session

    async function start() {
      applyLang();
      renderTop();
      try {
        const s = await api.session();
        if (s && s.authenticated === true) acceptSession(s);
        else showLogin("");
      } catch (err) {
        if (err.status === 401) showLogin("");
        else showMessage("unavailable", { retry: "retry-session" });
      }
    }

    function acceptSession(s) {
      state.session = s;
      renderTop();
      route();
      if (!state.refresh) {
        state.refresh = root.setInterval(() => {
          if (state.session && doc.visibilityState !== "hidden") refreshCases();
        }, REFRESH_MS);
      }
    }

    function wipe() {
      state.cases = [];
      state.casesKey = "";
      state.casesLoaded = false;
      state.detail = null;
      state.review = null;
      state.decision = null;
      state.caseId = "";
      state.genToken++;
      root.clearTimeout(state.pollTimer);
      root.clearTimeout(state.saveTimer);
      els.queue.innerHTML = "";
      els.queue.dataset.lang = "";
      els.kase.innerHTML = "";
    }

    function showLogin(error, busy) {
      state.loginError = error || "";
      setView("login");
      renderTop();
      els.login.innerHTML = renderLogin(state.lang, { error: state.loginError, busy });
      const input = doc.getElementById("login-key");
      if (input && !busy) input.focus();
    }

    function showMessage(kind, opts) {
      setView("message");
      els.msg.innerHTML = renderMessage(kind, state.lang, opts);
      const h = els.msg.querySelector("h1");
      if (h) h.focus();
    }

    function handleAuth(err) {
      if (!err || err.status !== 401) return false;
      if (state.view === "case" && can(state.session).decision && state.save.state !== "idle" && state.save.state !== "saved") {
        state.stash = { caseId: state.caseId, fields: decisionFields() };
      }
      state.session = null;
      wipe();
      showLogin(t(state.lang, "login.expired"));
      return true;
    }

    async function submitLogin(form) {
      const key = str(form.elements.key && form.elements.key.value);
      if (!key) return showLogin(t(state.lang, "login.required"));
      showLogin("", true);
      try {
        const s = await api.login(key);
        if (s && s.authenticated === true) acceptSession(s);
        else showLogin(t(state.lang, "login.invalid"));
      } catch (err) {
        showLogin(t(state.lang, err.status === 401 ? "login.invalid" : "login.network"));
      }
    }

    async function logout() {
      await flushSave();
      try {
        await api.logout();
      } catch (e) {
        /* the cookie is cleared server side; local state is wiped either way */
      }
      state.session = null;
      wipe();
      if (root.history && root.history.replaceState) root.history.replaceState(null, "", root.location.pathname + root.location.search);
      showLogin("");
    }

    // routing

    function caseIdFromHash() {
      const m = /^#case=(.+)$/.exec(root.location.hash || "");
      if (!m) return "";
      try {
        return decodeURIComponent(m[1]);
      } catch (e) {
        return "";
      }
    }

    function route() {
      if (!state.session) return;
      const id = caseIdFromHash();
      if (id) {
        if (state.view === "case" && state.caseId === id) return;
        openCase(id);
      } else {
        if (state.view === "queue") return;
        showQueue();
      }
    }

    function goQueue() {
      if (state.view !== "case") return;
      state.lastCaseId = state.caseId;
      if (state.fromQueue && root.history.length > 1) {
        root.history.back();
        return;
      }
      root.history.pushState(null, "", root.location.pathname + root.location.search);
      route();
    }

    function leaveCase() {
      if (state.saveTimer) flushSave();
      state.genToken++;
      root.clearTimeout(state.pollTimer);
      state.gen = { active: false };
      state.caseId = "";
      state.caseToken++;
    }

    // queue

    function showQueue() {
      const fromCase = state.view === "case";
      if (fromCase) leaveCase();
      setView("queue");
      if (els.queue.dataset.lang !== state.lang) {
        els.queue.innerHTML = renderQueueShell(state.lang, state.session);
        els.queue.dataset.lang = state.lang;
        const input = doc.getElementById("queue-search");
        if (input) input.value = state.query;
      }
      renderQueueList();
      refreshCases();
      if (state.lastCaseId) {
        restoreFocus(["data-case-id", state.lastCaseId]);
        state.lastCaseId = "";
      } else if (fromCase) {
        const h = doc.getElementById("queue-title");
        if (h) h.focus();
      }
    }

    function renderQueueList() {
      const filters = doc.getElementById("queue-filters");
      const list = doc.getElementById("queue-list");
      if (!filters || !list) return;
      const key = focusKey();
      filters.innerHTML = renderFilters(queueCounts(state.cases), state.filter, state.lang);
      list.innerHTML = renderQueue(state.cases, state.filter, state.query, {
        lang: state.lang,
        session: state.session,
        now: Date.now(),
        loading: !state.casesLoaded,
        error: state.casesError,
        selectedId: state.lastCaseId,
      });
      const status = doc.getElementById("queue-status");
      if (status) {
        const shown = state.casesLoaded ? filterCases(state.cases, state.filter, state.query).length : null;
        const parts = [];
        if (shown !== null) parts.push(tn(state.lang, "queue.shown", shown));
        if (state.updatedAt) parts.push(t(state.lang, "queue.updated", { t: timeAgo(new Date(state.updatedAt).toISOString(), state.lang, Date.now()) }));
        status.textContent = parts.join(" · ");
      }
      restoreFocus(key);
    }

    async function refreshCases() {
      try {
        const data = await api.cases();
        const cases = objs(obj(data).cases);
        const key = JSON.stringify(cases);
        state.casesLoaded = true;
        state.casesError = false;
        state.updatedAt = Date.now();
        if (key !== state.casesKey) {
          state.casesKey = key;
          state.cases = cases;
        }
      } catch (err) {
        if (handleAuth(err)) return;
        if (err.status === 403 && !state.cases.length) {
          if (state.view === "queue") showMessage("forbidden", {});
          return;
        }
        state.casesLoaded = true;
        state.casesError = true;
        if (!state.cases.length && state.view === "queue") {
          showMessage(err.status === 404 ? "unavailable" : "error", { retry: "retry-cases" });
          return;
        }
      }
      if (state.view === "queue") renderQueueList();
    }

    function patchSummary(id, patch) {
      const item = state.cases.find((c) => c.case_id === id);
      if (item) Object.assign(item, patch);
      state.casesKey = JSON.stringify(state.cases);
    }

    // case

    function caseOpts(extra) {
      return Object.assign(
        {
          lang: state.lang,
          reviewStatus: state.reviewStatus,
          open: state.open,
          gen: state.gen,
          save: state.save,
          alert: state.alerted !== state.caseId,
          decisionStatus: state.detail && state.detail.decision_status,
        },
        extra || {}
      );
    }

    async function openCase(id) {
      if (state.view === "case" && state.caseId && state.caseId !== id) leaveCase();
      state.fromQueue = state.view === "queue";
      const token = ++state.caseToken;
      state.genToken++;
      root.clearTimeout(state.pollTimer);
      state.caseId = id;
      state.detail = null;
      state.review = null;
      state.decision = null;
      state.gen = { active: false };
      state.open = new Set();
      state.revealId = false;
      state.save = { state: "idle" };
      setView("case");
      els.kase.innerHTML = renderCaseSkeleton(state.lang);
      root.scrollTo(0, 0);
      try {
        const data = await api.getCase(id);
        if (token !== state.caseToken) return;
        applyCaseData(data);
        renderCaseView();
        state.alerted = id;
        const h = doc.getElementById("case-title");
        if (h) h.focus({ preventScroll: true });
        restoreStash();
        const access = can(state.session);
        if (state.detail.workflow === "new" && access.workflow) setWorkflow("in_review", true);
        if (state.reviewStatus === "generating" && access.clinical) {
          state.gen = { active: true, startedAt: Date.now(), target: "" };
          renderMain();
          schedulePoll(++state.genToken);
        }
      } catch (err) {
        if (token !== state.caseToken) return;
        if (handleAuth(err)) return;
        const kind = err.status === 403 ? "forbidden" : err.status === 404 ? "notfound" : "error";
        els.kase.innerHTML = renderMessage(kind, state.lang, { back: true, retry: kind === "error" ? "retry-case" : "" });
        const h = els.kase.querySelector("h1");
        if (h) h.focus();
      }
    }

    function applyCaseData(data) {
      const d = obj(data);
      state.detail = Object.assign({}, obj(d.case));
      state.review = d.review && typeof d.review === "object" && !Array.isArray(d.review) ? d.review : null;
      state.reviewStatus = str(d.review_status) || str(state.detail.review_status) || (state.review ? "ready" : "not_started");
      state.decision = d.decision && typeof d.decision === "object" ? d.decision : null;
    }

    function renderCaseView() {
      const fields = doc.getElementById("dec-form") ? decisionFields() : null;
      const key = focusKey();
      els.kase.innerHTML = renderCase(state.detail, state.review, state.decision, state.session, caseOpts());
      if (fields) setDecisionFields(fields);
      applyReveal();
      restoreFocus(key);
    }

    function renderMain() {
      const main = doc.getElementById("case-main");
      if (!main || !state.detail) return;
      const key = focusKey();
      main.innerHTML = renderCaseMain(state.detail, state.review, state.session, caseOpts({ alert: false }));
      const bar = doc.getElementById("case-bar");
      if (bar) bar.innerHTML = renderCaseBar(state.detail, state.session, caseOpts());
      applyReveal();
      restoreFocus(key);
    }

    function renderSide() {
      const side = doc.getElementById("case-side");
      if (!side) return;
      side.innerHTML = renderDecisionPanel(state.decision, state.session, caseOpts());
    }

    function applyReveal() {
      const raw = str(obj(obj(state.detail).patient).personal_id);
      app.querySelectorAll("[data-pid]").forEach((el) => {
        el.textContent = state.revealId ? raw : maskId(raw);
      });
      app.querySelectorAll('[data-action="reveal-id"]').forEach((btn) => {
        btn.setAttribute("aria-pressed", String(state.revealId));
        const label = btn.querySelector(".pid-btn-text");
        if (label) label.textContent = t(state.lang, state.revealId ? "case.hide" : "case.reveal");
      });
    }

    // generation

    async function generate(language) {
      const id = state.caseId;
      if (!id) return;
      const token = ++state.genToken;
      root.clearTimeout(state.pollTimer);
      state.gen = { active: true, slow: false, target: language, startedAt: Date.now() };
      renderMain();
      announce(t(state.lang, "syn.generating.title"));
      try {
        const res = await api.generate(id, language);
        if (token !== state.genToken) return;
        if (!applyGeneration(res)) schedulePoll(token);
      } catch (err) {
        if (token !== state.genToken) return;
        if (handleAuth(err)) return;
        state.gen = { active: false, error: err.status === 403 ? "forbidden" : "failed" };
        if (!state.review) state.reviewStatus = "failed";
        renderMain();
        announce(t(state.lang, err.status === 403 ? "syn.forbidden" : "syn.failed.title"));
      }
    }

    function applyGeneration(res) {
      const r = obj(res);
      const status = str(r.review_status);
      const review = r.review && typeof r.review === "object" && !Array.isArray(r.review) ? r.review : null;
      if (status === "ready" && review) {
        state.review = review;
        state.reviewStatus = "ready";
        state.gen = { active: false };
        patchSummary(state.caseId, { review_status: "ready" });
        renderMain();
        announce(t(state.lang, "syn.ready"));
        return true;
      }
      if (status === "generating") return false;
      state.gen = { active: false, error: "failed" };
      if (!state.review) state.reviewStatus = "failed";
      renderMain();
      announce(t(state.lang, "syn.failed.title"));
      return true;
    }

    function schedulePoll(token) {
      root.clearTimeout(state.pollTimer);
      state.pollTimer = root.setTimeout(async () => {
        if (token !== state.genToken || !state.caseId) return;
        if (Date.now() - (state.gen.startedAt || 0) > POLL_LIMIT_MS) {
          state.gen = Object.assign({}, state.gen, { slow: true });
          renderMain();
          announce(t(state.lang, "syn.slow"));
          return;
        }
        try {
          const data = await api.getCase(state.caseId);
          if (token !== state.genToken) return;
          if (!applyGeneration({ review_status: data.review_status, review: data.review })) schedulePoll(token);
        } catch (err) {
          if (handleAuth(err)) return;
          if (token === state.genToken) schedulePoll(token);
        }
      }, POLL_MS);
    }

    // decision

    function decisionFields() {
      const read = (k) => {
        const el = doc.getElementById("dec-" + k);
        return el ? el.value : "";
      };
      return { assessment: read("assessment"), plan: read("plan"), note: read("note") };
    }

    function setDecisionFields(fields) {
      for (const k of ["assessment", "plan", "note"]) {
        const el = doc.getElementById("dec-" + k);
        if (el && typeof fields[k] === "string") el.value = fields[k];
      }
    }

    function restoreStash() {
      if (!state.stash || state.stash.caseId !== state.caseId) return;
      if (!doc.getElementById("dec-form")) return;
      setDecisionFields(state.stash.fields);
      state.stash = null;
      onDecisionInput();
    }

    function setSaveStatus() {
      const el = doc.getElementById("dec-status");
      if (el) {
        el.textContent = saveStatusText(state.save, state.lang);
        el.className = `save-status is-${state.save.state || "idle"}`;
      }
      const retry = app.querySelector(".dec-retry-wrap");
      if (retry) retry.hidden = state.save.state !== "error";
      const meta = doc.getElementById("dec-meta");
      if (meta) meta.textContent = state.decision ? decisionMeta(state.decision, state.lang) : "";
    }

    function onDecisionInput() {
      state.save = { state: "dirty" };
      setSaveStatus();
      root.clearTimeout(state.saveTimer);
      state.saveTimer = root.setTimeout(() => {
        state.saveTimer = 0;
        saveDraft();
      }, AUTOSAVE_MS);
    }

    function flushSave() {
      if (state.saveTimer) {
        root.clearTimeout(state.saveTimer);
        state.saveTimer = 0;
        return saveDraft();
      }
      return state.saving || Promise.resolve();
    }

    function saveDraft() {
      if (!state.caseId || !can(state.session).decision || !doc.getElementById("dec-form")) return Promise.resolve();
      if (state.saving) {
        state.saveQueued = true;
        return state.saving;
      }
      const id = state.caseId;
      const fields = decisionFields();
      state.save = { state: "saving" };
      setSaveStatus();
      state.saving = (async () => {
        try {
          const res = await api.saveDecision(id, fields, "draft");
          const dec = obj(obj(res).decision);
          if (id === state.caseId) {
            state.decision = Object.assign({}, fields, dec);
            state.save = state.saveQueued ? { state: "dirty" } : { state: "saved", at: dec.updated_at || new Date().toISOString() };
            setSaveStatus();
          }
          patchSummary(id, { decision_status: "draft" });
        } catch (err) {
          if (handleAuth(err)) return;
          if (id === state.caseId) {
            state.save = { state: err.status === 403 ? "forbidden" : "error" };
            setSaveStatus();
          }
        } finally {
          state.saving = null;
          if (state.saveQueued) {
            state.saveQueued = false;
            if (id === state.caseId) saveDraft();
          }
        }
      })();
      return state.saving;
    }

    function askFinalize() {
      const fields = decisionFields();
      if (!str(fields.assessment)) {
        state.save = { state: "needs_assessment" };
        setSaveStatus();
        const el = doc.getElementById("dec-assessment");
        if (el) el.focus();
        return;
      }
      const dialog = els.dialog;
      if (!dialog || typeof dialog.showModal !== "function") {
        if (root.confirm(`${t(state.lang, "dec.confirm.title")}\n\n${t(state.lang, "dec.confirm.body")}`)) finalize();
        return;
      }
      dialog.innerHTML = renderConfirm(state.lang);
      dialog.setAttribute("aria-labelledby", "confirm-title");
      dialog.setAttribute("aria-describedby", "confirm-body");
      dialog.showModal();
      const cancel = dialog.querySelector('[data-action="cancel-finalize"]');
      if (cancel) cancel.focus();
    }

    function closeDialog() {
      if (els.dialog && els.dialog.open) els.dialog.close();
      const btn = app.querySelector('[data-action="finalize"]');
      if (btn) btn.focus();
    }

    async function finalize() {
      if (els.dialog && els.dialog.open) els.dialog.close();
      const id = state.caseId;
      root.clearTimeout(state.saveTimer);
      state.saveTimer = 0;
      if (state.saving) await state.saving;
      if (id !== state.caseId) return;
      const fields = decisionFields();
      state.save = { state: "saving" };
      setSaveStatus();
      try {
        const res = await api.saveDecision(id, fields, "final");
        if (id !== state.caseId) return;
        state.decision = Object.assign({}, fields, obj(obj(res).decision));
        state.save = { state: "final" };
        if (state.detail) state.detail.decision_status = "final";
        patchSummary(id, { decision_status: "final" });
        renderSide();
        announce(t(state.lang, "dec.save.final"));
        const side = doc.getElementById("dec-title");
        if (side) {
          side.setAttribute("tabindex", "-1");
          side.focus();
        }
        if (can(state.session).workflow && state.detail && state.detail.workflow !== "reviewed") setWorkflow("reviewed", true);
      } catch (err) {
        if (handleAuth(err)) return;
        state.save = { state: err.status === 403 ? "forbidden" : "error" };
        setSaveStatus();
      }
    }

    async function setWorkflow(next, silent) {
      const id = state.caseId;
      if (!id) return;
      try {
        const res = await api.setWorkflow(id, next);
        const wf = str(obj(res).workflow) || next;
        patchSummary(id, { workflow: wf });
        if (id === state.caseId && state.detail) {
          state.detail.workflow = wf;
          renderMain();
          if (!silent) announce(statusLabel("workflow", wf, state.lang));
        }
      } catch (err) {
        if (handleAuth(err)) return;
        if (!silent) announce(t(state.lang, err.status === 403 ? "msg.forbidden.body" : "msg.error.title"));
      }
    }

    // interactions

    function toggleSection(btn) {
      const id = btn.getAttribute("data-toggle");
      const body = doc.getElementById(`sec-${id}-body`);
      if (!body) return;
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      body.hidden = !open;
      if (open) {
        state.open.add(id);
        body.classList.remove("reveal");
        void body.offsetWidth;
        body.classList.add("reveal");
      } else state.open.delete(id);
    }

    function openContaining(el) {
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === "DETAILS") parent.open = true;
      }
      const body = el.closest(".rv-collapse-body");
      if (body && body.hidden) {
        const btn = app.querySelector(`[aria-controls="${body.id}"]`);
        if (btn) toggleSection(btn);
      }
    }

    function jumpTo(domId, highlight) {
      const target = doc.getElementById(domId);
      if (!target) return;
      openContaining(target);
      target.scrollIntoView({ block: highlight ? "center" : "start", behavior: reduced ? "auto" : "smooth" });
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      if (highlight) {
        target.classList.remove("is-cited");
        void target.offsetWidth;
        target.classList.add("is-cited");
        root.setTimeout(() => target.classList.remove("is-cited"), 2600);
      }
    }

    function setLang(lang) {
      if (!LANGS.includes(lang) || lang === state.lang) return;
      state.lang = lang;
      try {
        root.localStorage.setItem(LANG_KEY, lang);
      } catch (e) {
        /* storage blocked */
      }
      applyLang();
      const key = focusKey();
      renderTop();
      if (state.view === "login") els.login.innerHTML = renderLogin(state.lang, { error: "" });
      else if (state.view === "queue") {
        els.queue.dataset.lang = "";
        showQueue();
      } else if (state.view === "case" && state.detail) {
        renderCaseView();
        const access = can(state.session);
        if (access.clinical && state.review && str(state.review.language) && state.review.language !== lang && !state.gen.active) generate(lang);
      } else if (state.view === "message") {
        route();
      }
      restoreFocus(key);
    }

    function moveRow(current, dir) {
      const rows = Array.from(app.querySelectorAll(".q-row[data-case-id]"));
      const i = rows.indexOf(current);
      const next = rows[i + dir];
      if (next) next.focus();
    }

    function isField(el) {
      return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    }

    app.addEventListener("click", (e) => {
      const el = e.target.closest("[data-action],[data-toggle],[data-cite],[data-filter],[data-lang],[data-jump]");
      if (!el || !app.contains(el)) return;
      if (el.hasAttribute("data-filter")) {
        state.filter = el.getAttribute("data-filter");
        renderQueueList();
        announce(tn(state.lang, "queue.shown", filterCases(state.cases, state.filter, state.query).length));
        return;
      }
      if (el.hasAttribute("data-lang")) return setLang(el.getAttribute("data-lang"));
      if (el.hasAttribute("data-toggle")) return toggleSection(el);
      if (el.hasAttribute("data-cite")) return jumpTo(el.getAttribute("data-cite"), true);
      if (el.hasAttribute("data-jump")) {
        e.preventDefault();
        return jumpTo(el.getAttribute("data-jump"), false);
      }
      switch (el.getAttribute("data-action")) {
        case "home":
          e.preventDefault();
          if (state.view === "case") goQueue();
          break;
        case "back":
          if (state.view === "case" && state.detail) goQueue();
          else {
            root.history.pushState(null, "", root.location.pathname + root.location.search);
            state.view = "case";
            showQueue();
          }
          break;
        case "logout":
          logout();
          break;
        case "generate":
          generate(state.lang);
          break;
        case "poll-again":
          state.gen = { active: true, slow: false, target: state.gen.target || "", startedAt: Date.now() };
          renderMain();
          schedulePoll(++state.genToken);
          break;
        case "reveal-id":
          state.revealId = !state.revealId;
          applyReveal();
          break;
        case "workflow":
          setWorkflow(el.getAttribute("data-value"), false);
          break;
        case "finalize":
          askFinalize();
          break;
        case "confirm-finalize":
          finalize();
          break;
        case "cancel-finalize":
          closeDialog();
          break;
        case "retry-save":
          saveDraft();
          break;
        case "clear-filters":
          state.filter = "all";
          state.query = "";
          {
            const input = doc.getElementById("queue-search");
            if (input) input.value = "";
          }
          renderQueueList();
          break;
        case "retry-cases":
          els.queue.dataset.lang = "";
          state.view = "boot";
          showQueue();
          break;
        case "retry-case":
          if (state.caseId) openCase(state.caseId);
          break;
        case "retry-session":
          start();
          break;
        default:
          break;
      }
    });

    app.addEventListener("input", (e) => {
      const target = e.target;
      if (target.id === "queue-search") {
        state.query = target.value;
        root.clearTimeout(state.searchTimer);
        state.searchTimer = root.setTimeout(() => {
          renderQueueList();
          announce(tn(state.lang, "queue.shown", filterCases(state.cases, state.filter, state.query).length));
        }, 120);
      } else if (target.hasAttribute && target.hasAttribute("data-decision-field")) {
        onDecisionInput();
      }
    });

    app.addEventListener("submit", (e) => {
      if (e.target.id === "login-form") {
        e.preventDefault();
        submitLogin(e.target);
      } else if (e.target.id === "dec-form") {
        e.preventDefault();
      }
    });

    if (els.dialog) {
      els.dialog.addEventListener("cancel", () => {
        root.setTimeout(closeDialog, 0);
      });
    }

    doc.addEventListener("keydown", (e) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        if (els.dialog && els.dialog.open) return;
        if (state.view !== "case") return;
        if (isField(e.target)) {
          e.target.blur();
          return;
        }
        e.preventDefault();
        goQueue();
        return;
      }
      if (state.view !== "queue") return;
      const target = e.target;
      if (e.key === "/" && !isField(target)) {
        const input = doc.getElementById("queue-search");
        if (input) {
          e.preventDefault();
          input.focus();
        }
      } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && target.classList && target.classList.contains("q-row")) {
        e.preventDefault();
        moveRow(target, e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "ArrowDown" && target.id === "queue-search") {
        const first = app.querySelector(".q-row[data-case-id]");
        if (first) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === " " && target.classList && target.classList.contains("q-row")) {
        e.preventDefault();
        target.click();
      }
    });

    root.addEventListener("hashchange", () => route());
    root.addEventListener("popstate", () => route());
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "visible" && state.session) refreshCases();
    });
    root.addEventListener("beforeunload", (e) => {
      if (state.saveTimer || state.saving || state.save.state === "dirty" || state.save.state === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    return { start, state };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = root.document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      root.document.head.appendChild(s);
    });
  }

  function boot() {
    const doc = root.document;
    if (!doc || typeof doc.getElementById !== "function") return;
    const app = doc.getElementById("review-app");
    if (!app || typeof app.addEventListener !== "function") return;
    const loc = root.location;
    const params = new URLSearchParams(loc.search);
    const fixture = params.get("fixture") === "1" && ["127.0.0.1", "localhost", "[::1]"].includes(loc.hostname);
    const begin = (api) => createWorkspace(api, { fixture: !!api.isFixture }).start();
    if (fixture) {
      loadScript("/doctor/dev-fixtures.js")
        .then(() => begin(Object.assign(root.REVIEW_FIXTURES.createApi(params), { isFixture: true })))
        .catch(() => begin(createApi()));
    } else {
      begin(createApi());
    }
  }

  const ReviewWorkspace = {
    esc,
    t,
    statusLabel,
    sexLabel,
    can,
    maskId,
    timeAgo,
    formatTime,
    filterCases,
    sortCases,
    queueCounts,
    renderTopbar,
    renderLogin,
    renderMessage,
    renderQueueShell,
    renderFilters,
    renderQueue,
    renderCase,
    renderCaseMain,
    renderDecisionPanel,
    saveStatusText,
    createApi,
    ENUM_KINDS,
    FILTERS,
  };

  root.ReviewWorkspace = ReviewWorkspace;
  if (typeof module !== "undefined" && module.exports) module.exports = ReviewWorkspace;
  boot();
})(typeof window !== "undefined" ? window : globalThis);
