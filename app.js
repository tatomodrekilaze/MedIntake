// MedIntake — patient side.
//
// Four screens: landing → details form (4 steps) → interview → "sent" confirmation.
// The interview is driven by the server: we send the patient's answer, it replies
// with the next question (or tells us we're done). This file only renders.

const LANG_KEY = "medintake_lang";
const SKIP_KEY = "medintake_skip_form";
const SESSION_KEY = "medintake_session";

const STEP_COUNT = 4;
const STAGES = ["stageUnderstanding", "stageDetails", "stageFinal"];

// Required fields per form step. Step 3 (medical history) is optional.
const REQUIRED = {
  1: ["firstName", "lastName", "fatherName", "personalId", "dob", "sex"],
  2: ["phone", "email"],
  3: [],
  4: ["chiefHint"],
};

const $ = (id) => document.getElementById(id);
const form = $("patient-form");
const questionArea = $("question-area");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const screens = {
  landing: $("screen-landing"),
  info: $("screen-info"),
  symptom: $("screen-symptom"),
  summary: $("screen-summary"),
};

let lang = window.SUPPORTED_LANGS.includes(localStorage.getItem(LANG_KEY)) ? localStorage.getItem(LANG_KEY) : "ge";
let skipForm = localStorage.getItem(SKIP_KEY) === "1";
let formStep = 1;
let state = freshState();

// Interview bookkeeping. `round` goes up every time we ask the server for
// something, so a slow reply from an older request can be recognised and dropped.
let busy = false;
let sending = false;
let round = 0;
let pollTimer = null;
let apiChecked = false;
let commentBoxCount = 0;

function freshState() {
  return {
    patient: {},
    answers: [],
    caseId: null,
    shownQuestionId: "",
    serverAnswered: 0,
    phase: "ask", // ask | final | done
    finalNoteOffered: false,
    submitted: false,
  };
}

/* ---------- small helpers ---------- */

function t(key) {
  return window.I18N[lang]?.[key] ?? window.I18N.en[key] ?? key;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scrollMode() {
  return reduceMotion.matches ? "auto" : "smooth";
}

const ARROW = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>';

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
}

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.classList.toggle("is-active", key === name);
  document.body.dataset.screen = name;
  $("btn-reset").hidden = name === "landing" || name === "summary";
  $("lang-switch").hidden = name === "symptom" || name === "summary";
  window.scrollTo({ top: 0 });
}

/* ---------- language ---------- */

function translatePage() {
  document.documentElement.lang = lang === "ge" ? "ka" : "en";
  document.title = t("docTitle");

  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)));
  document.querySelectorAll("[data-err-key]").forEach((el) => (el.textContent = t(el.dataset.errKey)));

  const cities = t("cities");
  document.querySelectorAll("[data-i18n-city]").forEach((el) => (el.textContent = cities[el.dataset.i18nCity] || el.dataset.i18nCity));

  document.querySelectorAll(".seg-btn").forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang)));
  document.querySelectorAll('input[name="lang-choice"]').forEach((radio) => (radio.checked = radio.value === lang));

  setSkipForm(skipForm);
  updateStepper();
}

function setLang(code) {
  if (!window.SUPPORTED_LANGS.includes(code)) return;
  lang = code;
  localStorage.setItem(LANG_KEY, code);
  translatePage();
}

// Demo switch on the landing page: jump straight to the complaint and send a
// placeholder patient instead of filling in four steps.
function setSkipForm(on) {
  skipForm = Boolean(on);
  localStorage.setItem(SKIP_KEY, skipForm ? "1" : "0");
  document.body.classList.toggle("skip-form", skipForm);
  $("btn-skip-form").setAttribute("aria-pressed", String(skipForm));
  $("skip-toggle-state").textContent = skipForm ? t("skipOn") : t("skipOff");
}

/* ---------- resume ----------
   We only keep the case id in sessionStorage (per tab), never the answers.
   The server already has those. */

function readSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    return saved?.case_id ? saved : null;
  } catch {
    return null;
  }
}

