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

  var lang = lsGet("catwand.lang") === "en" ? "en" : "th";
  function t(key, vars) {
    var s = (I[lang][key] !== undefined ? I[lang][key] : I.th[key]) || key;
    if (vars) for (var k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }
  function nm(o) { return o.name[lang]; }

  /* ---------------- state ---------------- */
  function defaults() {
    return { length: D.length.def, material: "bamboo", handle: "foam", strLen: D.line.def, strType: "cotton", items: { fish: 1, ribbon: 1 } };
  }

  function serialize(s) {
    var items = Object.keys(s.items).filter(function (k) { return s.items[k] > 0; })
      .map(function (k) { return k + ":" + s.items[k]; }).join(",");
    return new URLSearchParams({ l: s.length, m: s.material, h: s.handle, sl: s.strLen, st: s.strType, i: items }).toString();
  }

  function parse(qs) {
    var q = new URLSearchParams(qs);
    if (!q.has("l")) return null;
    var s = defaults();
    s.length = snap(parseFloat(q.get("l")) || D.length.def, D.length);
    if (find(D.materials, q.get("m"))) s.material = q.get("m");
    if (find(D.handles, q.get("h"))) s.handle = q.get("h");
    s.strLen = snap(parseFloat(q.get("sl")) || D.line.def, D.line);
    if (find(D.lines, q.get("st"))) s.strType = q.get("st");
    s.items = {};
    var left = C.MAX_ATTACH;
    (q.get("i") || "").split(",").forEach(function (pair) {
      var p = pair.split(":"), n = Math.floor(parseFloat(p[1]));
      if (find(D.toys, p[0]) && n > 0 && left > 0) { var use = Math.min(n, left); s.items[p[0]] = use; left -= use; }
    });
    return s;
  }

  var state = parse(location.search) || defaults();

  function count(s) { return Object.keys(s.items).reduce(function (a, k) { return a + (s.items[k] || 0); }, 0); }

  function calc(s) {
    var m = find(D.materials, s.material), h = find(D.handles, s.handle), ln = find(D.lines, s.strType);
    var rod = s.length * m.gpc, str = s.strLen * ln.gpcm, toys = 0;
    Object.keys(s.items).forEach(function (k) { toys += find(D.toys, k).g * s.items[k]; });
    var tip = str + toys;
    var limit = m.tipBase * 60 / s.length;
    var lmax = Math.floor(m.tipBase * 60 / Math.max(tip, 0.1) / D.length.step) * D.length.step;
    return { m: m, h: h, ln: ln, rod: rod, str: str, toys: toys, tip: tip, limit: limit, ratio: tip / limit,
      lmax: lmax, total: rod + h.g + tip, n: count(s) };
  }

  function prices(s) {
    var c = calc(s), rows = [];
    rows.push({ label: t("rodLine", { mat: nm(c.m), len: s.length }), v: Math.round(c.m.base + c.m.perCm * s.length) });
    rows.push({ label: t("handleLine", { handle: nm(c.h) }), v: c.h.price });
    rows.push({ label: t("lineLine", { line: nm(c.ln), len: s.strLen }), v: Math.round(c.ln.perCm * s.strLen) });
    D.toys.forEach(function (toy) {
      var q = s.items[toy.id] || 0;
      if (q) rows.push({ label: nm(toy) + " × " + q, v: toy.price * q });
    });
    rows.push({ label: t("assembly"), v: C.ASSEMBLY_FEE });
    rows.push({ label: t("shipping"), v: C.SHIPPING_FEE });
    var sum = rows.reduce(function (a, r) { return a + r.v; }, 0);
    return { rows: rows, total: sum };
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

  /* ---------------- handle decoration ---------------- */
  var HPX = 100;
  function handleDecor(id, w) {
    var o = "", i, h = w / 2;
    if (id === "foam") {
      for (i = 1; i < 7; i++) o += '<line x1="' + (-HPX + i * 14) + '" y1="' + -h + '" x2="' + (-HPX + i * 14) + '" y2="' + h + '" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/>';
    } else if (id === "cork") {
      for (i = 0; i < 30; i++) o += '<circle cx="' + (-96 + (i * 53) % 100) + '" cy="' + (((i * 29) % Math.max(w - 6, 1)) - h + 3) + '" r="' + (1 + (i % 3) * 0.5) + '" fill="rgba(110,70,30,.55)"/>';
    } else if (id === "wood") {
      for (i = 1; i < 9; i++) o += '<line x1="' + (-HPX + i * 11) + '" y1="' + -h + '" x2="' + (-HPX + i * 11) + '" y2="' + h + '" stroke="rgba(60,30,10,.4)" stroke-width="1.5"/>';
    } else if (id === "tape") {
      for (i = 0; i < 18; i++) o += '<path d="M' + (-110 + i * 9) + ' ' + h + ' L' + (-110 + i * 9 + w) + ' ' + -h + '" stroke="rgba(255,255,255,.4)" stroke-width="2"/>';
    } else if (id === "cord") {
      for (i = 0; i < 22; i++) o += '<path d="M' + (-110 + i * 8) + ' ' + h + ' L' + (-110 + i * 8 + 8) + ' ' + -h + ' M' + (-110 + i * 8) + ' ' + -h + ' L' + (-110 + i * 8 + 8) + ' ' + h + '" stroke="rgba(27,35,71,.35)" stroke-width="1.5" fill="none"/>';
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
    var L = state.length, X0 = 120, Y0 = 295, base = -26 * Math.PI / 180;
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
    var dx = Math.cos(base), dy = Math.sin(base), nx0 = dy, ny0 = -dx; // points up-left of the rod
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

    // handle
    var hw2 = c.h.w;
    svg += '<g transform="translate(' + X0 + "," + Y0 + ') rotate(-26)">' +
      '<clipPath id="hclip"><rect x="' + -HPX + '" y="' + -hw2 / 2 + '" width="' + (HPX + 8) + '" height="' + hw2 + '" rx="' + hw2 / 2 + '"/></clipPath>' +
      '<rect x="' + -HPX + '" y="' + -hw2 / 2 + '" width="' + (HPX + 8) + '" height="' + hw2 + '" rx="' + hw2 / 2 + '" fill="' + c.h.color + '"/>' +
      '<g clip-path="url(#hclip)">' + handleDecor(c.h.id, hw2) + "</g>" +
      '<rect x="' + -HPX + '" y="' + -hw2 / 2 + '" width="' + (HPX + 8) + '" height="' + hw2 + '" rx="' + hw2 / 2 + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/></g>';

    // line + toys
    var tip = pts[N], spx = state.strLen * 1.6, list = [];
    D.toys.forEach(function (toy) { for (var q = 0; q < (state.items[toy.id] || 0); q++) list.push(toy.id); });
    var n = list.length;
    svg += '<g transform="translate(' + tip.x.toFixed(1) + "," + tip.y.toFixed(1) + ')"><g class="swing' + (doSwing ? " go" : "") + '" id="swing">' +
      '<line x1="0" y1="0" x2="0" y2="' + spx + '" stroke="' + c.ln.color + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="0" cy="' + spx + '" r="3.2" fill="' + c.ln.color + '"/>';
    list.forEach(function (id, k) {
      var px = (k - (n - 1) / 2) * 36, py = 14 + Math.abs(px) * 0.18 + (k % 2) * 10;
      svg += '<line x1="0" y1="' + spx + '" x2="' + px.toFixed(1) + '" y2="' + (spx + py).toFixed(1) + '" stroke="' + c.ln.color + '" stroke-width="1.6"/>' +
        '<g transform="translate(' + px.toFixed(1) + "," + (spx + py).toFixed(1) + ')">' + TOY[id] + "</g>";
    });
    svg += "</g></g>";

    // line length marker
    var mxl = tip.x + (n - 1) * 18 + 52;
    svg += '<g stroke="rgba(255,255,255,.7)" stroke-width="1.5" fill="none"><line x1="' + mxl.toFixed(1) + '" y1="' + tip.y.toFixed(1) + '" x2="' + mxl.toFixed(1) + '" y2="' + (tip.y + spx).toFixed(1) + '" stroke-dasharray="5 5"/>' +
      '<line x1="' + (mxl - 6).toFixed(1) + '" y1="' + tip.y.toFixed(1) + '" x2="' + (mxl + 6).toFixed(1) + '" y2="' + tip.y.toFixed(1) + '"/>' +
      '<line x1="' + (mxl - 6).toFixed(1) + '" y1="' + (tip.y + spx).toFixed(1) + '" x2="' + (mxl + 6).toFixed(1) + '" y2="' + (tip.y + spx).toFixed(1) + '"/></g>' +
      '<text x="' + (mxl + 12).toFixed(1) + '" y="' + (tip.y + spx / 2 + 5).toFixed(1) + '" fill="#fff" font-size="16" font-weight="600" style="font-family:var(--font-body)">' + esc(t("ruleLine", { len: state.strLen })) + "</text>";

    var el = $("#rod");
    el.innerHTML = svg;
    el.setAttribute("aria-label", t("svgLabel", { mat: nm(c.m), len: L, handle: nm(c.h), line: state.strLen }));
  }

  /* ---------------- static + list building ---------------- */
  var checked = {};

  function setText(id, s) { $(id).textContent = s; }

  function buildStatic() {
    document.documentElement.lang = lang;
    document.title = t("brand");
    setText("#brand", t("brand"));
    setText("#langBtn", t("langBtn"));
    setText("#skip", t("skip"));
    setText("#tapHint", t("tapHint"));
    setText("#gTipLabel", t("gTip"));
    setText("#gTotalLabel", t("gTotal"));
    ["s1", "s2", "s3", "s4", "s5", "lenLabel", "matLabel", "lineLenLabel", "lineTypeLabel", "safety",
      "nameLabel", "myDesignsTitle", "shopeeIntro", "partsTitle", "suppliesTitle", "stepsTitle", "affiliateNote",
      "priceTitle", "priceNote", "foot"].forEach(function (k) {
      var el = $("#" + k);
      if (el) el.textContent = t(k === "affiliateNote" ? "affiliate" : k);
    });
    setText("#lenMin", D.length.min + " " + t("cm")); setText("#lenMax", D.length.max + " " + t("cm"));
    setText("#lineMin", D.line.min + " " + t("cm")); setText("#lineMax", D.line.max + " " + t("cm"));
    setText("#tab-save", t("tabSave")); setText("#tab-shopee", t("tabShopee")); setText("#tab-order", C.ORDERS_OPEN ? t("tabOrder") : t("tabOrderSoon"));
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

  function radio(name, o, extra) {
    return '<label class="opt"><input type="radio" name="' + name + '" value="' + o.id + '">' + (o.color ? '<span class="swatch" style="background:' + o.color + '"></span>' : "") +
      '<span class="optText"><b>' + esc(nm(o)) + "</b>" + (o.feel ? "<small>" + esc(o.feel[lang]) + "</small>" : "") + "</span>" +
      '<span class="w" data-w="' + extra + ":" + o.id + '"></span></label>';
  }

  function buildLists() {
    $("#matOpts").innerHTML = D.materials.map(function (o) { return radio("material", o, "mat"); }).join("");
    $("#handleOpts").innerHTML = D.handles.map(function (o) { return radio("handle", o, "handle"); }).join("");
    $("#lineOpts").innerHTML = D.lines.map(function (o) { return radio("strType", o, "line"); }).join("");
    $("#toyGrid").innerHTML = D.toys.map(function (o) {
      return '<div class="toy" data-toy="' + o.id + '"><svg viewBox="-26 -2 52 54" aria-hidden="true">' + TOY[o.id] + "</svg>" +
        "<b>" + esc(nm(o)) + '</b><small data-w="toy:' + o.id + '"></small>' +
        '<div class="stepper"><button type="button" data-act="dec" data-id="' + o.id + '" aria-label="' + esc(t("remove", { name: nm(o) })) + '"><span aria-hidden="true">−</span></button>' +
        '<span data-qty="' + o.id + '">0</span>' +
        '<button type="button" data-act="inc" data-id="' + o.id + '" aria-label="' + esc(t("add", { name: nm(o) })) + '"><span aria-hidden="true">+</span></button></div></div>';
    }).join("");
  }

  /* ---------------- update ---------------- */
  function level(r, total) {
    if (r > 1) return { lv: "bad", key: "vBad" };
    if (total > C.TOTAL_MAX) return { lv: "bad", key: "vHeavy" };
    if (r > 0.7) return { lv: "warn", key: "vWarn" };
    return { lv: "good", key: "vGood" };
  }

  function update(doSwing) {
    var c = calc(state), i;

    // controls
    var lr = $("#lenRange"), sr = $("#lineRange");
    if (+lr.value !== state.length) lr.value = state.length;
    if (+sr.value !== state.strLen) sr.value = state.strLen;
    setText("#lenOut", state.length + " " + t("cm"));
    setText("#lineOut", state.strLen + " " + t("cm"));
    [["material", state.material], ["handle", state.handle], ["strType", state.strType]].forEach(function (p) {
      var inputs = document.querySelectorAll('input[name="' + p[0] + '"]');
      for (i = 0; i < inputs.length; i++) inputs[i].checked = inputs[i].value === p[1];
    });
    var ws = document.querySelectorAll("[data-w]");
    for (i = 0; i < ws.length; i++) {
      var parts = ws[i].getAttribute("data-w").split(":"), kind = parts[0], id = parts[1], txt = "";
      if (kind === "mat") txt = t("weightAtLen", { w: fmt(state.length * find(D.materials, id).gpc) });
      else if (kind === "handle") txt = fmt(find(D.handles, id).g) + " g";
      else if (kind === "line") txt = t("weightAtLen", { w: fmt(state.strLen * find(D.lines, id).gpcm) });
      else if (kind === "toy") txt = fmt(find(D.toys, id).g) + " g";
      ws[i].textContent = txt;
    }
    var full = c.n >= C.MAX_ATTACH;
    D.toys.forEach(function (toy) {
      var q = state.items[toy.id] || 0, card = document.querySelector('[data-toy="' + toy.id + '"]');
      card.classList.toggle("has", q > 0);
      card.querySelector("[data-qty]").textContent = q;
      card.querySelector('[data-act="dec"]').disabled = q === 0;
      card.querySelector('[data-act="inc"]').disabled = full;
    });
    setText("#slots", full ? t("slotsFull", { max: C.MAX_ATTACH }) : t("slotsLeft", { n: C.MAX_ATTACH - c.n }));

    // headline + stage
    setText("#headline", t("headline", { mat: nm(c.m), len: state.length }));
    setText("#specLine", t("spec", { total: fmt(c.total), tip: fmt(c.tip) }));
    renderStage(c, !!doSwing);

    // gauges
    var tipLv = c.ratio > 1 ? "bad" : c.ratio > 0.7 ? "warn" : "good";
    var totLv = c.total > C.TOTAL_MAX ? "bad" : "good";
    $("#gTip").setAttribute("data-level", tipLv);
    $("#gTotal").setAttribute("data-level", totLv);
    $("#gTipFill").style.width = (Math.min(c.ratio, 1.3) / 1.3 * 100).toFixed(1) + "%";
    $("#gTotalFill").style.width = Math.min(c.total, 100).toFixed(1) + "%";
    $("#gTotalMark").style.left = C.TOTAL_MAX + "%";
    var tipVal = t("gTipVal", { tip: fmt(c.tip), limit: fmt(c.limit) });
    setText("#gTipVal", tipVal);
    setText("#gTipNote", t("gTipNote", { len: state.length, limit: fmt(c.limit) }));
    setText("#gTotalVal", t("gTotalVal", { total: fmt(c.total) }));
    setText("#gTotalNote", t("gTotalNote", { max: C.TOTAL_MAX }));
    $("#gTipTrack").setAttribute("aria-valuenow", Math.round(c.ratio * 100));
    $("#gTipTrack").setAttribute("aria-valuetext", tipVal);
    $("#gTipTrack").setAttribute("aria-label", t("gTip"));
    $("#gTotalTrack").setAttribute("aria-valuenow", Math.round(c.total));
    $("#gTotalTrack").setAttribute("aria-valuetext", t("gTotalVal", { total: fmt(c.total) }));
    $("#gTotalTrack").setAttribute("aria-label", t("gTotal"));

    var v = level(c.ratio, c.total);
    var key = v.key === "vBad" && c.lmax < D.length.min ? "vBadShort" : v.key;
    setText("#verdict", t(key, { tip: fmt(c.tip), lmax: c.lmax }));
    $("#verdict").setAttribute("data-level", v.lv);
    $("#pill").setAttribute("data-level", v.lv);
    setText("#pill", v.key === "vBad" ? t("pillBad") : v.key === "vHeavy" ? t("pillHeavy") : v.lv === "warn" ? t("pillWarn") : t("pillGood"));

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
    var rows = [];
    rows.push(partRow("rod-" + c.m.id, nm(c.m), t("cutTo", { len: state.length }), c.m.kw));
    rows.push(partRow("handle-" + c.h.id, t("handleLine", { handle: nm(c.h) }), "", c.h.kw));
    rows.push(partRow("line-" + c.ln.id, nm(c.ln), t("lenOnly", { len: state.strLen }), c.ln.kw));
    D.toys.forEach(function (toy) {
      var q = state.items[toy.id] || 0;
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
    var c = calc(state), p = prices(state), items = [];
    D.toys.forEach(function (toy) { var q = state.items[toy.id] || 0; if (q) items.push(nm(toy) + " × " + q); });
    var L = [t("orderHead"), "",
      t("oSpec") + ": " + t("headline", { mat: nm(c.m), len: state.length }),
      t("handleLine", { handle: nm(c.h) }) + ", " + t("lineLine", { line: nm(c.ln), len: state.strLen }),
      t("oItems") + ": " + (items.length ? items.join(", ") : t("oNone")),
      t("spec", { total: fmt(c.total), tip: fmt(c.tip) }),
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
  function bind() {
    $("#langBtn").addEventListener("click", function () {
      lang = lang === "th" ? "en" : "th";
      lsSet("catwand.lang", lang);
      buildStatic(); buildLists(); update(false);
    });

    var panel = $("#panel");
    panel.addEventListener("change", function (e) {
      var n = e.target.name;
      if (n === "material") state.material = e.target.value;
      else if (n === "handle") state.handle = e.target.value;
      else if (n === "strType") state.strType = e.target.value;
      else if (e.target.id === "lenRange") state.length = snap(+e.target.value, D.length);
      else if (e.target.id === "lineRange") state.strLen = snap(+e.target.value, D.line);
      else if (e.target.getAttribute && e.target.getAttribute("data-chk")) { checked[e.target.getAttribute("data-chk")] = e.target.checked; return; }
      else return;
      update(true);
    });
    panel.addEventListener("input", function (e) {
      if (e.target.id === "lenRange") { state.length = snap(+e.target.value, D.length); update(false); }
      else if (e.target.id === "lineRange") { state.strLen = snap(+e.target.value, D.line); update(false); }
    });

    $("#toyGrid").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]");
      if (!b || b.disabled) return;
      var id = b.getAttribute("data-id"), q = state.items[id] || 0;
      if (b.getAttribute("data-act") === "inc" && count(state) < C.MAX_ATTACH) q++;
      else if (b.getAttribute("data-act") === "dec" && q > 0) q--;
      if (q > 0) state.items[id] = q; else delete state.items[id];
      update(true);
    });

    $("#stage").addEventListener("click", wiggle);

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

    // coming-soon shortcuts
    $("#soonSave").addEventListener("click", function () { $("#tab-save").click(); $("#designName").focus(); });
    $("#soonShopee").addEventListener("click", function () { $("#tab-shopee").click(); });

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
    var lr = $("#lenRange"), sr = $("#lineRange");
    lr.min = D.length.min; lr.max = D.length.max; lr.step = D.length.step;
    sr.min = D.line.min; sr.max = D.line.max; sr.step = D.line.step;
    buildStatic(); buildLists(); bind(); update(true);
  }
  init();
})();
