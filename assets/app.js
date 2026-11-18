/* =========================================================
   NAZZARO — app.js  (no external libraries)
   i18n · catalog · 3D hero (snow + tilt) · 3D showroom ring
   3D tilt cards · scroll reveal · modal · request form
   ========================================================= */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
const sm = n => `img/sm/${n}.webp`, lg = n => `img/lg/${n}.webp`;
const srcset = n => `${sm(n)} 520w, ${lg(n)} 1000w`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------- state ---------------- */
let lang = "uz", filter = "all";
try { const s = localStorage.getItem("nazzaro_lang"); if (T[s]) lang = s; } catch (e) {}
const t = k => T[lang][k];
const P = p => p[lang];
const code = (p, c) => "N-" + (c.code || p.id);
const optLabel = (p, c) => `${code(p, c)} — ${P(p).n} (${t("colors")[c.c]})`;

/* ======================= i18n ======================= */
function applyLang() {
  document.documentElement.lang = lang;
  document.title = t("title");
  $('meta[name="description"]').content = t("meta_desc");
  $$("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
  $$("[data-i18n-html]").forEach(el => el.innerHTML = t(el.dataset.i18nHtml));
  $$("[data-i18n-ph]").forEach(el => el.placeholder = t(el.dataset.i18nPh));
  $$("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  $$("[data-i18n-list]").forEach(el => el.innerHTML = t(el.dataset.i18nList).map(x => `<li>${x}</li>`).join(""));
  $$("#langs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang));

  const fm = $("#f-model"), fs = $("#f-size"), ft = $("#f-type");
  const mi = fm.selectedIndex, si = fs.selectedIndex, ti = Math.max(ft.selectedIndex, 0);
  fm.innerHTML = `<option value="">${t("fm_no_model")}</option>` + PRODUCTS.flatMap(p => p.colors.map(c => `<option>${optLabel(p, c)}</option>`)).join("");
  fs.innerHTML = `<option value="">${t("fm_no_size")}</option>` + SIZES.map(s => `<option>${s}</option>`).join("");
  ft.innerHTML = t("types").map(x => `<option>${x}</option>`).join("");
  if (mi > 0) fm.selectedIndex = mi; if (si > 0) fs.selectedIndex = si; ft.selectedIndex = ti;

  renderGrid();
  Showroom.relabel();
  if (cur) paintModal();
  if ($("#result").classList.contains("show")) buildMsg();
}
$$("#langs button").forEach(b => b.addEventListener("click", () => {
  lang = b.dataset.lang;
  try { localStorage.setItem("nazzaro_lang", lang); } catch (e) {}
  applyLang();
}));

/* ======================= 3D tilt helper ======================= */
function tilt(host, target, max = 8, lift = 0) {
  if (!FINE || REDUCED) return;
  let raf = 0, rx = 0, ry = 0;
  host.addEventListener("pointermove", e => {
    const r = host.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    ry = (px - .5) * 2 * max; rx = (.5 - py) * 2 * max;
    target.style.setProperty("--gx", px * 100 + "%");
    target.style.setProperty("--gy", py * 100 + "%");
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => target.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${lift}px)`);
  });
  host.addEventListener("pointerleave", () => { cancelAnimationFrame(raf); target.style.transform = ""; });
}

/* ======================= catalog grid ======================= */
function renderGrid() {
  const g = $("#grid"); g.innerHTML = "";
  PRODUCTS.filter(p => filter === "all" || p.cat.includes(filter)).forEach(p => {
    const imgs = p.colors.flatMap(c => c.imgs);
    const el = document.createElement("article");
    el.className = "card";
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", `${P(p).n} — ${t("card_open")}`);
    el.innerHTML = `<div class="ph">
      <img class="main" src="${sm(imgs[0])}" srcset="${srcset(imgs[0])}" sizes="(max-width:900px) 50vw, 25vw" alt="${P(p).n}" loading="lazy">
      ${imgs[1] ? `<img class="alt" src="${sm(imgs[1])}" srcset="${srcset(imgs[1])}" sizes="(max-width:900px) 50vw, 25vw" alt="" loading="lazy">` : ""}
      <span class="glare"></span>
      ${p.badge ? `<span class="badge">${t("badges")[p.badge]}</span>` : ""}
      <span class="quick">${t("card_more")}</span></div>
      <div class="meta"><div class="name">${P(p).n}</div><div class="code">${t("card_model")} N-${p.colors.map(c => c.code || p.id).join(" / ")}</div>
      <div class="swatches">${p.colors.map(c => `<span class="sw" style="background:${HEX[c.c]}" title="${t("colors")[c.c]}"></span>`).join("")}</div></div>`;
    el.addEventListener("click", () => openModal(p, 0, el));
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(p, 0, el); } });
    tilt(el, $(".ph", el), 7, 10);
    g.appendChild(el);
  });
}
function setFilter(f) {
  filter = f;
  $$(".chip").forEach(x => x.setAttribute("aria-pressed", x.dataset.f === f));
  renderGrid();
}
$$(".chip").forEach(b => b.addEventListener("click", () => setFilter(b.dataset.f)));
$$("[data-go]").forEach(a => a.addEventListener("click", () => setFilter(a.dataset.go)));

/* ======================= HERO: 3D snow ======================= */
const Snow = (() => {
  const cv = $("#snow"); if (!cv || REDUCED) return { };
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1, running = false, mx = 0, my = 0, cx = 0, cy = 0;
  const N = innerWidth < 700 ? 90 : 180, F = 1.6;
  const P3 = Array.from({ length: N }, () => spawn(true));
  function spawn(any) {
    return { x: (Math.random() * 2 - 1) * 1.6, y: any ? Math.random() * 2 - 1 : -1.15,
             z: Math.random() * 2.6 + .4, vy: .0015 + Math.random() * .003,
             ph: Math.random() * 6.28, sw: .0006 + Math.random() * .0012, r: .6 + Math.random() * 1.6 };
  }
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame(tm) {
    if (!running) return;
    cx += (mx - cx) * .04; cy += (my - cy) * .04;
    ctx.clearRect(0, 0, W, H);
    const s = Math.min(W, H) * .55;
    for (const p of P3) {
      p.y += p.vy; p.ph += .01; p.x += Math.sin(p.ph) * p.sw;
      if (p.y > 1.15) Object.assign(p, spawn(false));
      const k = F / (p.z + F);                       // perspective divide
      const sx = W / 2 + (p.x - cx * (1 / p.z) * .25) * s * k * 1.6;
      const sy = H / 2 + (p.y - cy * (1 / p.z) * .25) * s * k * 1.6;
      const r = p.r * k * 1.4;
      const a = clamp(.15 + k * .65, 0, .85);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283);
      ctx.fillStyle = `rgba(245,236,222,${a})`; ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  addEventListener("resize", size, { passive: true });
  addEventListener("pointermove", e => { mx = (e.clientX / innerWidth - .5) * 2; my = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
  new IntersectionObserver(([en]) => {
    const vis = en.isIntersecting && !document.hidden;
    if (vis && !running) { running = true; size(); requestAnimationFrame(frame); }
    if (!vis) running = false;
  }).observe($("#hero"));
  document.addEventListener("visibilitychange", () => { if (document.hidden) running = false; else if (!running && $("#hero").getBoundingClientRect().bottom > 0) { running = true; requestAnimationFrame(frame); } });
  return {};
})();

/* ======================= HERO: floating 3D card ======================= */
(() => {
  const card = $("#heroCard"), stage = $("#hero"); if (!card || REDUCED) return;
  let tx = 0, ty = 0, rx = 0, ry = 0, last = 0, on = false;
  if (FINE) stage.addEventListener("pointermove", e => {
    const r = stage.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - .5) * 22;
    ty = ((e.clientY - r.top) / r.height - .5) * -16;
    card.style.setProperty("--gx", (e.clientX - r.left) / r.width * 100 + "%");
    card.style.setProperty("--gy", (e.clientY - r.top) / r.height * 100 + "%");
    last = performance.now();
  });
  card.style.transition = "none";
  function loop(now) {
    if (!on) return;
    if (now - last > 2500) { tx = Math.sin(now / 2200) * 9; ty = Math.cos(now / 2800) * 5; }   // idle sway
    rx += (ty - rx) * .06; ry += (tx - ry) * .06;
    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    requestAnimationFrame(loop);
  }
  new IntersectionObserver(([en]) => { if (en.isIntersecting && !on) { on = true; requestAnimationFrame(loop); } else if (!en.isIntersecting) on = false; }).observe(stage);
})();

/* ======================= 3D SHOWROOM (CSS 3D ring) ======================= */
const Showroom = (() => {
  const stage = $("#stage"), ring = $("#ring3d");
  const items = PRODUCTS.flatMap(p => p.colors.map((c, ci) => ({ p, ci, img: c.imgs[0] })));
  const N = items.length, STEP = 360 / N;
  let rot = 0, target = 0, R = 400, dragging = false, startX = 0, startRot = 0, vel = 0, lastX = 0, lastT = 0;
  let idleAt = performance.now(), visible = false, running = false, autoTimer = 0;

  ring.innerHTML = items.map((it, i) => `
    <div class="slide" data-i="${i}" style="--i:${i}">
      <div class="face"><img src="${sm(it.img)}" alt="" loading="lazy" draggable="false"><div class="lbl"></div></div>
    </div>`).join("");
  const slides = $$(".slide", ring);

  function layout() {
    const w = innerWidth < 600 ? Math.min(innerWidth * .44, 190) : innerWidth < 1100 ? 210 : clamp(innerWidth * .13, 220, 420);
    stage.style.setProperty("--sw", w + "px");
    R = (w / 2) / Math.tan(Math.PI / N) * 1.18;
    slides.forEach((s, i) => s.style.transform = `rotateY(${i * STEP}deg) translateZ(${R}px)`);
  }
  const front = () => ((Math.round(-rot / STEP) % N) + N) % N;
  let lastFront = -1;
  function draw() {
    ring.style.transform = `translateZ(${-R}px) rotateY(${rot}deg)`;
    slides.forEach((s, i) => {
      let a = ((i * STEP + rot) % 360 + 540) % 360 - 180;       // -180..180, 0 = front
      const k = Math.cos(a * Math.PI / 180);                      // 1 front, -1 back
      $(".face", s).style.filter = `brightness(${(.25 + .75 * clamp((k + .2) / 1.2, 0, 1)).toFixed(3)})`;
      s.style.zIndex = Math.round((k + 1) * 50);
    });
    const f = front();
    if (f !== lastFront) { lastFront = f; caption(); }
  }
  function caption() {
    const it = items[front()];
    $("#srName").textContent = `${code(it.p, it.p.colors[it.ci])} · ${P(it.p).n}`;
  }
  function loop() {
    if (!running) return;
    if (!dragging) {
      if (Math.abs(vel) > .02) { target += vel; vel *= .92; if (Math.abs(vel) <= .02) target = Math.round(target / STEP) * STEP; }
      rot += (target - rot) * .08;
    }
    draw();
    requestAnimationFrame(loop);
  }
  function go(d) { vel = 0; target = Math.round(target / STEP) * STEP - d * STEP; idleAt = performance.now(); }
  function autoplay() {
    clearInterval(autoTimer);
    if (REDUCED) return;
    autoTimer = setInterval(() => { if (visible && !dragging && performance.now() - idleAt > 4000) go(1); }, 3200);
  }

  stage.addEventListener("pointerdown", e => {
    dragging = true; stage.classList.add("dragging"); stage.setPointerCapture(e.pointerId);
    startX = lastX = e.clientX; startRot = rot; lastT = performance.now(); vel = 0; moved = 0;
  });
  let moved = 0;
  stage.addEventListener("pointermove", e => {
    if (!dragging) return;
    const now = performance.now(), dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    rot = target = startRot + dx * (innerWidth < 700 ? .35 : .22);
    vel = (e.clientX - lastX) / Math.max(now - lastT, 1) * 4.5; lastX = e.clientX; lastT = now;
  });
  const end = e => {
    if (!dragging) return;
    dragging = false; stage.classList.remove("dragging"); idleAt = performance.now();
    if (moved < 6) {           // a tap/click: rotate to slide, or open if already in front
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest(".slide");
      if (el) {
        const i = +el.dataset.i;
        if (i === front()) { const it = items[i]; openModal(it.p, it.ci, el); }
        else { let d = ((i - front()) % N + N) % N; if (d > N / 2) d -= N; go(d); }
      }
      vel = 0; return;
    }
    if (Math.abs(vel) < .3) { vel = 0; target = Math.round(rot / STEP) * STEP; }
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  $("#srPrev").addEventListener("click", () => go(-1));
  $("#srNext").addEventListener("click", () => go(1));
  $("#srOpen").addEventListener("click", () => { const it = items[front()]; openModal(it.p, it.ci, $("#srOpen")); });
  stage.tabIndex = 0;
  stage.addEventListener("keydown", e => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); if (e.key === "Enter") $("#srOpen").click(); });

  addEventListener("resize", () => { layout(); draw(); }, { passive: true });
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible && !running) { running = true; requestAnimationFrame(loop); }
    if (!visible) running = false;
  }, { rootMargin: "100px" }).observe(stage);
  layout(); draw(); autoplay();

  return { relabel() { slides.forEach((s, i) => { const it = items[i]; $(".lbl", s).textContent = code(it.p, it.p.colors[it.ci]); }); caption(); } };
})();

/* ======================= misc 3D bits ======================= */
$$("[data-tilt]").forEach(h => tilt(h, $(".tilt-target", h) || h, +h.dataset.tilt));
$$(".mat").forEach(m => m.addEventListener("click", () => { if (!FINE) m.classList.toggle("flip"); }));

/* about images: soft depth parallax */
const aboutImgs = $$("#aboutImgs img");
/* header state, progress bar, FAB, parallax — one rAF-throttled scroll handler */
let ticking = false;
function onScroll() {
  const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
  $("#hdr").classList.toggle("scrolled", y > 10);
  $("#progress").style.transform = `scaleX(${h > 0 ? y / h : 0})`;
  $("#fab").classList.toggle("show", y > innerHeight * .9 && $("#aloqa").getBoundingClientRect().top > innerHeight * .6);
  if (!REDUCED) aboutImgs.forEach((im, i) => {
    const r = im.getBoundingClientRect(), c = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    im.style.transform = `translateY(${c * (i ? -40 : 30)}px) rotateY(${c * (i ? 6 : -6)}deg)`;
  });
  ticking = false;
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

/* ======================= scroll reveal ======================= */
const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: .12, rootMargin: "0px 0px -40px 0px" });
$$(".reveal").forEach(el => io.observe(el));

/* ======================= product modal ======================= */
let cur = null, ci = 0, size = null, opener = null;
function openModal(p, colorIndex = 0, from = null) {
  cur = p; ci = colorIndex; size = null; opener = from;
  $("#m-sizes").innerHTML = SIZES.map(s => `<button aria-pressed="false">${s}</button>`).join("");
  $$("#m-sizes button").forEach(b => b.addEventListener("click", () => {
    size = b.textContent; $("#m-hint").style.display = "none";
    $$("#m-sizes button").forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  $("#m-hint").style.display = "none";
  $("#m-guide").classList.remove("show"); $("#m-guide-btn").setAttribute("aria-expanded", "false");
  paintModal();
  $("#modal").classList.add("open"); $("#modal").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => $(".close").focus(), 50);
}
function paintModal() {
  const p = cur, c = p.colors[ci];
  $("#m-name").textContent = P(p).n; $("#m-desc").textContent = P(p).d;
  $("#m-colors").innerHTML = p.colors.map((x, i) => `<button style="background:${HEX[x.c]}" data-i="${i}" aria-pressed="${i === ci}" aria-label="${t("colors")[x.c]}"></button>`).join("");
  $$("#m-colors button").forEach(b => b.addEventListener("click", () => { ci = +b.dataset.i; paintModal(); }));
  $("#m-spec").innerHTML = `<li><span>${t("sp_material")}</span><span>${P(p).m}</span></li><li><span>${t("sp_collar")}</span><span>${P(p).c}</span></li><li><span>${t("sp_fast")}</span><span>${P(p).f}</span></li><li><span>${t("sp_sizes")}</span><span>46 — 60</span></li>`;
  $("#m-code").textContent = t("card_model").toUpperCase() + " " + code(p, c);
  $("#m-color-name").textContent = t("colors")[c.c];
  $("#m-big").src = lg(c.imgs[0]); $("#m-big").alt = P(p).n;
  $("#m-thumbs").innerHTML = c.imgs.length > 1 ? c.imgs.map((n, i) => `<button aria-pressed="${!i}"><img src="${sm(n)}" alt=""></button>`).join("") : "";
  $("#m-thumbs").style.display = c.imgs.length > 1 ? "flex" : "none";
  $$("#m-thumbs button").forEach((b, i) => b.addEventListener("click", () => {
    $("#m-big").src = lg(c.imgs[i]);
    $$("#m-thumbs button").forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  $("#m-guide").innerHTML = `<table><thead><tr><th>${t("sg_size")}</th>${SIZES.map(s => `<th>${s}</th>`).join("")}</tr></thead>
    <tbody><tr><td>${t("sg_chest")}</td>${SIZES.map(s => `<td>${s * 2}</td>`).join("")}</tr></tbody></table><p>${t("sg_note")}</p>`;
}
tilt($("#m-bigwrap"), $("#m-bigwrap"), 5);
$("#m-guide-btn").addEventListener("click", e => {
  const g = $("#m-guide"), on = !g.classList.contains("show");
  g.classList.toggle("show", on); e.currentTarget.setAttribute("aria-expanded", on);
});
function closeModal() {
  $("#modal").classList.remove("open"); $("#modal").setAttribute("aria-hidden", "true");
  document.body.style.overflow = ""; cur = null;
  if (opener && opener.focus) opener.focus({ preventScroll: true });
}
$$("[data-close]").forEach(e => e.addEventListener("click", closeModal));
document.addEventListener("keydown", e => {
  if (!$("#modal").classList.contains("open")) return;
  if (e.key === "Escape") closeModal();
  if (e.key === "Tab") {                                  // simple focus trap
    const f = $$("#modal button, #modal a").filter(x => x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});
function toForm(custom) {
  const label = optLabel(cur, cur.colors[ci]);
  const fm = $("#f-model"); [...fm.options].forEach((o, i) => { if (o.text === label) fm.selectedIndex = i; });
  $("#f-size").value = custom ? "" : (size || "");
  $("#f-type").selectedIndex = custom ? 1 : 0;
  opener = null; closeModal();
  $("#aloqa").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
  setTimeout(() => $("#f-name").focus({ preventScroll: true }), 600);
}
$("#m-order").addEventListener("click", () => { if (!size) { $("#m-hint").style.display = "block"; return; } toForm(false); });
$("#m-custom").addEventListener("click", () => toForm(true));

/* ======================= request form ======================= */
function buildMsg() {
  const txt = `${t("msg_head")}
${t("msg_name")}: ${$("#f-name").value.trim()}
${t("ct_phone")}: ${$("#f-phone").value.trim()}
${t("msg_model")}: ${$("#f-model").value || t("msg_none")}
${t("msg_size")}: ${$("#f-size").value || t("msg_measure")}
${t("msg_type")}: ${$("#f-type").value}
${t("msg_note")}: ${$("#f-msg").value.trim() || "—"}`;
  $("#result-text").textContent = txt;
  $("#tg-link").href = "https://t.me/share/url?url=&text=" + encodeURIComponent(txt);
}
$("#form").addEventListener("submit", e => {
  e.preventDefault();
  const fields = [$("#f-name"), $("#f-phone")];
  fields.forEach(i => i.classList.toggle("invalid", !i.value.trim()));
  const bad = fields.find(i => !i.value.trim());
  if (bad) { bad.focus(); return; }
  buildMsg(); $("#result").classList.add("show"); $("#copy-btn").textContent = t("fm_copy");
});
$$("#f-name, #f-phone").forEach(i => i.addEventListener("input", () => i.classList.remove("invalid")));
$("#copy-btn").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#result-text").textContent); $("#copy-btn").textContent = t("fm_copied"); }
  catch (e) { $("#copy-btn").textContent = t("fm_copy_fail"); }
});

/* ======================= mobile menu ======================= */
$("#burger").addEventListener("click", () => {
  const open = !$("#menu").classList.contains("mobile");
  $("#menu").classList.toggle("mobile", open); $("#burger").classList.toggle("open", open);
  $("#burger").setAttribute("aria-expanded", open);
});
$$("#menu a").forEach(a => a.addEventListener("click", () => {
  $("#menu").classList.remove("mobile"); $("#burger").classList.remove("open"); $("#burger").setAttribute("aria-expanded", "false");
}));

applyLang();
onScroll();
})();
