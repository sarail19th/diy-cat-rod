(function () {
  "use strict";

  var C = window.CONFIG, D = window.CATALOG, I = window.I18N;
  var $ = function (s) { return document.querySelector(s); };
  var DEFAULT_SHOPEE = "https://shopee.co.th/search?keyword={kw}";

  /* ---------------- helpers ---------------- */
  function find(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function snap(v, r) { return clamp(Math.round(v / r.step) * r.step, r.min, r.max); }
  function fmt(n) { n = Math.round(n * 10) / 10; return n % 1 === 0 ? String(n) : n.toFixed(1); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  function setText(id, s) { $(id).textContent = s; }

  var lang = lsGet("catwand.lang") === "en" ? "en" : "th";
  function t(key, vars) {
    var s = (I[lang][key] !== undefined ? I[lang][key] : I.th[key]) || key;
    if (vars) for (var k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }
  function nm(o) { return o.name[lang]; }

  /* ---------------- state ---------------- */
  // items: toys on the line. at = cm from the rod tip along the line (strLen = end of line).
  function defaults() {
    return {
      length: D.length.def, material: "bamboo", rodD: 4,
      handle: "foam", handleLen: D.handleLen.def,
      strLen: D.line.def, strType: "cotton",
      person: D.person.def, cat: "adult",
      items: [{ id: "fish", at: D.line.def }, { id: "ribbon", at: 22 }]
    };
  }

  function serialize(s) {
    var items = s.items.map(function (it) { return it.id + "." + it.at; }).join(",");
    return new URLSearchParams({
      l: s.length, m: s.material, d: s.rodD, h: s.handle, hl: s.handleLen,
      sl: s.strLen, st: s.strType, ph: s.person, cs: s.cat, i: items
    }).toString();
  }

  function parse(qs) {
    var q = new URLSearchParams(qs);
    if (!q.has("l")) return null;
    var s = defaults();
    s.length = snap(parseFloat(q.get("l")) || D.length.def, D.length);
    if (find(D.materials, q.get("m"))) s.material = q.get("m");
    var m = find(D.materials, s.material), d = parseFloat(q.get("d"));
    s.rodD = m.sizes.indexOf(d) >= 0 ? d : m.dDef;
    if (find(D.handles, q.get("h"))) s.handle = q.get("h");
    s.handleLen = snap(parseFloat(q.get("hl")) || D.handleLen.def, D.handleLen);
    s.strLen = snap(parseFloat(q.get("sl")) || D.line.def, D.line);
    if (find(D.lines, q.get("st"))) s.strType = q.get("st");
    s.person = snap(parseFloat(q.get("ph")) || D.person.def, D.person);
    if (find(D.cats, q.get("cs"))) s.cat = q.get("cs");
    s.items = [];
    var left = C.MAX_ATTACH;
    (q.get("i") || "").split(",").forEach(function (tok) {
      var id, at, n = 1, p;
      if (!tok || left <= 0) return;
      if (tok.indexOf(".") > 0) { p = tok.split("."); id = p[0]; at = parseFloat(p[1]); }
      else if (tok.indexOf(":") > 0) { p = tok.split(":"); id = p[0]; n = Math.floor(parseFloat(p[1])); at = s.strLen; } // older links
      else return;
      if (!find(D.toys, id)) return;
      for (var k = 0; k < n && left > 0; k++) {
        s.items.push({ id: id, at: clamp(Math.round(isNaN(at) ? s.strLen : at), 0, s.strLen) });
        left--;
      }
    });
    return s;
  }

  var state = parse(location.search) || defaults();

  function setStrLen(v) {
    var old = state.strLen;
    state.strLen = v;
    state.items.forEach(function (it) { it.at = it.at >= old ? v : Math.min(it.at, v); });
  }

  /* ---------------- physics ---------------- */
  // Weight per cm and stiffness of a rod from its real size and typical material values.
  function rodSpec(m, d) {
    var inner = m.wall ? Math.max(0, d - 2 * m.wall) : 0;
    var area = Math.PI / 4 * (d * d - inner * inner) / 100;                         // cm2
    var I2 = Math.PI * (Math.pow(d, 4) - Math.pow(inner, 4)) / 64 * 1e-12;        // m4
    return { gpc: area * m.rho, EI: m.E * 1e9 * I2 };                               // g per cm, N m2
  }
  // Tip load (g) a rod carries before its tip droops DEFLECT of its length (cantilever beam).
  function flexLimit(EI, Lcm) { var Lm = Lcm / 100; return 3 * EI * C.DEFLECT / (Lm * Lm) / 9.81 * 1000; }
  // Longest rod (cm) that carries tipG grams to the same droop.
  function maxLenFor(EI, tipG) { var N = Math.max(tipG, 0.1) / 1000 * 9.81; return Math.sqrt(3 * EI * C.DEFLECT / N) * 100; }

  function calc(s) {
    var m = find(D.materials, s.material), h = find(D.handles, s.handle), ln = find(D.lines, s.strType);
    var sp = rodSpec(m, s.rodD);
    var rod = s.length * sp.gpc, hand = (h.bare ? sp.gpc : h.gpc) * s.handleLen;
    var str = s.strLen * ln.gpcm, toys = 0;
    s.items.forEach(function (it) { toys += find(D.toys, it.id).g; });
    var tip = str + toys, total = rod + hand + tip;
    var limit = flexLimit(sp.EI, s.length);

    // Torque about the middle of the handle with the wand held level. The handle itself
    // is centred on the grip so it adds weight but no torque.
    var g2b = s.handleLen / 2;
    var moment = rod * (g2b + s.length / 2) + tip * (g2b + s.length);       // g cm

    var thick = null;
    if (tip / limit > 1) {
      for (var i = 0; i < m.sizes.length; i++) {
        if (m.sizes[i] > s.rodD && flexLimit(rodSpec(m, m.sizes[i]).EI, s.length) * 0.7 >= tip) { thick = m.sizes[i]; break; }
      }
    }
    return {
      m: m, h: h, ln: ln, sp: sp, rod: rod, hand: hand, str: str, toys: toys, tip: tip, total: total,
      limit: limit, ratio: tip / limit,
      lmax: Math.floor(maxLenFor(sp.EI, tip) / D.length.step) * D.length.step,
      moment: moment, felt: moment / C.WRIST_ARM, balance: moment / total,
      gripD: h.bare ? s.rodD : h.d, n: s.items.length, thick: thick
    };
  }

  function evaluate(c) {
    var rod, wrist, grip, msgs = [], gl = "good", key;
    if (c.ratio > 1) {
      key = c.lmax < D.length.min ? "vRodBadShort" : (c.thick ? "vRodBadThick" : "vRodBad");
      rod = { lv: "bad", text: t(key, { tip: fmt(c.tip), lmax: c.lmax, d: c.thick }) };
    } else if (c.ratio > 0.7) rod = { lv: "warn", text: t("vRodWarn") };
    else rod = { lv: "good", text: t("vRodGood") };

    var wl = c.felt > C.WRIST_MAX ? "bad" : c.felt > C.WRIST_GOOD ? "warn" : "good";
    wrist = { lv: wl, text: t({ good: "vWristGood", warn: "vWristWarn", bad: "vWristBad" }[wl], { felt: fmt(c.felt), arm: C.WRIST_ARM }) };

    var gd = c.gripD, hl = state.handleLen;
    if (gd < 10) { gl = "bad"; msgs.push(t("gripPinch", { d: fmt(gd) })); }
    else if (gd < 25) { gl = "warn"; msgs.push(t("gripThin", { d: fmt(gd) })); }
    if (hl < 10) { gl = "bad"; msgs.push(t("gripShort", { len: hl })); }
    else if (hl < 12) { if (gl === "good") gl = "warn"; msgs.push(t("gripShortWarn", { len: hl })); }
    if (c.h.slick) { if (gl === "good") gl = "warn"; msgs.push(t("gripSlick")); }
    grip = { lv: gl, text: msgs.length ? msgs.join(" ") : t("gripGood", { d: fmt(gd), len: hl }) };

    var order = { good: 0, warn: 1, bad: 2 };
    var worst = [rod, wrist, grip].reduce(function (a, x) { return order[x.lv] > order[a] ? x.lv : a; }, "good");
    return { rod: rod, wrist: wrist, grip: grip, worst: worst };
  }

  function prices(s) {
    var c = calc(s), rows = [], counts = {};
    rows.push({ label: t("rodLine", { mat: nm(c.m), len: s.length }), v: Math.round(c.m.base + c.m.perCm * s.length) });
    if (!c.h.bare) rows.push({ label: t("handleLine", { handle: nm(c.h) }), v: c.h.price });
    rows.push({ label: t("lineLine", { line: nm(c.ln), len: s.strLen }), v: Math.round(c.ln.perCm * s.strLen) });
    s.items.forEach(function (it) { counts[it.id] = (counts[it.id] || 0) + 1; });
    D.toys.forEach(function (toy) {
      var q = counts[toy.id] || 0;
      if (q) rows.push({ label: nm(toy) + " × " + q, v: toy.price * q });
    });
    rows.push({ label: t("assembly"), v: C.ASSEMBLY_FEE });
    rows.push({ label: t("shipping"), v: C.SHIPPING_FEE });
    var sum = rows.reduce(function (a, r) { return a + r.v; }, 0);
    return { rows: rows, total: sum };
  }

  function countBy(s) {
    var counts = {};
    s.items.forEach(function (it) { counts[it.id] = (counts[it.id] || 0) + 1; });
    return counts;
  }

  /* ---------------- toy drawings (top of each toy at 0,0, hangs down) ---------------- */
  function pompomSvg() {
    var o = '<circle cx="0" cy="13" r="11" fill="#E8547A"/>';
    for (var i = 0; i < 14; i++) {
      var a = i * Math.PI * 2 / 14, c = Math.cos(a), s = Math.sin(a);
      o += '<line x1="' + (c * 8).toFixed(1) + '" y1="' + (13 + s * 8).toFixed(1) + '" x2="' + (c * 13.5).toFixed(1) + '" y2="' + (13 + s * 13.5).toFixed(1) + '" stroke="#F2879F" stroke-width="2" stroke-linecap="round"/>';
    }
    return o + '<circle cx="-3" cy="9" r="3" fill="#fff" opacity=".35"/>';
  }

  var TOY = {
    fish: '<g transform="translate(0,17) rotate(90)"><path d="M12 0 L25 -10 L25 10Z" fill="#F4B63F" stroke="#B5822A" stroke-width="1"/><path d="M-16 0 C-8 -12 8 -12 14 0 C8 12 -8 12 -16 0Z" fill="#F4B63F" stroke="#B5822A" stroke-width="1"/><circle cx="-8" cy="-3" r="1.9" fill="#1B2347"/><path d="M-1 -8 Q3 0 -1 8" fill="none" stroke="#1B2347" stroke-width="1.2" stroke-dasharray="2 2"/></g>',
    mouse: '<g transform="translate(0,15) rotate(90)"><path d="M14 0 Q27 -9 33 4" fill="none" stroke="#E58FA3" stroke-width="2.2" stroke-linecap="round"/><ellipse rx="15" ry="9.5" fill="#C9CED8" stroke="#8D95A8" stroke-width="1"/><circle cx="-5" cy="-9" r="5" fill="#F2A6B8" stroke="#8D95A8" stroke-width="1"/><circle cx="-5" cy="9" r="5" fill="#F2A6B8" stroke="#8D95A8" stroke-width="1"/><circle cx="-10" cy="-3" r="1.6" fill="#1B2347"/><circle cx="-15" cy="0" r="2" fill="#E8547A"/></g>',
    feather: '<g transform="translate(0,2)"><path transform="rotate(-20)" d="M0 0 C-8 10 -7 26 0 36 C7 26 8 10 0 0Z" fill="#F6F7FB"/><path transform="rotate(20)" d="M0 0 C-8 10 -7 26 0 36 C7 26 8 10 0 0Z" fill="#F4B63F"/><path d="M0 0 C-8 10 -7 26 0 38 C7 26 8 10 0 0Z" fill="#E8547A"/><path d="M0 2 L0 36" stroke="#8E2442" stroke-width="1"/></g>',
    bell: '<circle cx="0" cy="1.5" r="1.8" fill="none" stroke="#9A6E12" stroke-width="1.2"/><circle cx="0" cy="11" r="8" fill="#E3A92B" stroke="#9A6E12" stroke-width="1"/><path d="M-8 12 H8" stroke="#9A6E12" stroke-width="1.4"/><circle cx="0" cy="14.5" r="1.5" fill="#9A6E12"/><ellipse cx="-3" cy="7" rx="2" ry="3" fill="#fff" opacity=".5"/>',
    ribbon: '<circle cx="0" cy="2" r="2.4" fill="#F4B63F"/><path d="M-1 3 C-10 12 6 20 -3 30 C-7 36 -1 40 -3 46" fill="none" stroke="#E8547A" stroke-width="5" stroke-linecap="round"/><path d="M2 3 C8 10 -2 18 6 27 C9 32 5 36 7 40" fill="none" stroke="#F4B63F" stroke-width="4" stroke-linecap="round"/>',
    pompom: pompomSvg(),
    nip: '<path d="M-6 3 Q-12 12 -11 20 Q-10 28 0 28 Q10 28 11 20 Q12 12 6 3Z" fill="#6FBF73" stroke="#3E8A43" stroke-width="1"/><path d="M-7 5 H7" stroke="#F4B63F" stroke-width="2"/><path d="M-6 17 q6 -6 12 0 q-6 6 -12 0z" fill="#3E8A43" opacity=".55"/>',
    crinkle: '<circle cx="0" cy="11" r="10" fill="#D6DCE5" stroke="#98A2B8" stroke-width="1"/><path d="M-7 6 L1 10 L-5 16 M3 4 L6 12 L1 17" fill="none" stroke="#98A2B8" stroke-width="1.2"/><ellipse cx="-3.5" cy="6" rx="3" ry="2" fill="#fff" opacity=".7"/>'
  };

  // Where toys hang. Toys at the same spot on the line fan out sideways; toys partway
  // along the line hang a little to the side so the line stays visible.
  function layoutItems(items, spacing, baseOff, strLen) {
    var order = items.map(function (it, i) { return { it: it, i: i }; })
      .sort(function (a, b) { return a.it.at - b.it.at || a.i - b.i; });
    var placed = [], out = [];
    order.forEach(function (o) {
      var near = 0, dx;
      placed.forEach(function (p) { if (Math.abs(p - o.it.at) < 9) near++; });
      if (near === 0) dx = o.it.at < strLen ? baseOff : 0;
      else dx = (near % 2 ? -1 : 1) * Math.ceil(near / 2) * spacing;
      placed.push(o.it.at);
      out.push({ id: o.it.id, at: o.it.at, dx: dx });
    });
    return out;
  }

  /* ---------------- handle decoration ---------------- */
  function handleDecor(id, w, hpx) {
    var o = "", i, h = w / 2, step;
    if (id === "foam") {
      for (i = 1; i < 7; i++) o += '<line x1="' + (-hpx + i * hpx / 7).toFixed(1) + '" y1="' + -h + '" x2="' + (-hpx + i * hpx / 7).toFixed(1) + '" y2="' + h + '" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/>';
    } else if (id === "cork") {
      for (i = 0; i < 30; i++) o += '<circle cx="' + (-hpx + 4 + (i * 53) % (hpx - 8)) + '" cy="' + (((i * 29) % Math.max(w - 6, 1)) - h + 3) + '" r="' + (1 + (i % 3) * 0.5) + '" fill="rgba(110,70,30,.55)"/>';
    } else if (id === "wood") {
      for (i = 1; i < 9; i++) o += '<line x1="' + (-hpx + i * hpx / 9).toFixed(1) + '" y1="' + -h + '" x2="' + (-hpx + i * hpx / 9).toFixed(1) + '" y2="' + h + '" stroke="rgba(60,30,10,.4)" stroke-width="1.5"/>';
    } else if (id === "tape") {
      for (i = 0; i < 20; i++) o += '<path d="M' + (-hpx - 10 + i * 9) + ' ' + h + ' L' + (-hpx - 10 + i * 9 + w) + ' ' + -h + '" stroke="rgba(255,255,255,.4)" stroke-width="2"/>';
    } else if (id === "cord") {
      step = 8;
      for (i = 0; i < 18; i++) o += '<path d="M' + (-hpx - 10 + i * step) + ' ' + h + ' L' + (-hpx - 10 + i * step + step) + ' ' + -h + ' M' + (-hpx - 10 + i * step) + ' ' + -h + ' L' + (-hpx - 10 + i * step + step) + ' ' + h + '" stroke="rgba(27,35,71,.35)" stroke-width="1.5" fill="none"/>';
    } else if (id === "silicone") {
      for (i = 1; i < 12; i++) o += '<line x1="' + (-hpx + i * hpx / 12).toFixed(1) + '" y1="' + -h + '" x2="' + (-hpx + i * hpx / 12).toFixed(1) + '" y2="' + h + '" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>';
    } else if (id === "plastic") {
      o += '<line x1="' + -hpx + '" y1="' + (-h * 0.35).toFixed(1) + '" x2="8" y2="' + (-h * 0.35).toFixed(1) + '" stroke="rgba(255,255,255,.85)" stroke-width="2"/>';
    }
    return o;
  }

  /* ---------------- stage ---------------- */
  var toastTimer;
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 1800);
  }

  function wiggle() {
    var g = $("#swing");
    if (!g) return;
    g.classList.remove("go");
    void g.getBoundingClientRect();
    g.classList.add("go");
  }

  function renderStage(c, doSwing) {
    var L = state.length, X0 = 130, Y0 = 295, base = -26 * Math.PI / 180;
    var rodPx = 130 + (L - 30) * 3.3;
    var bend = Math.min(1.05, 0.05 + 0.62 * Math.min(c.ratio, 1.6));
    var N = 28, seg = rodPx / N, pts = [{ x: X0, y: Y0, a: base }], x = X0, y = Y0, a, i;
    for (i = 1; i <= N; i++) {
      a = base + bend * Math.pow(i / N, 1.6);
      x += Math.cos(a) * seg; y += Math.sin(a) * seg;
      pts.push({ x: x, y: y, a: a });
    }
    var left = [], right = [];
    pts.forEach(function (p, k) {
      var hw = 4.6 - 2.4 * (k / N), nx = -Math.sin(p.a), ny = Math.cos(p.a);
      left.push((p.x + nx * hw).toFixed(1) + " " + (p.y + ny * hw).toFixed(1));
      right.push((p.x - nx * hw).toFixed(1) + " " + (p.y - ny * hw).toFixed(1));
    });
    var rodD = "M" + left.join(" L") + " L" + right.reverse().join(" L") + " Z";
    var svg = "";

    // length ruler above the rod (straight baseline)
    var dx = Math.cos(base), dy = Math.sin(base), nx0 = dy, ny0 = -dx;
    var off = 40, rs = { x: X0 + nx0 * off, y: Y0 + ny0 * off }, re = { x: rs.x + dx * rodPx, y: rs.y + dy * rodPx };
    var tk = 6;
    svg += '<g stroke="rgba(255,255,255,.7)" stroke-width="1.5" fill="none">' +
      '<line x1="' + rs.x.toFixed(1) + '" y1="' + rs.y.toFixed(1) + '" x2="' + re.x.toFixed(1) + '" y2="' + re.y.toFixed(1) + '" stroke-dasharray="5 5"/>' +
      '<line x1="' + (rs.x - nx0 * tk).toFixed(1) + '" y1="' + (rs.y - ny0 * tk).toFixed(1) + '" x2="' + (rs.x + nx0 * tk).toFixed(1) + '" y2="' + (rs.y + ny0 * tk).toFixed(1) + '"/>' +
      '<line x1="' + (re.x - nx0 * tk).toFixed(1) + '" y1="' + (re.y - ny0 * tk).toFixed(1) + '" x2="' + (re.x + nx0 * tk).toFixed(1) + '" y2="' + (re.y + ny0 * tk).toFixed(1) + '"/></g>';
    var mx = (rs.x + re.x) / 2 + nx0 * 12, my = (rs.y + re.y) / 2 + ny0 * 12;
    svg += '<text x="' + mx.toFixed(1) + '" y="' + my.toFixed(1) + '" text-anchor="middle" transform="rotate(-26 ' + mx.toFixed(1) + " " + my.toFixed(1) + ')" fill="#fff" font-size="16" font-weight="600" style="font-family:var(--font-body)">' + esc(t("ruleRod", { len: L })) + "</text>";

    // rod
    svg += '<path d="' + rodD + '" fill="' + c.m.color + '" stroke="rgba(255,255,255,.55)" stroke-width="1.2" stroke-linejoin="round"/>';
    if (c.m.node) {
      [0.25, 0.52, 0.78].forEach(function (s) {
        var p = pts[Math.round(N * s)], hw = (4.6 - 2.4 * s) * 1.4, nx = -Math.sin(p.a), ny = Math.cos(p.a);
        svg += '<line x1="' + (p.x + nx * hw).toFixed(1) + '" y1="' + (p.y + ny * hw).toFixed(1) + '" x2="' + (p.x - nx * hw).toFixed(1) + '" y2="' + (p.y - ny * hw).toFixed(1) + '" stroke="#7B5A1C" stroke-width="2.2" stroke-linecap="round"/>';
      });
    }
    if (c.m.hi) {
      svg += '<polyline fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.3" points="' + pts.map(function (p, k) {
        var hw = (4.6 - 2.4 * (k / N)) * 0.35;
        return (p.x - -Math.sin(p.a) * hw).toFixed(1) + "," + (p.y - Math.cos(p.a) * hw).toFixed(1);
      }).join(" ") + '"/>';
    }

    // handle (length follows the slider, up to what fits on screen)
    var HPX = clamp(100 * state.handleLen / 14, 56, 112);
    var hw2 = c.h.bare ? 9 : clamp(8 + c.gripD * 0.55, 11, 26), hcol = c.h.bare ? c.m.color : c.h.color;
    svg += '<g transform="translate(' + X0 + "," + Y0 + ') rotate(-26)">' +
      '<clipPath id="hclip"><rect x="' + -HPX + '" y="' + -hw2 / 2 + '" width="' + (HPX + 8) + '" height="' + hw2 + '" rx="' + hw2 / 2 + '"/></clipPath>' +
      '<rect x="' + -HPX + '" y="' + -hw2 / 2 + '" width="' + (HPX + 8) + '" height="' + hw2 + '" rx="' + hw2 / 2 + '" fill="' + hcol + '"/>' +
      '<g clip-path="url(#hclip)">' + handleDecor(c.h.id, hw2, HPX) + "</g>" +
      '<rect x="' + -HPX + '" y="' + -hw2 / 2 + '" width="' + (HPX + 8) + '" height="' + hw2 + '" rx="' + hw2 / 2 + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/></g>';

    // line and toys at their positions along it
    var tip = pts[N], spx = state.strLen * 1.6;
    var laid = layoutItems(state.items, 34, 16, state.strLen), maxDx = 0;
    svg += '<g transform="translate(' + tip.x.toFixed(1) + "," + tip.y.toFixed(1) + ')"><g class="swing' + (doSwing ? " go" : "") + '" id="swing">' +
      '<line x1="0" y1="0" x2="0" y2="' + spx.toFixed(1) + '" stroke="' + c.ln.color + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="0" cy="' + spx.toFixed(1) + '" r="3.2" fill="' + c.ln.color + '"/>';
    laid.forEach(function (o) {
      var py = o.at * 1.6, hy = py + 12;
      maxDx = Math.max(maxDx, Math.abs(o.dx));
      svg += '<circle cx="0" cy="' + py.toFixed(1) + '" r="2.8" fill="' + c.ln.color + '"/>' +
        '<line x1="0" y1="' + py.toFixed(1) + '" x2="' + o.dx + '" y2="' + hy.toFixed(1) + '" stroke="' + c.ln.color + '" stroke-width="1.6"/>' +
        '<g transform="translate(' + o.dx + "," + hy.toFixed(1) + ')">' + TOY[o.id] + "</g>";
    });
    svg += "</g></g>";

    // line length marker
    var mxl = tip.x + maxDx + 52;
    svg += '<g stroke="rgba(255,255,255,.7)" stroke-width="1.5" fill="none"><line x1="' + mxl.toFixed(1) + '" y1="' + tip.y.toFixed(1) + '" x2="' + mxl.toFixed(1) + '" y2="' + (tip.y + spx).toFixed(1) + '" stroke-dasharray="5 5"/>' +
      '<line x1="' + (mxl - 6).toFixed(1) + '" y1="' + tip.y.toFixed(1) + '" x2="' + (mxl + 6).toFixed(1) + '" y2="' + tip.y.toFixed(1) + '"/>' +
      '<line x1="' + (mxl - 6).toFixed(1) + '" y1="' + (tip.y + spx).toFixed(1) + '" x2="' + (mxl + 6).toFixed(1) + '" y2="' + (tip.y + spx).toFixed(1) + '"/></g>' +
      '<text x="' + (mxl + 12).toFixed(1) + '" y="' + (tip.y + spx / 2 + 5).toFixed(1) + '" fill="#fff" font-size="16" font-weight="600" style="font-family:var(--font-body)">' + esc(t("ruleLine", { len: state.strLen })) + "</text>";

    var el = $("#rod");
    el.innerHTML = svg;
    el.setAttribute("aria-label", t("svgLabel", { mat: nm(c.m), len: L, handle: nm(c.h), line: state.strLen }));
  }

  /* ---------------- size guide (to scale, 1 unit = 1 cm) ---------------- */
  function sizeRange(h) {
    var lo = Math.max(D.length.min, Math.ceil(0.25 * h / 5) * 5);
    var hi = Math.min(D.length.max, Math.floor(0.5 * h / 5) * 5);
    var mid = clamp(Math.round((lo + hi) / 2 / 5) * 5, lo, hi);
    return { lo: lo, hi: hi, mid: mid };
  }

  var CAT_SVG = '<g fill="#0F6E6A"><ellipse cx="0" cy="-17" rx="20" ry="9"/><rect x="-17" y="-15" width="5.5" height="15" rx="2.7"/><rect x="-10" y="-15" width="5.5" height="15" rx="2.7"/><ellipse cx="13" cy="-12" rx="7.5" ry="8.5"/><rect x="9.5" y="-7" width="5.5" height="7" rx="2.7"/><rect x="15.5" y="-7" width="5.5" height="7" rx="2.7"/><circle cx="-24" cy="-28" r="8.5"/><path d="M-31 -31 L-30 -41 L-23.5 -35Z"/><path d="M-24.5 -35.5 L-18.5 -40 L-17.5 -31.5Z"/><path d="M19 -20 C30 -22 34 -34 28 -42" fill="none" stroke="#0F6E6A" stroke-width="4" stroke-linecap="round"/></g><circle cx="-28" cy="-29" r="1.4" fill="#fff"/>';

  function renderScale(c) {
    var h = state.person, L = state.length, hl = state.handleLen, cat = find(D.cats, state.cat), k = cat.k;
    var ink = "#1B2347", soft = "#4A5272", i, s = "";
    var font = 'style="font-family:var(--font-body)"';

    // floor and 50 cm grid
    s += '<rect x="-50" y="0" width="300" height="16" fill="rgba(27,35,71,.07)"/>';
    for (i = 50; i <= 200; i += 50) {
      s += '<line x1="-50" y1="' + -i + '" x2="250" y2="' + -i + '" stroke="rgba(27,35,71,.22)" stroke-width=".6" stroke-dasharray="3 3"/>' +
        '<text x="-48" y="' + (-i + 8) + '" font-size="7.5" fill="' + soft + '" ' + font + ">" + i + "</text>";
    }
    s += '<line x1="-50" y1="0" x2="250" y2="0" stroke="' + ink + '" stroke-width=".8"/>';

    // person
    var hr = 0.062 * h, shY = -0.82 * h, hipY = -0.47 * h, hx = 0.27 * h, hy = -0.6 * h;
    s += '<g fill="' + ink + '" stroke="' + ink + '" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="0" cy="' + (-(h - hr)).toFixed(1) + '" r="' + hr.toFixed(1) + '" stroke="none"/>' +
      '<rect x="' + (-0.025 * h).toFixed(1) + '" y="' + (-(h - 2 * hr)).toFixed(1) + '" width="' + (0.05 * h).toFixed(1) + '" height="' + (0.07 * h).toFixed(1) + '" stroke="none"/>' +
      '<rect x="' + (-0.13 * h).toFixed(1) + '" y="' + shY.toFixed(1) + '" width="' + (0.26 * h).toFixed(1) + '" height="' + (hipY - shY).toFixed(1) + '" rx="' + (0.05 * h).toFixed(1) + '" stroke="none"/>' +
      '<rect x="' + (-0.12 * h).toFixed(1) + '" y="' + hipY.toFixed(1) + '" width="' + (0.1 * h).toFixed(1) + '" height="' + (-hipY).toFixed(1) + '" rx="' + (0.04 * h).toFixed(1) + '" stroke="none"/>' +
      '<rect x="' + (0.02 * h).toFixed(1) + '" y="' + hipY.toFixed(1) + '" width="' + (0.1 * h).toFixed(1) + '" height="' + (-hipY).toFixed(1) + '" rx="' + (0.04 * h).toFixed(1) + '" stroke="none"/>' +
      '<line x1="' + (-0.14 * h).toFixed(1) + '" y1="' + (shY + 0.03 * h).toFixed(1) + '" x2="' + (-0.16 * h).toFixed(1) + '" y2="' + (-0.5 * h).toFixed(1) + '" stroke-width="' + (0.065 * h).toFixed(1) + '"/>' +
      '<polyline fill="none" stroke-width="' + (0.065 * h).toFixed(1) + '" points="' + (0.14 * h).toFixed(1) + "," + (shY + 0.03 * h).toFixed(1) + " " + (0.2 * h).toFixed(1) + "," + (-0.64 * h).toFixed(1) + " " + hx.toFixed(1) + "," + hy.toFixed(1) + '"/></g>';

    // wand held at the hand: handle behind, rod L cm ahead, 22 degrees up
    var a = -22 * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    var bx = hx - hl * ca, by = hy - hl * sa, fx = hx + 3 * ca, fy = hy + 3 * sa;
    var tx = hx + L * ca, ty = hy + L * sa;
    var hw = Math.max(1.6, c.gripD / 10), hcol = c.h.bare ? c.m.color : c.h.color;
    s += '<line x1="' + bx.toFixed(1) + '" y1="' + by.toFixed(1) + '" x2="' + fx.toFixed(1) + '" y2="' + fy.toFixed(1) + '" stroke="rgba(27,35,71,.55)" stroke-width="' + (hw + 1.2).toFixed(1) + '" stroke-linecap="round"/>' +
      '<line x1="' + bx.toFixed(1) + '" y1="' + by.toFixed(1) + '" x2="' + fx.toFixed(1) + '" y2="' + fy.toFixed(1) + '" stroke="' + hcol + '" stroke-width="' + hw.toFixed(1) + '" stroke-linecap="round"/>' +
      '<line x1="' + fx.toFixed(1) + '" y1="' + fy.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y2="' + ty.toFixed(1) + '" stroke="rgba(27,35,71,.55)" stroke-width="3" stroke-linecap="round"/>' +
      '<line x1="' + fx.toFixed(1) + '" y1="' + fy.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y2="' + ty.toFixed(1) + '" stroke="' + c.m.color + '" stroke-width="2" stroke-linecap="round"/>';

    // length ruler above the rod
    var nx = sa, ny = -ca, off = 10;
    var rsx = hx + nx * off, rsy = hy + ny * off, rex = rsx + L * ca, rey = rsy + L * sa;
    var mx = (rsx + rex) / 2 + nx * 6, my = (rsy + rey) / 2 + ny * 6;
    s += '<g stroke="' + ink + '" stroke-width=".8" fill="none"><line x1="' + rsx.toFixed(1) + '" y1="' + rsy.toFixed(1) + '" x2="' + rex.toFixed(1) + '" y2="' + rey.toFixed(1) + '" stroke-dasharray="3 3"/>' +
      '<line x1="' + (rsx - nx * 3).toFixed(1) + '" y1="' + (rsy - ny * 3).toFixed(1) + '" x2="' + (rsx + nx * 3).toFixed(1) + '" y2="' + (rsy + ny * 3).toFixed(1) + '"/>' +
      '<line x1="' + (rex - nx * 3).toFixed(1) + '" y1="' + (rey - ny * 3).toFixed(1) + '" x2="' + (rex + nx * 3).toFixed(1) + '" y2="' + (rey + ny * 3).toFixed(1) + '"/></g>' +
      '<text x="' + mx.toFixed(1) + '" y="' + my.toFixed(1) + '" text-anchor="middle" transform="rotate(-22 ' + mx.toFixed(1) + " " + my.toFixed(1) + ')" font-size="9" font-weight="600" fill="' + ink + '" ' + font + ">" + esc(t("ruleRod", { len: L })) + "</text>";

    // line and toys at real size (the toy drawings are about 0.2 cm per unit)
    var ly = ty + state.strLen, laid = layoutItems(state.items, 7, 4, state.strLen);
    s += '<line x1="' + tx.toFixed(1) + '" y1="' + ty.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y2="' + ly.toFixed(1) + '" stroke="' + soft + '" stroke-width=".9" stroke-linecap="round"/>';
    laid.forEach(function (o) {
      var py = ty + o.at, hy2 = py + 3;
      s += '<circle cx="' + tx.toFixed(1) + '" cy="' + py.toFixed(1) + '" r=".9" fill="' + soft + '"/>' +
        '<line x1="' + tx.toFixed(1) + '" y1="' + py.toFixed(1) + '" x2="' + (tx + o.dx).toFixed(1) + '" y2="' + hy2.toFixed(1) + '" stroke="' + soft + '" stroke-width=".6"/>' +
        '<g transform="translate(' + (tx + o.dx).toFixed(1) + "," + hy2.toFixed(1) + ') scale(.2)">' + TOY[o.id] + "</g>";
    });

    // cat under the toy, facing the person
    var cx = tx + 28 * k;
    s += '<g transform="translate(' + cx.toFixed(1) + ',0) scale(' + k + ')">' + CAT_SVG + "</g>";

    // labels
    s += '<text x="0" y="12" text-anchor="middle" font-size="9" font-weight="600" fill="' + ink + '" ' + font + ">" + esc(t("you", { h: h })) + "</text>" +
      '<text x="' + cx.toFixed(1) + '" y="12" text-anchor="middle" font-size="9" font-weight="600" fill="' + ink + '" ' + font + ">" + esc(nm(cat)) + "</text>";

    var el = $("#scaleSvg");
    el.innerHTML = s;
    el.setAttribute("aria-label", t("sizeSvg", { h: h, len: L, cat: nm(cat) }));

    var r = sizeRange(h), pct = Math.round(L / h * 100), x = fmt(L / cat.body);
    setText("#sizeSummary", t("sizeSummary", { len: L, pct: pct, x: x }));
    var key = L < r.lo ? "sizeShort" : L > r.hi ? "sizeLong" : "sizeFit";
    setText("#sizeVerdict", t(key, { lo: r.lo, hi: r.hi }));
    $("#sizeVerdict").setAttribute("data-level", key === "sizeFit" ? "good" : "warn");
    $("#sizeFix").hidden = key === "sizeFit";
    setText("#sizeFix", t("sizeFix", { mid: r.mid }));
    setText("#sizeFine", t("sizeFine", { h: hl }));
  }

  /* ---------------- static + list building ---------------- */
  var checked = {};
  var picHidden = false;
  var thickSig = "", itemSig = "";

  function buildStatic() {
    document.documentElement.lang = lang;
    document.title = t("brand");
    setText("#brand", t("brand"));
    setText("#langBtn", t("langBtn"));
    setText("#skip", t("skip"));
    setText("#tapHint", t("tapHint"));
    setText("#stageToggle", picHidden ? t("showPic") : t("hidePic"));
    setText("#gRodLabel", t("gRod"));
    setText("#gWristLabel", t("gWrist"));
    setText("#vRodL", t("chkRod") + " "); setText("#vWristL", t("chkWrist") + " "); setText("#vGripL", t("chkGrip") + " ");
    ["s1", "s2", "s3", "s4", "s5", "lenLabel", "matLabel", "thickLabel", "lineLenLabel", "lineTypeLabel", "safety",
      "nameLabel", "myDesignsTitle", "shopeeIntro", "partsTitle", "suppliesTitle", "stepsTitle", "affiliateNote",
      "priceTitle", "priceNote", "foot", "sizeTitle", "sizeIntro", "personLabel", "catLabel", "hlLabel", "itemsTitle",
      "whySummary", "why1", "why2", "why3", "why5", "whySources"].forEach(function (k) {
      var el = $("#" + k);
      if (el) el.textContent = t(k === "affiliateNote" ? "affiliate" : k);
    });
    setText("#why4", t("why4", { good: C.WRIST_GOOD, max: C.WRIST_MAX }));
    setText("#lenMin", D.length.min + " " + t("cm")); setText("#lenMax", D.length.max + " " + t("cm"));
    setText("#hlMin", D.handleLen.min + " " + t("cm")); setText("#hlMax", D.handleLen.max + " " + t("cm"));
    setText("#personMin", D.person.min + " " + t("cm")); setText("#personMax", D.person.max + " " + t("cm"));
    setText("#lineMin", D.line.min + " " + t("cm")); setText("#lineMax", D.line.max + " " + t("cm"));
    setText("#tab-save", t("tabSave")); setText("#tab-shopee", t("tabShopee"));
    setText("#tab-order", C.ORDERS_OPEN ? t("tabOrder") : t("tabOrderSoon"));
    $("#orderSoon").hidden = !!C.ORDERS_OPEN;
    $("#orderLive").hidden = !C.ORDERS_OPEN;
    setText("#soonTitle", t("soonTitle")); setText("#soonText", t("soonText"));
    setText("#soonSave", t("soonSave")); setText("#soonShopee", t("soonShopee"));
    setText("#saveBtn", t("save")); setText("#copyLinkBtn", t("copyLink"));
    setText("#fNameL", t("fName")); setText("#fPhoneL", t("fPhone")); setText("#fAddressL", t("fAddress"));
    setText("#fLineL", t("fLine")); setText("#fNoteL", t("fNote"));
    setText("#sendLineBtn", t("sendLine")); setText("#sendEmailBtn", t("sendEmail")); setText("#copyOrderBtn", t("copyOrder"));
    $("#designName").placeholder = t("namePh");
    $("#sendLineBtn").hidden = !C.LINE_OA_ID;
    $("#sendEmailBtn").hidden = !C.ORDER_EMAIL;
    $("#affiliateNote").hidden = C.SHOPEE_LINK_TEMPLATE === DEFAULT_SHOPEE;
  }

  function radio(name, o, kind, small) {
    if (small === undefined) small = o.feel ? o.feel[lang] : "";
    return '<label class="opt"><input type="radio" name="' + name + '" value="' + o.id + '">' + (o.color ? '<span class="swatch" style="background:' + o.color + '"></span>' : "") +
      '<span class="optText"><b>' + esc(nm(o)) + "</b>" + (small ? "<small>" + esc(small) + "</small>" : "") + "</span>" +
      '<span class="w" data-w="' + kind + ":" + o.id + '"></span></label>';
  }

  function buildLists() {
    thickSig = ""; itemSig = "";
    $("#matOpts").innerHTML = D.materials.map(function (o) { return radio("material", o, "mat"); }).join("");
    $("#handleOpts").innerHTML = D.handles.map(function (o) {
      return radio("handle", o, "handle", o.feel[lang] + (o.d ? " Ø " + o.d + " " + t("mm") : ""));
    }).join("");
    $("#lineOpts").innerHTML = D.lines.map(function (o) { return radio("strType", o, "line"); }).join("");
    $("#catOpts").innerHTML = D.cats.map(function (o) {
      return '<label class="opt"><input type="radio" name="cat" value="' + o.id + '"><span class="optText"><b>' + esc(nm(o)) +
        "</b><small>" + esc(t("catBody", { b: o.body, kg: o.kg })) + "</small></span></label>";
    }).join("");
    $("#toyGrid").innerHTML = D.toys.map(function (o) {
      return '<div class="toy" data-toy="' + o.id + '"><svg viewBox="-26 -2 52 54" aria-hidden="true">' + TOY[o.id] + "</svg>" +
        "<b>" + esc(nm(o)) + '</b><small data-w="toy:' + o.id + '"></small>' +
        '<div class="stepper"><button type="button" data-act="dec" data-id="' + o.id + '" aria-label="' + esc(t("remove", { name: nm(o) })) + '"><span aria-hidden="true">−</span></button>' +
        '<span data-qty="' + o.id + '">0</span>' +
        '<button type="button" data-act="inc" data-id="' + o.id + '" aria-label="' + esc(t("add", { name: nm(o) })) + '"><span aria-hidden="true">+</span></button></div></div>';
    }).join("");
  }

  // Rod thickness options depend on the material, so they rebuild only when it changes.
  function buildThick() {
    var m = find(D.materials, state.material), sig = m.id + "|" + lang;
    if (sig === thickSig) return;
    thickSig = sig;
    $("#thickOpts").innerHTML = m.sizes.map(function (d) {
      return '<label class="opt opt--size"><input type="radio" name="rodD" value="' + d + '"><span class="optText"><b>' + esc(t("thickOpt", { d: d })) + "</b></span></label>";
    }).join("");
  }

  // The list of toys on the line. Rebuilt only when the toys or line length change,
  // so dragging a position slider is not interrupted.
  function renderItems() {
    var box = $("#itemList");
    var sig = state.items.map(function (it) { return it.id; }).join(",") + "|" + state.strLen + "|" + lang;
    if (sig !== itemSig) {
      itemSig = sig;
      if (!state.items.length) box.innerHTML = '<li class="empty">' + esc(t("noItems")) + "</li>";
      else box.innerHTML = state.items.map(function (it, i) {
        var toy = find(D.toys, it.id);
        return '<li class="itemRow"><svg class="ico" viewBox="-26 -2 52 54" aria-hidden="true">' + TOY[it.id] + '</svg><div class="itemMain">' +
          '<div class="itemHead"><b>' + esc(nm(toy)) + "</b><small>" + fmt(toy.g) + ' g</small><button type="button" class="rm" data-rm="' + i + '" aria-label="' + esc(t("removeItem", { name: nm(toy) })) + '"><span aria-hidden="true">×</span></button></div>' +
          '<div class="itemPos"><label for="pos-' + i + '">' + esc(t("posLabel")) + '</label><output data-posout="' + i + '" for="pos-' + i + '"></output></div>' +
          '<input id="pos-' + i + '" class="range" type="range" min="0" max="' + state.strLen + '" step="1" data-pos="' + i + '">' +
          '<button type="button" class="endBtn" data-end="' + i + '">' + esc(t("endBtn")) + "</button></div></li>";
      }).join("");
    }
    state.items.forEach(function (it, i) {
      var r = box.querySelector('[data-pos="' + i + '"]'), o = box.querySelector('[data-posout="' + i + '"]'), eb = box.querySelector('[data-end="' + i + '"]');
      if (r && +r.value !== it.at) r.value = it.at;
      if (o) o.textContent = it.at >= state.strLen ? t("atEnd") : t("atFrom", { at: it.at });
      if (eb) eb.hidden = it.at >= state.strLen;
    });
  }

  /* ---------------- update ---------------- */
  function setRange(sel, v) { var el = $(sel); if (+el.value !== v) el.value = v; }

  function setGauge(id, lv, fillPct, valText, note, meterNow) {
    $("#" + id).setAttribute("data-level", lv);
    $("#" + id + "Fill").style.width = fillPct.toFixed(1) + "%";
    setText("#" + id + "Val", valText);
    setText("#" + id + "Note", note);
    var tr = $("#" + id + "Track");
    tr.setAttribute("aria-valuenow", Math.round(meterNow));
    tr.setAttribute("aria-valuetext", valText);
  }

  function setCheck(id, o) {
    $("#" + id).setAttribute("data-level", o.lv);
    setText("#" + id + "T", o.text);
  }

  function update(doSwing) {
    var c = calc(state), i;
    buildThick();

    setRange("#lenRange", state.length); setRange("#lineRange", state.strLen);
    setRange("#hlRange", state.handleLen); setRange("#personRange", state.person);
    setText("#lenOut", state.length + " " + t("cm"));
    setText("#lineOut", state.strLen + " " + t("cm"));
    setText("#hlOut", state.handleLen + " " + t("cm"));
    setText("#personOut", state.person + " " + t("cm"));
    [["material", state.material], ["rodD", state.rodD], ["handle", state.handle], ["strType", state.strType], ["cat", state.cat]].forEach(function (p) {
      var inputs = document.querySelectorAll('input[name="' + p[0] + '"]');
      for (i = 0; i < inputs.length; i++) inputs[i].checked = inputs[i].value === String(p[1]);
    });

    var ws = document.querySelectorAll("[data-w]");
    for (i = 0; i < ws.length; i++) {
      var parts = ws[i].getAttribute("data-w").split(":"), kind = parts[0], id = parts[1], txt = "", mm;
      if (kind === "mat") {
        mm = find(D.materials, id);
        txt = t("weightAtLen", { w: fmt(state.length * rodSpec(mm, id === state.material ? state.rodD : mm.dDef).gpc) });
      } else if (kind === "handle") {
        var hh = find(D.handles, id);
        txt = fmt((hh.bare ? c.sp.gpc : hh.gpc) * state.handleLen) + " g";
      } else if (kind === "line") txt = t("weightAtLen", { w: fmt(state.strLen * find(D.lines, id).gpcm) });
      else if (kind === "toy") txt = fmt(find(D.toys, id).g) + " g";
      ws[i].textContent = txt;
    }

    var counts = countBy(state), full = c.n >= C.MAX_ATTACH;
    D.toys.forEach(function (toy) {
      var q = counts[toy.id] || 0, card = document.querySelector('[data-toy="' + toy.id + '"]');
      card.classList.toggle("has", q > 0);
      card.querySelector("[data-qty]").textContent = q;
      card.querySelector('[data-act="dec"]').disabled = q === 0;
      card.querySelector('[data-act="inc"]').disabled = full;
    });
    setText("#slots", full ? t("slotsFull", { max: C.MAX_ATTACH }) : t("slotsLeft", { n: C.MAX_ATTACH - c.n }));
    renderItems();

    setText("#headline", t("headline", { mat: nm(c.m), len: state.length }));
    setText("#specLine", t("spec", { total: fmt(c.total), bal: fmt(c.balance) }));
    renderStage(c, !!doSwing);
    renderScale(c);

    // gauges
    var rodLv = c.ratio > 1 ? "bad" : c.ratio > 0.7 ? "warn" : "good";
    setGauge("gRod", rodLv, Math.min(c.ratio, 1.3) / 1.3 * 100,
      t("gRodVal", { tip: fmt(c.tip), limit: fmt(c.limit) }),
      t("gRodNote", { len: state.length, d: fmt(state.rodD), limit: fmt(c.limit) }), c.ratio * 100);
    var wristScale = C.WRIST_MAX * 1.3;
    var wLv = c.felt > C.WRIST_MAX ? "bad" : c.felt > C.WRIST_GOOD ? "warn" : "good";
    setGauge("gWrist", wLv, Math.min(c.felt / wristScale, 1) * 100,
      t("gWristVal", { felt: fmt(c.felt) }),
      t("gWristNote", { arm: C.WRIST_ARM, total: fmt(c.total) }), c.felt);
    $("#gWristMarkGood").style.left = (C.WRIST_GOOD / wristScale * 100).toFixed(1) + "%";
    $("#gRodTrack").setAttribute("aria-label", t("gRod"));
    $("#gWristTrack").setAttribute("aria-label", t("gWrist"));

    var ev = evaluate(c);
    setCheck("vRod", ev.rod); setCheck("vWrist", ev.wrist); setCheck("vGrip", ev.grip);
    $("#pill").setAttribute("data-level", ev.worst);
    setText("#pill", ev.worst === "bad" ? t("pillBad") : ev.worst === "warn" ? t("pillWarn") : t("pillGood"));

    renderParts(c);
    renderPrice();
    renderSaved();

    try { history.replaceState(null, "", "?" + serialize(state)); } catch (e) { /* not allowed here */ }
  }

  /* ---------------- finish panes ---------------- */
  function shopeeUrl(kw) { return C.SHOPEE_LINK_TEMPLATE.replace("{kw}", encodeURIComponent(kw)); }

  function partRow(key, name, spec, kw) {
    return '<li><input type="checkbox" data-chk="' + esc(key) + '"' + (checked[key] ? " checked" : "") + ' aria-label="' + esc(name) + '">' +
      '<span class="pt">' + esc(name) + (spec ? "<small>" + esc(spec) + "</small>" : "") + "</span>" +
      '<a class="btn" href="' + esc(shopeeUrl(kw)) + '" target="_blank" rel="noopener sponsored">' + esc(t("searchShopee")) + "</a></li>";
  }

  function renderParts(c) {
    var rows = [], counts = countBy(state);
    rows.push(partRow("rod-" + c.m.id + "-" + state.rodD, t("rodPart", { mat: nm(c.m), d: state.rodD }), t("cutTo", { len: state.length }), c.m.kw.split("{d}").join(state.rodD)));
    if (!c.h.bare) rows.push(partRow("handle-" + c.h.id, t("handleLine", { handle: nm(c.h) }), t("handlePartSpec", { len: state.handleLen }), c.h.kw));
    rows.push(partRow("line-" + c.ln.id, nm(c.ln), t("lenOnly", { len: state.strLen }), c.ln.kw));
    D.toys.forEach(function (toy) {
      var q = counts[toy.id] || 0;
      if (q) rows.push(partRow("toy-" + toy.id, nm(toy), t("pieces", { q: q }), toy.kw));
    });
    $("#partsList").innerHTML = rows.join("");
    $("#suppliesList").innerHTML = D.extras.map(function (e) { return partRow("x-" + e.id, nm(e), "", e.kw); }).join("");
    $("#assembleList").innerHTML = ["as1", "as2", "as3", "as4"].map(function (k) { return "<li>" + esc(t(k, { len: state.length })) + "</li>"; }).join("");
  }

  function renderPrice() {
    var p = prices(state), body = p.rows.map(function (r) {
      return "<tr><td>" + esc(r.label) + "</td><td>" + r.v + " " + esc(t("baht")) + "</td></tr>";
    }).join("");
    body += '<tr class="sum"><td>' + esc(t("total")) + "</td><td>" + p.total + " " + esc(t("baht")) + "</td></tr>";
    $("#priceBody").innerHTML = body;
  }

  /* saved designs */
  function getSaved() { try { return JSON.parse(lsGet("catwand.designs") || "[]"); } catch (e) { return []; } }
  function setSaved(list) { lsSet("catwand.designs", JSON.stringify(list)); }

  function renderSaved() {
    var list = getSaved(), el = $("#savedList");
    if (!list.length) { el.innerHTML = '<li class="empty" style="border:none;padding:0;background:none">' + esc(t("noDesigns")) + "</li>"; return; }
    el.innerHTML = list.map(function (d, k) {
      return '<li><span class="nm">' + esc(d.name) + '</span><button class="btn" type="button" data-open="' + k + '">' + esc(t("open")) +
        '</button><button class="btn" type="button" data-del="' + k + '">' + esc(t("del")) + "</button></li>";
    }).join("");
  }

  function currentName() {
    var c = calc(state);
    return $("#designName").value.trim() || t("defName", { mat: nm(c.m), len: state.length });
  }

  function shareUrl() {
    var base = location.href.split("?")[0].split("#")[0];
    return base + "?" + serialize(state);
  }

  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      document.body.removeChild(ta); done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  /* order */
  function orderText() {
    var c = calc(state), p = prices(state), items = [], counts = countBy(state);
    D.toys.forEach(function (toy) {
      var at = state.items.filter(function (it) { return it.id === toy.id; }).map(function (it) { return it.at >= state.strLen ? t("atEnd") : t("atFrom", { at: it.at }); });
      if (at.length) items.push(nm(toy) + " × " + counts[toy.id] + " (" + at.join(", ") + ")");
    });
    var L = [t("orderHead"), "",
      t("oSpec") + ": " + t("headline", { mat: nm(c.m), len: state.length }) + ", " + state.rodD + " " + t("mm"),
      t("handleLine", { handle: nm(c.h) }) + " " + state.handleLen + " " + t("cm") + ", " + t("lineLine", { line: nm(c.ln), len: state.strLen }),
      t("oItems") + ": " + (items.length ? items.join("; ") : t("oNone")),
      t("spec", { total: fmt(c.total), bal: fmt(c.balance) }),
      t("oTotal") + ": " + p.total + " " + t("baht"), "",
      t("oShip") + ": " + $("#fName").value.trim(),
      t("oPhone") + ": " + $("#fPhone").value.trim(),
      t("oAddr") + ": " + $("#fAddress").value.trim()];
    if ($("#fLine").value.trim()) L.push(t("oLine") + ": " + $("#fLine").value.trim());
    if ($("#fNote").value.trim()) L.push(t("oNote") + ": " + $("#fNote").value.trim());
    L.push("", t("oLink") + ": " + shareUrl());
    return L.join("\n");
  }

  function validOrder() {
    var ids = ["fName", "fPhone", "fAddress"], err = $("#formError");
    for (var i = 0; i < ids.length; i++) {
      if (!$("#" + ids[i]).value.trim()) {
        err.textContent = t("formError"); err.hidden = false; $("#" + ids[i]).focus();
        return false;
      }
    }
    err.hidden = true;
    return true;
  }

  /* ---------------- events ---------------- */
  // Apply a control that changes the design. Returns false if the control is not one of them.
  function applyControl(el) {
    var n = el.name;
    if (n === "material") { state.material = el.value; state.rodD = find(D.materials, el.value).dDef; }
    else if (n === "rodD") state.rodD = +el.value;
    else if (n === "handle") state.handle = el.value;
    else if (n === "strType") state.strType = el.value;
    else if (n === "cat") state.cat = el.value;
    else if (el.id === "lenRange") state.length = snap(+el.value, D.length);
    else if (el.id === "lineRange") setStrLen(snap(+el.value, D.line));
    else if (el.id === "hlRange") state.handleLen = snap(+el.value, D.handleLen);
    else if (el.id === "personRange") state.person = snap(+el.value, D.person);
    else return false;
    return true;
  }

  function bind() {
    $("#langBtn").addEventListener("click", function () {
      lang = lang === "th" ? "en" : "th";
      lsSet("catwand.lang", lang);
      buildStatic(); buildLists(); update(false);
    });

    var panel = $("#panel");
    panel.addEventListener("change", function (e) {
      var el = e.target;
      if (el.hasAttribute("data-pos")) {
        state.items[+el.getAttribute("data-pos")].at = clamp(Math.round(+el.value), 0, state.strLen);
        update(true); return;
      }
      if (el.getAttribute("data-chk")) { checked[el.getAttribute("data-chk")] = el.checked; return; }
      if (applyControl(el)) update(true);
    });
    panel.addEventListener("input", function (e) {
      var el = e.target;
      if (el.hasAttribute("data-pos")) {
        state.items[+el.getAttribute("data-pos")].at = clamp(Math.round(+el.value), 0, state.strLen);
        update(false); return;
      }
      if (el.type === "range" && applyControl(el)) update(false);
    });

    $("#toyGrid").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]");
      if (!b || b.disabled) return;
      var id = b.getAttribute("data-id"), k;
      if (b.getAttribute("data-act") === "inc") {
        if (state.items.length < C.MAX_ATTACH) state.items.push({ id: id, at: state.strLen });
      } else {
        for (k = state.items.length - 1; k >= 0; k--) if (state.items[k].id === id) { state.items.splice(k, 1); break; }
      }
      update(true);
    });

    $("#itemList").addEventListener("click", function (e) {
      var rm = e.target.closest("[data-rm]"), en = e.target.closest("[data-end]");
      if (rm) { state.items.splice(+rm.getAttribute("data-rm"), 1); update(true); }
      else if (en) { state.items[+en.getAttribute("data-end")].at = state.strLen; update(true); }
    });

    $("#stage").addEventListener("click", wiggle);
    $("#stageToggle").addEventListener("click", function (e) {
      e.stopPropagation();
      picHidden = !picHidden;
      $("#stage").setAttribute("data-collapsed", picHidden ? "true" : "false");
      this.setAttribute("aria-expanded", picHidden ? "false" : "true");
      setText("#stageToggle", picHidden ? t("showPic") : t("hidePic"));
    });
    $("#sizeFix").addEventListener("click", function () { state.length = sizeRange(state.person).mid; update(true); });

    // coming-soon shortcuts
    $("#soonSave").addEventListener("click", function () { $("#tab-save").click(); $("#designName").focus(); });
    $("#soonShopee").addEventListener("click", function () { $("#tab-shopee").click(); });

    // tabs
    var tabs = ["save", "shopee", "order"];
    function showTab(name, focus) {
      tabs.forEach(function (k) {
        var on = k === name, tb = $("#tab-" + k);
        tb.setAttribute("aria-selected", on ? "true" : "false");
        tb.tabIndex = on ? 0 : -1;
        $("#pane-" + k).hidden = !on;
        if (on && focus) tb.focus();
      });
    }
    tabs.forEach(function (k, idx) {
      $("#tab-" + k).addEventListener("click", function () { showTab(k, false); });
      $("#tab-" + k).addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { e.preventDefault(); showTab(tabs[(idx + d + tabs.length) % tabs.length], true); }
      });
    });

    // save
    $("#saveBtn").addEventListener("click", function () {
      var list = getSaved();
      list.unshift({ name: currentName(), qs: serialize(state), ts: Date.now() });
      setSaved(list.slice(0, 20));
      $("#designName").value = "";
      renderSaved();
      toast(t("saved"));
    });
    $("#copyLinkBtn").addEventListener("click", function () { copyText(shareUrl(), function () { toast(t("linkCopied")); }); });
    $("#savedList").addEventListener("click", function (e) {
      var o = e.target.closest("[data-open]"), d = e.target.closest("[data-del]"), list = getSaved();
      if (o) {
        var s = parse(list[+o.getAttribute("data-open")].qs);
        if (s) { state = s; update(true); toast(t("opened")); }
      } else if (d) {
        list.splice(+d.getAttribute("data-del"), 1); setSaved(list); renderSaved(); toast(t("deleted"));
      }
    });

    // order
    $("#orderForm").addEventListener("submit", function (e) { e.preventDefault(); });
    $("#copyOrderBtn").addEventListener("click", function () {
      if (validOrder()) copyText(orderText(), function () { toast(t("orderCopied")); });
    });
    $("#sendLineBtn").addEventListener("click", function () {
      if (!validOrder()) return;
      window.open("https://line.me/R/oaMessage/" + encodeURIComponent(C.LINE_OA_ID) + "/?" + encodeURIComponent(orderText()), "_blank", "noopener");
    });
    $("#sendEmailBtn").addEventListener("click", function () {
      if (!validOrder()) return;
      location.href = "mailto:" + C.ORDER_EMAIL + "?subject=" + encodeURIComponent(t("orderHead")) + "&body=" + encodeURIComponent(orderText());
    });
  }

  /* ---------------- init ---------------- */
  function init() {
    function range(sel, r) { var el = $(sel); el.min = r.min; el.max = r.max; el.step = r.step; }
    range("#lenRange", D.length); range("#lineRange", D.line);
    range("#hlRange", D.handleLen); range("#personRange", D.person);
    buildStatic(); buildLists(); bind(); update(true);
  }
  init();
})();