function saveSession() {
  if (!state.caseId || state.submitted) return;
  const prev = readSession();
  const startedAt = prev?.case_id === state.caseId ? prev.startedAt : new Date().toISOString();
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ case_id: state.caseId, lang, startedAt }));
  } catch {
    // private browsing — resume just won't be offered
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

function refreshResumeCard() {
  $("resume-card").hidden = !readSession();
}

/* ---------- details form ---------- */

function stepSection(n) {
  return form.querySelector(`.fstep[data-fstep="${n}"]`);
}

function goToStep(n, direction = 0) {
  formStep = n;
  form.querySelectorAll(".fstep").forEach((section) => {
    const current = Number(section.dataset.fstep) === n;
    section.hidden = !current;
    section.classList.toggle("is-current", current);
    section.classList.remove("enter-fwd", "enter-back");
  });

  const section = stepSection(n);
  if (direction) {
    void section.offsetWidth; // restart the slide-in animation
    section.classList.add(direction > 0 ? "enter-fwd" : "enter-back");
  }

  hideFormError();
  $("btn-step-next").hidden = n === STEP_COUNT;
  $("btn-to-symptom").hidden = n !== STEP_COUNT;
  updateStepper();

  if (direction) {
    window.scrollTo({ top: 0, behavior: scrollMode() });
    section.querySelector(".fstep-title")?.focus({ preventScroll: true });
  }
}

function updateStepper() {
  $("stepper-count").textContent = t("stepOf").replace("{n}", formStep);
  document.querySelectorAll(".stepper-list li").forEach((li) => {
    const n = Number(li.dataset.step);
    const done = n < formStep;
    const current = n === formStep;
    li.classList.toggle("is-done", done);
    li.classList.toggle("is-current", current);
    if (current) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
    li.querySelector(".stepper-sr").textContent = done ? `, ${t("stepDoneSr")}` : current ? `, ${t("stepCurrentSr")}` : "";
  });
}

function controlsFor(name) {
  const el = form.elements[name];
  if (!el) return [];
  return el.tagName ? [el] : [...el]; // radio groups come back as a list
}

function valueOf(name) {
  return String(new FormData(form).get(name) || "").trim();
}

// Returns the i18n key of the problem with a field, or "" if it's fine.
function problemWith(name) {
  const value = valueOf(name);

  switch (name) {
    case "personalId":
      if (!value) return "errRequired";
      return /^\d{11}$/.test(value) ? "" : "idError";

    case "dob": {
      if (!value) return "errRequired";
      const date = new Date(`${value}T00:00:00`);
      const bad = Number.isNaN(date.getTime()) || date > new Date() || date.getFullYear() < 1900;
      return bad ? "errDob" : "";
    }

    case "sex":
      return value ? "" : "errChoose";

    case "phone": {
      if (!value) return "errRequired";
      const digits = value.replace(/\D/g, "").length;
      return digits >= 9 && digits <= 15 ? "" : "errPhone";
    }

    case "email": // optional, but if it's there it should look like an email
      return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "" : "emailError";

    case "chiefHint":
      return value.length >= 2 ? "" : "describeProblem";

    default:
      return value ? "" : "errRequired";
  }
}

function linkDescription(control, id, add) {
  const ids = new Set((control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  add ? ids.add(id) : ids.delete(id);
  if (ids.size) control.setAttribute("aria-describedby", [...ids].join(" "));
  else control.removeAttribute("aria-describedby");
}

function setFieldError(name, key) {
  const controls = controlsFor(name);
  if (!controls.length) return;

  const field = controls[0].closest(".field");
  const id = `err-${name}`;
  let message = $(id);

  if (!key) {
    message?.remove();
    field?.classList.remove("has-error");
    controls.forEach((c) => {
      c.removeAttribute("aria-invalid");
      linkDescription(c, id, false);
    });
    return;
  }

  if (!message) {
    message = document.createElement("p");
    message.id = id;
    message.className = "field-error";
    field.appendChild(message);
  }
  message.dataset.errKey = key;
  message.textContent = t(key);
  field.classList.add("has-error");
  controls.forEach((c) => {
    c.setAttribute("aria-invalid", "true");
    linkDescription(c, id, true);
  });
}

function showFormError() {
  const box = $("form-error");
  box.dataset.errKey = "errSummary";
  box.textContent = t("errSummary");
  box.hidden = false;
}

function hideFormError() {
  $("form-error").hidden = true;
}

function clearFormErrors() {
  Object.values(REQUIRED).flat().forEach((name) => setFieldError(name, ""));
  hideFormError();
}

function validateStep(n) {
  let firstBad = "";
  for (const name of REQUIRED[n]) {
    const key = problemWith(name);
    setFieldError(name, key);
    if (key && !firstBad) firstBad = name;
  }

  if (!firstBad) {
    hideFormError();
    return true;
  }

  showFormError();
  const control = controlsFor(firstBad)[0];
  control.focus({ preventScroll: true });
  control.closest(".field").scrollIntoView({ block: "center", behavior: scrollMode() });
  return false;
}

// Show/hide the follow-up fields (allergy details, pregnancy, insurance).
// Hidden inputs are disabled too so they don't end up in the submitted data.
function toggleSection(id, show) {
  const el = $(id);
  el.hidden = !show;
  el.querySelectorAll("input, textarea, select").forEach((c) => (c.disabled = !show));
}

function syncFollowUps() {
  const data = new FormData(form);
  toggleSection("allergies-detail-wrap", data.get("allergies") === "yes");
  toggleSection("pregnancy-wrap", data.get("sex") === "female");
  toggleSection("ins-details", data.get("insuranceType") === "private");
}

// "None" in a checkbox list unticks everything else, and vice versa.
function makeNoneExclusive(name) {
  const boxes = [...document.querySelectorAll(`input[name="${name}"]`)];
  for (const box of boxes) {
    box.addEventListener("change", () => {
      if (!box.checked) return;
      for (const other of boxes) {
        if (other !== box && (box.value === "none" || other.value === "none")) other.checked = false;
      }
    });
  }
}

function collectPatient() {
  if (skipForm) {
    if (!validateStep(STEP_COUNT)) return null;
    return { firstName: "Test", lastName: "Patient", personalId: "00000000000", chiefHint: valueOf("chiefHint") };
  }

  // Walk back to the first step that still has a problem.
  for (let n = 1; n <= STEP_COUNT; n++) {
    if (REQUIRED[n].some((name) => problemWith(name))) {
      if (n !== formStep) goToStep(n, -1);
      validateStep(n);
      return null;
    }
  }

  const data = new FormData(form);
  const patient = {};
  data.forEach((value, key) => (patient[key] = String(value).trim()));
  patient.chronicList = data.getAll("chronicList").join(", ");
  patient.familyList = data.getAll("familyList").join(", ");
  return patient;
}

function openForm() {
  showScreen("info");
  goToStep(skipForm ? STEP_COUNT : 1);
  stepSection(formStep).querySelector(".fstep-title")?.focus({ preventScroll: true });
}

function onFormSubmit() {
  if (!skipForm && formStep < STEP_COUNT) {
    if (validateStep(formStep)) goToStep(formStep + 1, 1);
    return;
  }
  if (busy) return;

  const patient = collectPatient();
  if (!patient) return;

  state = freshState();
  state.patient = patient;
  showScreen("symptom");
  beginInterview(patient.chiefHint || "");
}

/* ---------- talking to the server ---------- */

async function apiIsUp() {
  if (apiChecked) return true;
  try {
    const res = await fetch("/api/status", { signal: AbortSignal.timeout(4000) });
    apiChecked = res.ok;
  } catch {
    apiChecked = false;
  }
  return apiChecked;
}

// POST helper. Returns the parsed JSON, or null on any kind of failure —
// callers decide what "null" means for them.
async function post(path, body, timeout = 70000) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

function hasUsableQuestion(data) {
  return Boolean(data?.q && data.question_id && Array.isArray(data.options) && data.options.length >= 2 && data.status !== "TEMPORARY");
}

// Work out what to do with a server reply.
function classify(data, myRound) {
  if (myRound !== round) return "stale";
  if (!data) return "failed";
  if (data.status === "STALE" || data.stale) return "stale";
  if (data.in_flight || data.status === "IN_FLIGHT") return "pending";
  if (data.action === "ESCALATE") return "escalate";
  if (data.action === "COMPLETE" || data.done) return "complete";
  if (!hasUsableQuestion(data)) return "failed";
  if (data.question_id === state.shownQuestionId) return "duplicate";
  return "question";
}

// Did the server keep the answer we just sent, even though it failed to come up
// with the next question? Changes the wording of the error card.
function answerWasSaved(data) {
  if (data?.answer_saved !== true) return false;
  if (["missing_answer", "unknown_case", "answer_too_long", "missing_question"].includes(data.reason)) return false;
  if (data.status === "SUCCESS" && data.question_id === state.shownQuestionId) return false;
  return true;
}

function stopPolling() {
  clearTimeout(pollTimer);
  pollTimer = null;
}

// The server is still thinking about the next question. Ask again every
// ~750ms for up to a minute, then give up and show the retry card.
function pollForQuestion(caseId, myRound) {
  stopPolling();
  showThinking();

  let attempts = 0;
  const tick = async () => {
    if (myRound !== round) return;
    attempts++;

    const data = await post("/api/resume", { case_id: caseId }, 12000);
    if (myRound !== round) return;

    let verdict = classify(data, myRound);
    if (verdict === "duplicate") {
      // Same question again after a lost reply — show it rather than hang.
      state.shownQuestionId = "";
      verdict = "question";
    }

    if (["question", "complete", "escalate"].includes(verdict)) {
      pollTimer = null;
      handleReply(data, myRound);
    } else if (verdict === "failed" || attempts >= 80) {
      pollTimer = null;
      showRetryCard(answerWasSaved(data));
    } else {
      pollTimer = setTimeout(tick, 750);
    }
  };

  pollTimer = setTimeout(tick, 350);
}

function handleReply(data, myRound) {
  const sameCase = !data?.case_id || !state.caseId || data.case_id === state.caseId;
  if (!sameCase) state.shownQuestionId = "";

  const verdict = classify(data, myRound);
  if (verdict === "stale" || verdict === "duplicate") return;

  if (verdict === "pending") {
    const caseId = data.case_id || state.caseId;
    if (caseId) pollForQuestion(caseId, myRound);
    return;
  }

  if (data?.case_id) {
    state.caseId = data.case_id;
    saveSession();
  }
  stopPolling();

  if (verdict === "escalate") {
    showEmergencyBanner();
    return showDone();
  }
  if (verdict === "complete") {
    return state.finalNoteOffered ? showDone() : showFinalNote();
  }

  // Throw away options the model got wrong (empty, "undefined", stray JSON).
  data.options = (data.options || []).filter((opt) => {
    const label = String(opt?.label || opt?.text || "").trim();
    return label && label !== "undefined" && label !== "null" && !/^[{[]/.test(label);
  });

  if (!hasUsableQuestion(data)) return showRetryCard(answerWasSaved(data));

  showQuestion(data);
  updateProgress();
  renderTrail();
}

/* ---------- interview flow ---------- */

function beginInterview(complaint) {
  clearEmergency();
  setYouSaid(complaint);
  questionArea.innerHTML = "";
  renderTrail();
  updateProgress();
  askNext();
}

function resumeInterview() {
  const saved = readSession();
  if (!saved) return;
  if (saved.lang) setLang(saved.lang);
  state = freshState();
  state.caseId = saved.case_id;
  showScreen("symptom");
  beginInterview("");
}

function forgetLostCase() {
  clearSession();
  state = freshState();
  questionArea.innerHTML = "";
  refreshResumeCard();
  showScreen("landing");
  toast(t("resumeGone"));
}

function lockCurrentCard() {
  questionArea.querySelectorAll("button, textarea, input").forEach((el) => (el.disabled = true));
}

// Start the case, or pick it back up after a refresh / failed request.
async function askNext() {
  if (busy) return;
  busy = true;
  const myRound = ++round;
  stopPolling();
  lockCurrentCard();
  showThinking();
  state.shownQuestionId = "";

  try {
    if (!(await apiIsUp())) {
      if (myRound === round) showRetryCard(false);
      return;
    }

    const data = state.caseId
      ? await post("/api/resume", { case_id: state.caseId })
      : await post("/api/start-case", { lang, chiefHint: state.patient.chiefHint || "", patient: state.patient });

    if (myRound !== round) return;
    if (state.caseId && data?.reason === "unknown_case") return forgetLostCase();

    handleReply(data, myRound);
  } catch {
    if (myRound === round) showRetryCard(false);
  } finally {
    if (myRound === round) busy = false;
  }
}

async function sendAnswer(question, answer, { ownWords = false, optionId = "", note = "" } = {}) {
  if (busy) return;
  busy = true;
  const myRound = ++round;
  stopPolling();
  lockCurrentCard();

  // A note typed next to a chosen option is sent along with it.
  const extraNote = !ownWords && note.trim() && note.trim() !== answer.trim() ? note : "";

  const last = state.answers.at(-1);
  if (!(last && last.q === question.q && last.a === answer)) {
    state.answers.push({ q: question.q, a: answer, ...(extraNote ? { note: extraNote } : {}) });
  }
  renderTrail();
  updateProgress();
  showThinking(answer);

  const body = {
    case_id: state.caseId,
    question_id: question.question_id || "",
    information_target: question.information_target || "",
    question: question.q,
    answer_mode: ownWords ? "custom_text" : "option",
    answer,
  };
  if (ownWords) {
    body.selected_option_id = "custom";
    body.text = answer;
  } else if (optionId) {
    body.selected_option_id = optionId;
  }
  if (extraNote) body.additional_text = extraNote;

  try {
    let data = await post("/api/submit-answer", body);

    // The reply got lost. Ask where the case stands — if the server is still on
    // the same question, our answer never arrived and we show it again.
    if (!data && state.caseId && myRound === round) {
      data = await post("/api/resume", { case_id: state.caseId });
      if (data?.status === "SUCCESS" && data.question_id === question.question_id) {
        state.shownQuestionId = "";
        showQuestion({ ...question, ...data, q: data.q || question.q, options: data.options?.length ? data.options : question.options });
        return;
      }
    }

    if (myRound !== round) return;
    if (!data) showRetryCard(false);
    else handleReply(data, myRound);
  } finally {
    if (myRound === round) busy = false;
  }
}

async function sendToDoctor(card) {
  if (sending || !state.caseId) return;
  sending = true;

  const button = card.querySelector(".btn-primary");
  const error = card.querySelector(".inline-error");
  button.disabled = true;
  button.classList.add("is-busy");
  button.textContent = t("sending");
  error.hidden = true;

  const data = await post("/api/submit-case", { case_id: state.caseId }, 15000);
  sending = false;

  if (data?.ok === true) {
    state.submitted = true;
    clearSession();
    showScreen("summary");
    $("done-title").focus({ preventScroll: true });
    return;
  }

  button.disabled = false;
  button.classList.remove("is-busy");
  button.textContent = t("sendRetry");
  error.textContent = t("sendFail");
  error.hidden = false;
}

/* ---------- interview rendering ---------- */

function setYouSaid(text) {
  $("said").hidden = !text;
  $("said-text").textContent = text;
}

function announce(text) {
  $("interview-status").textContent = text;
}

function answeredCount() {
  return Math.max(state.answers.length, state.serverAnswered);
}

function stageFor(answered) {
  if (answered < 4) return "stageUnderstanding";
  if (answered < 9) return "stageDetails";
  return "stageFinal";
}

function updateProgress() {
  let current = STAGES.indexOf(stageFor(answeredCount()));
  if (state.phase === "final") current = STAGES.length - 1;
  if (state.phase === "done") current = STAGES.length;

  document.querySelectorAll("#progress-track .stage").forEach((li, i) => {
    li.classList.toggle("is-done", i < current);
    li.classList.toggle("is-current", i === current);
    if (i === current) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
  });
}

function renderTrail() {
  const count = state.answers.length;
  $("trail").hidden = !count;
  $("trail-count").textContent = count ? String(count) : "";
  $("answer-trail").innerHTML = state.answers
    .map(
      (a) => `<li class="trail-item">
        <p class="trail-q">${esc(a.q)}</p>
        <p class="trail-a">${esc(a.a)}</p>
        ${a.note ? `<p class="trail-note">${esc(a.note)}</p>` : ""}
      </li>`
    )
    .join("");
}

function stageLabel() {
  return `<p class="q-step"><span class="q-step-dot" aria-hidden="true"></span><span class="q-step-count">${esc(t(stageFor(answeredCount())))}</span></p>`;
}

// Swap the visible card. The old one fades out and is removed; it loses its ids
// straight away so the new card can reuse them.
function mountCard(html, kind) {
  for (const old of questionArea.children) {
    if (old.classList.contains("is-leaving")) continue;
    old.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    old.setAttribute("aria-hidden", "true");
    old.inert = true;
    if (reduceMotion.matches) {
      old.remove();
    } else {
      old.classList.add("is-leaving");
      setTimeout(() => old.remove(), 260);
    }
  }

  const card = document.createElement("div");
  card.className = `qcard qcard-${kind}`;
  card.innerHTML = html;
  questionArea.appendChild(card);
  return card;
}

function focusCard(card) {
  card.querySelector(".question-text")?.focus({ preventScroll: true });
  const top = card.getBoundingClientRect().top;
  if (top < 72 || top > window.innerHeight * 0.6) {
    card.scrollIntoView({ block: "start", behavior: scrollMode() });
  }
}

function showThinking(answer = "") {
  questionArea.setAttribute("aria-busy", "true");
  announce(t("loadingNext"));

  const last = [...questionArea.children].filter((c) => !c.classList.contains("is-leaving")).at(-1);
  if (!answer && last?.classList.contains("qcard-loading")) return;

  const echo = answer
    ? `<p class="ack"><span class="ack-label">${esc(t("yourAnswer"))}</span><span class="ack-text">${esc(answer)}</span></p>`
    : "";

  mountCard(
    `${echo}
    <div class="loading">
      <span class="breath" aria-hidden="true"></span>
      <div>
        <p class="processing-title">${esc(t("loadingNext"))}</p>
        <p class="processing-sub">${esc(t("aiWaitingDetail"))}</p>
      </div>
    </div>
    <div class="skeleton" aria-hidden="true"><span></span><span></span><span></span></div>`,
    "loading"
  );
}

function doneThinking() {
  questionArea.removeAttribute("aria-busy");
  announce("");
}

function showQuestion(data) {
  if (data.question_id && data.question_id === state.shownQuestionId) return;
  state.shownQuestionId = data.question_id || "";

  doneThinking();
  state.phase = "ask";
  if (Number(data.index) > 0) state.serverAnswered = Number(data.index) - 1;

  const question = { ...data, options: [...(data.options || [])] };

  // If we're being shown the same question again, drop our optimistic answer to it.
  if (state.answers.at(-1)?.q === question.q) state.answers.pop();

  const options = question.options
    .map(
      (opt, i) => `<button type="button" class="option-btn" data-idx="${i}">
        <span class="opt-mark" aria-hidden="true"></span>
        <span class="opt-label">${esc(opt.label)}</span>
      </button>`
    )
    .join("");

  const card = mountCard(
    `${stageLabel()}
    <h2 class="question-text" tabindex="-1">${esc(question.q)}</h2>
    <div class="option-grid" role="group" aria-label="${esc(question.q)}">${options}</div>
    ${ownWordsBox()}`,
    "question"
  );

  card.querySelectorAll("[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.add("is-chosen");
      btn.setAttribute("aria-pressed", "true");
      card.classList.add("has-choice");
      const opt = question.options[Number(btn.dataset.idx)];
      const note = String(card.querySelector(".comment-input")?.value || "");
      sendAnswer(question, opt.label, { optionId: opt.id || "", note });
    });
  });

  wireOwnWords(card, (text) => sendAnswer(question, text, { ownWords: true }));

  updateProgress();
  renderTrail();
  focusCard(card);
}

// "Answer in my own words" — a collapsible textarea under each question.
function ownWordsBox() {
  const id = `own-words-${++commentBoxCount}`;
  return `
    <div class="own-words">
      <button type="button" class="own-words-toggle" aria-expanded="false" aria-controls="${id}-panel">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M14 6l4 4" /></svg>
        <span>${esc(t("ownWords"))}</span>
      </button>
      <div class="comment-write" id="${id}-panel" hidden>
        <label class="visually-hidden" for="${id}">${esc(t("ownWords"))}</label>
        <textarea id="${id}" class="input comment-input" rows="3" maxlength="4000" aria-describedby="${id}-hint" placeholder="${esc(t("ownWordsPh"))}"></textarea>
        <div class="comment-row">
          <p class="comment-hint" id="${id}-hint">${esc(t("ownWordsHint"))}</p>
          <button type="button" class="btn btn-primary comment-send">${esc(t("ownWordsSend"))}</button>
        </div>
      </div>
    </div>`;
}

function wireOwnWords(card, onSend) {
  const toggle = card.querySelector(".own-words-toggle");
  const panel = card.querySelector(".comment-write");
  const input = card.querySelector(".comment-input");
  const send = card.querySelector(".comment-send");

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (open) input.focus();
  });

  const submit = () => {
    if (!input.value.trim()) return input.focus();
    send.disabled = true;
    onSend(input.value);
  };

  send.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  });
}

