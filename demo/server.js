// Demo server for running MedIntake without the real backend.
//
//   node demo/server.js            → http://localhost:8080
//   PORT=3000 node demo/server.js
//
// Serves the static files and fakes the patient API with a short scripted
// interview (no AI involved). For the clinician side open
// http://localhost:8080/doctor/?fixture=1 — that uses doctor/dev-fixtures.js.
//
// Nothing is stored: cases live in memory and vanish when you stop the server.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// The scripted interview. Each question has a Georgian and English version;
// the language comes from the start-case request.
const SCRIPT = [
  {
    target: "onset",
    ge: ["როდის დაიწყო თავის ტკივილი?", ["დღეს", "1–3 დღის წინ", "ერთ კვირაზე მეტი ხნის წინ", "ხშირად მაქვს, თვეებია"]],
    en: ["When did the headache start?", ["Today", "1–3 days ago", "More than a week ago", "I get them often, for months"]],
  },
  {
    target: "location",
    ge: ["სად გტკივათ ყველაზე მეტად?", ["შუბლში", "საფეთქლებში", "კეფაში", "მთელ თავში"]],
    en: ["Where does it hurt the most?", ["Forehead", "Temples", "Back of the head", "All over"]],
  },
  {
    target: "severity",
    ge: ["რამდენად ძლიერია ტკივილი 0-დან 10-მდე?", ["1–3, მსუბუქი", "4–6, საშუალო", "7–8, ძლიერი", "9–10, აუტანელი"]],
    en: ["How bad is the pain from 0 to 10?", ["1–3, mild", "4–6, moderate", "7–8, severe", "9–10, the worst ever"]],
  },
  {
    target: "associated",
    ge: ["ახლავს თუ არა რომელიმე ამათგან?", ["გულისრევა", "სინათლის აუტანლობა", "მხედველობის დარღვევა", "არცერთი"]],
    en: ["Do you have any of these as well?", ["Nausea", "Light hurts my eyes", "Changes in vision", "None of these"]],
  },
  {
    target: "relief",
    ge: ["გიშველით ტკივილგამაყუჩებელმა?", ["დიახ, მთლიანად", "ცოტათი", "არა", "არ მიმიღია"]],
    en: ["Did a painkiller help?", ["Yes, completely", "A little", "No", "I haven't taken any"]],
  },
];

const cases = new Map();

function questionFor(c) {
  const step = SCRIPT[c.step];
  const [q, labels] = step[c.lang] || step.en;
  return {
    status: "SUCCESS",
    case_id: c.id,
    question_id: `${c.id}-q${c.step + 1}`,
    information_target: step.target,
    q,
    options: labels.map((label, i) => ({ id: `opt${i + 1}`, label })),
    index: c.step + 1,
    total: SCRIPT.length,
  };
}

function nextReply(c) {
  if (c.step >= SCRIPT.length) return { status: "SUCCESS", case_id: c.id, action: "COMPLETE" };
  return questionFor(c);
}

const api = {
  "GET /api/status": () => ({ ok: true, mode: "demo" }),

  "POST /api/start-case": (body) => {
    const id = crypto.randomUUID().slice(0, 8);
    const c = { id, lang: body.lang === "en" ? "en" : "ge", step: 0, answers: [], patient: body.patient || {} };
    cases.set(id, c);
    return nextReply(c);
  },

  "POST /api/resume": (body) => {
    const c = cases.get(body.case_id);
    if (!c) return { reason: "unknown_case" };
    return nextReply(c);
  },

  "POST /api/submit-answer": (body) => {
    const c = cases.get(body.case_id);
    if (!c) return { reason: "unknown_case" };
    if (body.question_id === `${c.id}-q${c.step + 1}`) {
      c.answers.push({ q: body.question, a: body.answer });
      c.step++;
    }
    return { ...nextReply(c), answer_saved: true };
  },

  "POST /api/final-note": (body) => {
    const c = cases.get(body.case_id);
    if (!c) return { reason: "unknown_case" };
    c.note = String(body.text || "");
    return { ok: true };
  },

  "POST /api/submit-case": (body) => {
    const c = cases.get(body.case_id);
    if (!c) return { ok: false, reason: "unknown_case" };
    c.submitted = true;
    console.log(`case ${c.id} submitted (${c.answers.length} answers)`);
    return { ok: true };
  },
};

function readJson(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function serveFile(res, urlPath) {
  let file = path.join(ROOT, decodeURIComponent(urlPath));
  // Stay inside the project folder.
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return sendJson(res, 403, { error: "forbidden" });
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (path.relative(ROOT, file).split(path.sep)[0] === "demo") return sendJson(res, 404, { error: "not_found" });

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const route = api[`${req.method} ${url.pathname}`];

  if (route) {
    const body = req.method === "POST" ? await readJson(req) : {};
    // A little delay so the "thinking" state is visible, like with a real model.
    setTimeout(() => sendJson(res, 200, route(body)), req.method === "POST" ? 600 : 0);
    return;
  }

  if (url.pathname.startsWith("/api/")) return sendJson(res, 404, { error: "not_found" });
  serveFile(res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`MedIntake demo running at http://localhost:${PORT}`);
  console.log(`Clinician view:          http://localhost:${PORT}/doctor/?fixture=1`);
});