// Last chance for the patient to add anything before the case goes to the doctor.
function showFinalNote() {
  doneThinking();
  state.phase = "final";
  updateProgress();

  const card = mountCard(
    `${stageLabel()}
    <h2 class="question-text" tabindex="-1">${esc(t("finalCommentTitle"))}</h2>
    <p class="question-help" id="final-help">${esc(t("finalCommentHelp"))}</p>
    <label class="visually-hidden" for="final-comment">${esc(t("finalCommentTitle"))}</label>
    <textarea class="input comment-input final-comment" id="final-comment" rows="4" maxlength="4000" aria-describedby="final-help" placeholder="${esc(t("finalCommentPh"))}"></textarea>
    <p class="inline-error" role="alert" hidden></p>
    <div class="card-actions">
      <button type="button" class="btn btn-primary" id="btn-final-comment">${esc(t("finalCommentDone"))} ${ARROW}</button>
    </div>`,
    "final"
  );

  const button = card.querySelector("#btn-final-comment");
  const error = card.querySelector(".inline-error");

  button.addEventListener("click", async () => {
    if (state.finalNoteOffered) return;
    state.finalNoteOffered = true;
    button.disabled = true;
    error.hidden = true;

    const text = card.querySelector(".final-comment").value.trim();
    if (text && state.caseId) {
      const saved = await post("/api/final-note", { case_id: state.caseId, text }, 15000);
      if (!saved) {
        state.finalNoteOffered = false;
        button.disabled = false;
        error.textContent = t("noteFail");
        error.hidden = false;
        return;
      }
      state.answers.push({ q: t("finalCommentTitle"), a: text });
    }
    showDone();
  });

  focusCard(card);
}

function showDone() {
  doneThinking();
  state.phase = "done";
  updateProgress();
  renderTrail();

  const card = mountCard(
    `<div class="done-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </div>
    <h2 class="question-text" tabindex="-1">${esc(t("intakeComplete"))}</h2>
    <p class="question-help">${esc(t("intakeCompleteSub"))}</p>
    <p class="inline-error" role="alert" hidden></p>
    <div class="card-actions">
      <button type="button" class="btn btn-primary btn-lg" id="btn-finish-symptom">${esc(t("sendDoctor"))}</button>
    </div>`,
    "done"
  );

  card.querySelector("#btn-finish-symptom").addEventListener("click", () => sendToDoctor(card));
  focusCard(card);
}

function showRetryCard(answerSaved) {
  doneThinking();

  const card = mountCard(
    `<div class="problem" role="alert">
      <span class="problem-icon" aria-hidden="true">!</span>
      <div>
        <p class="processing-title">${esc(t("aiQuestionFail"))}</p>
        <p class="processing-sub">${esc(t(answerSaved ? "aiQuestionFailDetail" : "aiQuestionFailContinue"))}</p>
      </div>
    </div>
    <div class="card-actions">
      <button type="button" class="btn btn-primary" id="btn-retry-question">${esc(t("aiQuestionRetry"))}</button>
    </div>`,
    "problem"
  );

  card.querySelector("#btn-retry-question").addEventListener("click", () => askNext());
}

function showEmergencyBanner() {
  if ($("emergency-banner")) return;

  const banner = document.createElement("div");
  banner.id = "emergency-banner";
  banner.className = "emergency";
  banner.setAttribute("role", "alert");
  banner.innerHTML = `
    <span class="emergency-icon" aria-hidden="true">!</span>
    <div class="emergency-body">
      <p class="emergency-title">${esc(t("emergencyTitle"))}</p>
      <p class="emergency-text">${esc(t("emergencyText"))}</p>
    </div>
    <a class="btn btn-danger emergency-call" href="tel:112">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
      ${esc(t("emergencyCall"))}
    </a>`;
  $("emergency-slot").appendChild(banner);
}

function clearEmergency() {
  $("emergency-banner")?.remove();
}

/* ---------- start over ---------- */

function startOver() {
  round++;
  stopPolling();
  busy = false;
  sending = false;
  state = freshState();
  clearSession();

  form.reset();
  clearFormErrors();
  syncFollowUps();
  questionArea.innerHTML = "";
  clearEmergency();
  setYouSaid("");
  renderTrail();
  goToStep(1);
  refreshResumeCard();
  showScreen("landing");
}

/* ---------- wiring ---------- */

// Never let the form submit natively — it would put personal data in the URL.
form.addEventListener("submit", (e) => {
  e.preventDefault();
  onFormSubmit();
});

form.addEventListener("input", (e) => {
  const input = e.target;
  if (input.name === "personalId") {
    const digits = input.value.replace(/\D/g, "").slice(0, 11);
    if (digits !== input.value) input.value = digits;
  }
  // Only re-check fields that are already showing an error.
  if (input.name && $(`err-${input.name}`)) setFieldError(input.name, problemWith(input.name));
});

form.addEventListener("change", (e) => {
  syncFollowUps();
  const name = e.target.name;
  if (name && $(`err-${name}`)) setFieldError(name, problemWith(name));
});

$("btn-step-back").addEventListener("click", () => {
  if (skipForm || formStep === 1) showScreen("landing");
  else goToStep(formStep - 1, -1);
});

$("btn-step-skip").addEventListener("click", () => goToStep(STEP_COUNT, 1));
$("btn-begin").addEventListener("click", openForm);
$("btn-resume").addEventListener("click", resumeInterview);
$("btn-resume-new").addEventListener("click", startOver);
$("btn-start-new").addEventListener("click", startOver);
$("btn-skip-form").addEventListener("click", () => setSkipForm(!skipForm));

$("btn-reset").addEventListener("click", () => $("reset-dialog").showModal());
$("btn-reset-no").addEventListener("click", () => $("reset-dialog").close());
$("btn-reset-yes").addEventListener("click", () => {
  $("reset-dialog").close();
  startOver();
});

document.querySelectorAll('input[name="lang-choice"]').forEach((radio) => radio.addEventListener("change", () => setLang(radio.value)));
document.querySelectorAll(".seg-btn").forEach((btn) => btn.addEventListener("click", () => setLang(btn.dataset.lang)));

makeNoneExclusive("chronicList");
makeNoneExclusive("familyList");
translatePage();
syncFollowUps();
goToStep(1);
refreshResumeCard();
showScreen("landing");
