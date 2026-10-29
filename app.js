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
      handle: "foam", hMode: "cover", handleLen: D.handleLen.def,
      strLen: D.line.def, strType: "cotton", hook: "ring",
      person: D.person.def, cat: "adult",
      rodColor: "", handleColor: "", lineColor: "",
      items: [newItem("fish", D.line.def), newItem("ribbon", 22)]
    };
  }

  function serialize(s) {
    // colour, pattern and filling are written only when they differ from the plain toy, so older links stay short
    var items = s.items.map(function (it) {
      var toy = find(D.toys, it.id), c = toy.paint ? it.c : "", p = toy.doll ? it.p : "solid", f = toy.doll ? it.f : "cotton";
      return it.id + "." + it.at + (c || p !== "solid" || f !== "cotton" ? "." + c + "." + p + "." + f : "");
    }).join(",");
    return new URLSearchParams({
      l: s.length, m: s.material, d: s.rodD, h: s.handle, hm: s.hMode, hl: s.handleLen,
      sl: s.strLen, st: s.strType, hk: s.hook, ph: s.person, cs: s.cat,
      rc: s.rodColor, hc: s.handleColor, lc: s.lineColor, i: items
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
    s.hMode = q.get("hm") === "joined" ? "joined" : "cover";
    s.handleLen = snap(parseFloat(q.get("hl")) || D.handleLen.def, D.handleLen);
    var slv = parseFloat(q.get("sl"));
    s.strLen = snap(isNaN(slv) ? D.line.def : slv, D.line);
    if (find(D.lines, q.get("st"))) s.strType = q.get("st");
    if (find(D.hooks, q.get("hk"))) s.hook = q.get("hk");
    s.person = snap(parseFloat(q.get("ph")) || D.person.def, D.person);
    if (find(D.cats, q.get("cs"))) s.cat = q.get("cs");
    if (find(D.colors, q.get("rc"))) s.rodColor = q.get("rc");
    if (find(D.colors, q.get("hc"))) s.handleColor = q.get("hc");
    if (find(D.colors, q.get("lc"))) s.lineColor = q.get("lc");
    s.items = [];
    var left = C.MAX_ATTACH;
    (q.get("i") || "").split(",").forEach(function (tok) {
      var id, at, n = 1, p, look = [];
      if (!tok || left <= 0) return;
      if (tok.indexOf(".") > 0) { p = tok.split("."); id = p[0]; at = parseFloat(p[1]); look = p.slice(2); }
      else if (tok.indexOf(":") > 0) { p = tok.split(":"); id = p[0]; n = Math.floor(parseFloat(p[1])); at = s.strLen; } // older links
      else return;
      if (!find(D.toys, id)) return;
      for (var k = 0; k < n && left > 0; k++) {
        var it = newItem(id, clamp(Math.round(isNaN(at) ? s.strLen : at), 0, s.strLen));
        if (find(D.colors, look[0])) it.c = look[0];
        if (find(D.patterns, look[1])) it.p = look[1];
        if (find(D.fills, look[2])) it.f = look[2];
        s.items.push(it);
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

  /* ---------------- prices (sample data now, database later) ---------------- */
  var priceLive = false;
  function priceOf(kind, id) {
    if (kind === "mat") { var m = find(D.materials, id); return Math.round(m.base + m.perCm * state.length); }
    if (kind === "handle") return find(D.handles, id).price;
    if (kind === "line") return Math.round(find(D.lines, id).perCm * state.strLen);
    if (kind === "hook") return find(D.hooks, id).price;
    if (kind === "toy") return find(D.toys, id).price;
    if (kind === "extra") return find(D.extras, id).price;
    return 0;
  }
  function priceBoxText(n, per) { return "฿ " + n + (per ? " " + t("perPiece") : ""); }

  // Merge prices from the database into the sample catalog. If the call fails the sample prices stay.
  function loadPrices() {
    if (!C.PRICES_URL || !window.fetch) return;
    fetch(C.PRICES_URL).then(function (r) { return r.json(); }).then(function (j) {
      ["materials", "handles", "lines", "hooks", "toys", "extras", "fills"].forEach(function (g) {
        var src = j[g] || {};
        D[g].forEach(function (it) { if (src[it.id]) for (var k in src[it.id]) it[k] = src[it.id][k]; });
      });
      if (j.tipFit) for (var k in j.tipFit) D.tipFit[k] = j.tipFit[k];
      priceLive = true;
      update(false);
    }).catch(function () { /* keep the sample prices */ });
  }

  /* ---------------- cat safety ---------------- */
  function safetyItems(c) {
    var warn = [], tip = [], small = false, doll = false, zip = false, nip = false;
    state.items.forEach(function (it) {
      if (it.id === "bell" || it.id === "pompom" || it.id === "feather") small = true;
      if (find(D.toys, it.id).doll) { doll = true; if (it.f === "zip") zip = true; if (it.f === "nip" || it.f === "zip") nip = true; }
    });
    function add(list, key) { list.push({ title: t(key + "_t"), text: t(key) }); }
    if (state.strLen === 0) add(tip, "s_noline");
    else if (state.strType === "braid") add(warn, "s_braid"); else add(tip, "s_cotton");
    if (c.hk.g) { add(warn, "s_metal"); if (c.hk.id === "clip") add(warn, "s_clip"); }
    if (state.material === "wire") add(warn, "s_wire");
    if (state.material === "tube") add(warn, "s_tube");
    if (state.material === "bamboo" || state.material === "wood") add(tip, "s_wood");
    if (small) add(warn, "s_small");
    if (zip) add(warn, "s_zip");
    if (nip) add(tip, "s_nip");
    if (doll) add(tip, "s_seam");
    if (state.rodColor || state.handleColor) add(tip, "s_paint");
    add(tip, "s_always");
    return { warn: warn, tip: tip };
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
    var m = find(D.materials, s.material), h = find(D.handles, s.handle), ln = find(D.lines, s.strType), hk = find(D.hooks, s.hook);
    var sp = rodSpec(m, s.rodD);
    // cover: the handle is a sleeve on the rod, so the rod is one piece and the sleeve adds no length.
    // joined: a separate handle is attached behind the rod and adds length (and a weak joint).
    var joined = s.hMode === "joined" && !h.bare;
    var rod = s.length * sp.gpc, hand = h.bare ? 0 : h.gpc * s.handleLen;
    var free = joined ? s.length : Math.max(s.length - s.handleLen, 10);   // rod in front of the grip
    var str = s.strLen * ln.gpcm, toys = 0;
    s.items.forEach(function (it) { toys += toyG(it); });
    var hookG = hk.g ? hk.g * s.items.length + D.tipFit.g : 0;
    var tip = str + toys + hookG, total = rod + hand + tip;
    var limit = flexLimit(sp.EI, free);

    // Torque about the middle of the handle with the wand held level. The handle itself
    // is centred on the grip so it adds weight but no torque.
    var g2b = s.handleLen / 2, moment;
    if (joined) moment = rod * (g2b + s.length / 2) + tip * (g2b + s.length);                       // g cm
    else moment = sp.gpc * s.length * free / 2 + tip * (s.length - g2b);

    var thick = null;
    if (tip / limit > 1) {
      for (var i = 0; i < m.sizes.length; i++) {
        if (m.sizes[i] > s.rodD && flexLimit(rodSpec(m, m.sizes[i]).EI, free) * 0.7 >= tip) { thick = m.sizes[i]; break; }
      }
    }
    return {
      m: m, h: h, ln: ln, hk: hk, hookG: hookG, sp: sp, rod: rod, hand: hand, str: str, toys: toys, tip: tip, total: total,
      limit: limit, ratio: tip / limit,
      lmax: Math.floor((maxLenFor(sp.EI, tip) + (joined ? 0 : s.length - free)) / D.length.step) * D.length.step,
      moment: moment, felt: moment / C.WRIST_ARM, balance: moment / total,
      gripD: h.bare ? s.rodD : h.d, n: s.items.length, thick: thick, joined: joined, free: free,
      totalLen: s.length + (joined ? s.handleLen : 0)
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
    if (c.joined) {
      if (gl === "good") gl = "warn";
      msgs.push(t("gripJoint", { d: fmt(state.rodD) }));
    }
    if (c.h.slick) { if (gl === "good") gl = "warn"; msgs.push(t("gripSlick")); }
    grip = { lv: gl, text: msgs.length ? msgs.join(" ") : t("gripGood", { d: fmt(gd), len: hl }) };

    var order = { good: 0, warn: 1, bad: 2 };
    var worst = [rod, wrist, grip].reduce(function (a, x) { return order[x.lv] > order[a] ? x.lv : a; }, "good");
    return { rod: rod, wrist: wrist, grip: grip, worst: worst };
  }

  function prices(s) {
    var c = calc(s), rows = [];
    rows.push({ label: t("rodLine", { mat: nm(c.m), len: s.length }), v: Math.round(c.m.base + c.m.perCm * s.length) });
    if (!c.h.bare) rows.push({ label: t("handleLine", { handle: nm(c.h) }), v: c.h.price });
    if (s.strLen > 0) rows.push({ label: t("lineLine", { line: nm(c.ln), len: s.strLen }), v: Math.round(c.ln.perCm * s.strLen) });
    groupItems(s.items).forEach(function (g) {
      var look = lookParts(g.it).join(", ");
      rows.push({ label: nm(find(D.toys, g.it.id)) + (look ? " (" + look + ")" : "") + " × " + g.q, v: toyPrice(g.it) * g.q });
    });
    if (c.hk.g) {
      rows.push({ label: nm(c.hk) + " × " + s.items.length, v: c.hk.price * s.items.length });
      rows.push({ label: nm(D.tipFit), v: D.tipFit.price });
    }
    var diy = rows.reduce(function (a, r) { return a + r.v; }, 0);
    rows.push({ label: t("assembly"), v: C.ASSEMBLY_FEE });
    rows.push({ label: t("shipping"), v: C.SHIPPING_FEE });
    var sum = rows.reduce(function (a, r) { return a + r.v; }, 0);
    return { rows: rows, total: sum, diy: diy };
  }

  function countBy(s) {
    var counts = {};
    s.items.forEach(function (it) { counts[it.id] = (counts[it.id] || 0) + 1; });
    return counts;
  }

  /* ---------------- colours ---------------- */
  function hexRgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function rgbHex(a) { return "#" + a.map(function (v) { return ("0" + clamp(Math.round(v), 0, 255).toString(16)).slice(-2); }).join(""); }
  function shade(h, f) { return rgbHex(hexRgb(h).map(function (v) { return v * f; })); }
  function mix(a, b, k) { var x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map(function (v, i) { return v + (y[i] - v) * k; })); }
  function colorHex(id) { var o = id ? find(D.colors, id) : null; return o ? o.hex : null; }
  function colorName(id, th) { var o = id ? find(D.colors, id) : null; return o ? o.name[th ? "th" : lang] : ""; }
  // Colour in use, or the part's own colour when the visitor has not picked one.
  function rodCol(c) { return colorHex(state.rodColor) || c.m.color; }
  function handleCol(c) { return c.h.bare ? rodCol(c) : (colorHex(state.handleColor) || c.h.color); }
  function lineCol(c) { return colorHex(state.lineColor) || c.ln.color; }
  // Copy of a part with its colour swapped, for the little part icons.
  function tinted(o, id) {
    var hex = colorHex(id), r = {}, k;
    if (!hex) return o;
    for (k in o) r[k] = o[k];
    r.color = hex;
    return r;
  }

  /* ---------------- toys: look, weight, price ---------------- */
  // c = colour id ("" keeps the toy as drawn), p = pattern and f = filling (dolls only).
  function newItem(id, at) { return { id: id, at: at, c: "", p: "solid", f: "cotton" }; }
  function toyG(it) { var toy = find(D.toys, it.id); return toy.g + (toy.doll ? find(D.fills, it.f).dg : 0); }
  function toyPrice(it) { var toy = find(D.toys, it.id); return toy.price + (toy.doll ? find(D.fills, it.f).price : 0); }

  // Parts of the look that differ from the plain default, e.g. ["Pink", "Polka dots", "Catnip"].
  function lookParts(it, th) {
    var toy = find(D.toys, it.id), out = [], k = th ? "th" : lang, col = toy.paint ? find(D.colors, it.c) : null, pt, fl;
    if (col) out.push(col.name[k]);
    if (toy.doll) {
      pt = find(D.patterns, it.p); fl = find(D.fills, it.f);
      if (pt && pt.id !== "solid") out.push(pt.name[k]);
      if (fl && fl.id !== "cotton") out.push(fl.name[k]);
    }
    return out;
  }
  function toyKw(it) {
    var toy = find(D.toys, it.id), kw = toy.kw, col = toy.paint ? find(D.colors, it.c) : null, pt, fl;
    if (col) kw += " สี" + col.kw;
    if (toy.doll) {
      pt = find(D.patterns, it.p); fl = find(D.fills, it.f);
      if (pt && pt.kw) kw += " " + pt.kw;
      if (fl && fl.kw) kw += " " + fl.kw;
    }
    return kw;
  }
  // Toys that look the same are listed once with a count.
  function groupItems(items) {
    var keys = [], map = {};
    items.forEach(function (it) {
      var toy = find(D.toys, it.id), k = [it.id, toy.paint ? it.c : "", toy.doll ? it.p : "", toy.doll ? it.f : ""].join("|");
      if (!map[k]) { map[k] = { key: k, it: it, q: 0 }; keys.push(k); }
      map[k].q++;
    });
    return keys.map(function (k) { return map[k]; });
  }

  /* ---------------- toy drawings (top of each toy at 0,0, hangs down) ---------------- */
  var pid = 0;
  // Pattern laid over a doll body. shape is the body outline and x0..y1 its box; clipped so nothing spills out.
  // Ids are numbered so several dolls on the page never share a clip.
  function patternSvg(p, shape, x0, y0, x1, y1, base) {
    var id, o, x, y, i = 0;
    if (!p || p === "solid") return "";
    id = "pt" + (++pid);
    o = '<clipPath id="' + id + '">' + shape + '</clipPath><g clip-path="url(#' + id + ')">';
    if (p === "stripes") {
      for (x = x0; x < x1; x += 8) o += '<rect x="' + x + '" y="' + y0 + '" width="4" height="' + (y1 - y0) + '" fill="' + shade(base, 0.8) + '" opacity=".75"/>';
    } else if (p === "dots") {
      for (y = y0 + 3; y < y1; y += 7, i++) for (x = x0 + 3 + (i % 2) * 3.5; x < x1; x += 7) o += '<circle cx="' + x + '" cy="' + y + '" r="1.7" fill="#fff" opacity=".9"/>';
    } else {
      for (y = y0; y < y1; y += 6, i++) for (x = x0 + (i % 2) * 6; x < x1; x += 12) o += '<rect x="' + x + '" y="' + y + '" width="6" height="6" fill="' + shade(base, 0.82) + '" opacity=".7"/>';
    }
    return o + "</g>";
  }

  // A small mark on the doll that shows what is inside.
  function fillMark(f, x, y) {
    var at = ' transform="translate(' + x + "," + y + ')"';
    if (f === "nip") return "<path" + at + ' d="M0 0 q4 -6 9 -1 q-4 6 -9 1z" fill="#6FBF73" stroke="#3E8A43" stroke-width=".8"/>';
    if (f === "zip") return "<g" + at + '><line x1="0" y1="0" x2="13" y2="0" stroke="#8D95A8" stroke-width="2.4" stroke-dasharray="1.6 1.2"/><rect x="11" y="-2.6" width="4" height="5.2" rx="1.2" fill="#C9CED8" stroke="#8D95A8" stroke-width=".8"/></g>';
    if (f === "crinkle") return "<path" + at + ' d="M0 0 l2.5 -4 l2.5 4 l2.5 -4 l2.5 4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>';
    return "";
  }

  function pompomSvg(c) {
    var base = c || "#E8547A", fluff = c ? shade(c, 0.85) : "#F2879F", o = '<circle cx="0" cy="13" r="11" fill="' + base + '"/>';
    for (var i = 0; i < 14; i++) {
      var a = i * Math.PI * 2 / 14, cs = Math.cos(a), sn = Math.sin(a);
      o += '<line x1="' + (cs * 8).toFixed(1) + '" y1="' + (13 + sn * 8).toFixed(1) + '" x2="' + (cs * 13.5).toFixed(1) + '" y2="' + (13 + sn * 13.5).toFixed(1) + '" stroke="' + fluff + '" stroke-width="2" stroke-linecap="round"/>';
    }
    return o + '<circle cx="-3" cy="9" r="3" fill="#fff" opacity=".35"/>';
  }

  function fishSvg(c, p, f) {
    var base = c || "#F4B63F", edge = c ? shade(c, 0.68) : "#B5822A", body = "M-16 0 C-8 -12 8 -12 14 0 C8 12 -8 12 -16 0Z";
    return '<g transform="translate(0,17) rotate(90)"><path d="M12 0 L25 -10 L25 10Z" fill="' + (c ? shade(c, 0.92) : base) + '" stroke="' + edge + '" stroke-width="1"/>' +
      '<path d="' + body + '" fill="' + base + '" stroke="' + edge + '" stroke-width="1"/>' +
      patternSvg(p, '<path d="' + body + '"/>', -16, -10, 14, 10, base) + fillMark(f, -9, 4) +
      '<circle cx="-8" cy="-3" r="1.9" fill="#3A2E20"/><path d="M-1 -8 Q3 0 -1 8" fill="none" stroke="#3A2E20" stroke-width="1.2" stroke-dasharray="2 2"/></g>';
  }

  function mouseSvg(c, p, f) {
    var base = c || "#C9CED8", edge = c ? shade(c, 0.68) : "#8D95A8", ear = c ? mix(c, "#F2A6B8", 0.5) : "#F2A6B8", tail = c ? shade(c, 0.75) : "#E58FA3";
    return '<g transform="translate(0,15) rotate(90)"><path d="M14 0 Q27 -9 33 4" fill="none" stroke="' + tail + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<ellipse rx="15" ry="9.5" fill="' + base + '" stroke="' + edge + '" stroke-width="1"/>' +
      patternSvg(p, '<ellipse rx="15" ry="9.5"/>', -15, -9.5, 15, 9.5, base) + fillMark(f, -3, 4) +
      '<circle cx="-5" cy="-9" r="5" fill="' + ear + '" stroke="' + edge + '" stroke-width="1"/><circle cx="-5" cy="9" r="5" fill="' + ear + '" stroke="' + edge + '" stroke-width="1"/>' +
      '<circle cx="-10" cy="-3" r="1.6" fill="#3A2E20"/><circle cx="-15" cy="0" r="2" fill="#E8547A"/></g>';
  }

  var TOY = {
    fish: fishSvg,
    mouse: mouseSvg,
    feather: function (c) {
      var left = c ? mix(c, "#fff", 0.6) : "#F6F7FB", right = c ? shade(c, 0.88) : "#F4B63F", mid = c || "#E8547A", stem = c ? shade(c, 0.55) : "#8E2442";
      return '<g transform="translate(0,2)"><path transform="rotate(-20)" d="M0 0 C-8 10 -7 26 0 36 C7 26 8 10 0 0Z" fill="' + left + '"/><path transform="rotate(20)" d="M0 0 C-8 10 -7 26 0 36 C7 26 8 10 0 0Z" fill="' + right + '"/><path d="M0 0 C-8 10 -7 26 0 38 C7 26 8 10 0 0Z" fill="' + mid + '"/><path d="M0 2 L0 36" stroke="' + stem + '" stroke-width="1"/></g>';
    },
    bell: function () {
      return '<circle cx="0" cy="1.5" r="1.8" fill="none" stroke="#9A6E12" stroke-width="1.2"/><circle cx="0" cy="11" r="8" fill="#E3A92B" stroke="#9A6E12" stroke-width="1"/><path d="M-8 12 H8" stroke="#9A6E12" stroke-width="1.4"/><circle cx="0" cy="14.5" r="1.5" fill="#9A6E12"/><ellipse cx="-3" cy="7" rx="2" ry="3" fill="#fff" opacity=".5"/>';
    },
    ribbon: function (c) {
      return '<circle cx="0" cy="2" r="2.4" fill="' + (c ? shade(c, 0.7) : "#F4B63F") + '"/><path d="M-1 3 C-10 12 6 20 -3 30 C-7 36 -1 40 -3 46" fill="none" stroke="' + (c || "#E8547A") + '" stroke-width="5" stroke-linecap="round"/><path d="M2 3 C8 10 -2 18 6 27 C9 32 5 36 7 40" fill="none" stroke="' + (c ? shade(c, 0.82) : "#F4B63F") + '" stroke-width="4" stroke-linecap="round"/>';
    },
    pompom: pompomSvg,
    nip: function (c) {
      return '<path d="M-6 3 Q-12 12 -11 20 Q-10 28 0 28 Q10 28 11 20 Q12 12 6 3Z" fill="' + (c || "#6FBF73") + '" stroke="' + (c ? shade(c, 0.65) : "#3E8A43") + '" stroke-width="1"/><path d="M-7 5 H7" stroke="#F4B63F" stroke-width="2"/><path d="M-6 17 q6 -6 12 0 q-6 6 -12 0z" fill="#3E8A43" opacity=".55"/>';
    },
    crinkle: function (c) {
      var edge = c ? shade(c, 0.7) : "#98A2B8";
      return '<circle cx="0" cy="11" r="10" fill="' + (c || "#D6DCE5") + '" stroke="' + edge + '" stroke-width="1"/><path d="M-7 6 L1 10 L-5 16 M3 4 L6 12 L1 17" fill="none" stroke="' + edge + '" stroke-width="1.2"/><ellipse cx="-3.5" cy="6" rx="3" ry="2" fill="#fff" opacity=".7"/>';
    }
  };
  // Inside of a toy's svg for one toy on the line (or a plain toy when given a bare newItem).
  function toyInner(it) {
    var toy = find(D.toys, it.id);
    return TOY[it.id](toy.paint ? colorHex(it.c) : null, toy.doll ? it.p : "solid", toy.doll ? it.f : "cotton");
  }

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
      out.push({ id: o.it.id, at: o.it.at, dx: dx, it: o.it });
    });
    return out;
  }

  /* ---------------- hardware drawings ---------------- */
  var METAL = "#C9CED8", METAL_D = "#8D95A8";
  // Small hook shape drawn on the line at (x, y). k scales it.
  function hookMark(id, x, y, k) {
    var g = '<g transform="translate(' + x + "," + y + ") scale(" + k + ')" fill="none" stroke="' + METAL + '" stroke-width="1.8" stroke-linecap="round">';
    if (id === "ring") g += '<circle cx="0" cy="3" r="4"/>';
    else if (id === "clip") g += '<circle cx="0" cy="-1" r="2.6"/><path d="M-3 2 h6 a3 3 0 0 1 0 6 h-6 a3 3 0 0 1 0 -6z" fill="' + METAL + '" stroke="' + METAL_D + '" stroke-width="1"/>';
    else if (id === "swivel") g += '<circle cx="0" cy="-1" r="2.2"/><rect x="-1.6" y="1.5" width="3.2" height="5" rx="1.4" fill="' + METAL + '" stroke="' + METAL_D + '" stroke-width="1"/><circle cx="0" cy="9" r="2.2"/>';
    return g + "</g>";
  }

  // Small picture for a part (same 52 x 54 box as the toy cards).
  var ICON = {
    rod: function (m) {
      return '<line x1="-18" y1="46" x2="20" y2="6" stroke="' + m.color + '" stroke-width="' + (m.id === "wire" ? 2.4 : m.id === "tube" ? 7 : 4.5) + '" stroke-linecap="round"/>' +
        (m.id === "tube" ? '<line x1="-18" y1="46" x2="20" y2="6" stroke="rgba(255,255,255,.7)" stroke-width="2" stroke-linecap="round"/>' : "") +
        (m.node ? '<g stroke="#7B5A1C" stroke-width="2"><line x1="-3" y1="34" x2="1" y2="38"/><line x1="7" y1="23" x2="11" y2="27"/></g>' : "");
    },
    handle: function (h) {
      return '<g transform="rotate(32 0 26)"><rect x="-8" y="3" width="16" height="46" rx="8" fill="' + h.color + '" stroke="rgba(255,255,255,.55)" stroke-width="1"/></g>';
    },
    line: function (ln) {
      return '<path d="M-2 2 C-16 12 14 20 0 30 C-12 38 8 44 0 52" fill="none" stroke="' + ln.color + '" stroke-width="3" stroke-linecap="round"/>';
    },
    hook: function (id) { return hookMark(id, 0, 16, 2.6); },
    tipfit: function () {
      return '<g fill="none" stroke="' + METAL + '" stroke-width="3" stroke-linecap="round"><circle cx="0" cy="12" r="8"/><line x1="0" y1="20" x2="0" y2="48"/></g>' +
        '<g stroke="' + METAL_D + '" stroke-width="1.5"><line x1="-4" y1="28" x2="4" y2="31"/><line x1="-4" y1="35" x2="4" y2="38"/><line x1="-4" y1="42" x2="4" y2="45"/></g>';
    },
    glue: function () {
      return '<g stroke-linejoin="round"><path d="M-16 12 h22 v12 h-8 l-3 18 h-8 l2 -18 h-5z" fill="#F4B63F" stroke="#9A6E12"/><path d="M6 14 l10 5 v3 l-10 -1z" fill="#C9CED8" stroke="#8D95A8"/></g>';
    },
    pliers: function () {
      return '<g stroke-linecap="round" fill="none"><path d="M-6 6 L2 28 M6 6 L-2 28" stroke="#C9CED8" stroke-width="3.5"/><path d="M2 28 L-14 50 M-2 28 L14 50" stroke="#E8547A" stroke-width="5"/></g>';
    }
  };
  function iconSvg(kind, o, arg) {
    if (o && o.img) return '<img class="pico" src="' + esc(o.img) + '" alt="">';
    var inner = kind === "toy" ? toyInner(arg) : ICON[kind](arg);
    return '<svg class="pico" viewBox="-26 -2 52 54" aria-hidden="true">' + inner + "</svg>";
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
      for (i = 0; i < 18; i++) o += '<path d="M' + (-hpx - 10 + i * step) + ' ' + h + ' L' + (-hpx - 10 + i * step + step) + ' ' + -h + ' M' + (-hpx - 10 + i * step) + ' ' + -h + ' L' + (-hpx - 10 + i * step + step) + ' ' + h + '" stroke="rgba(58,46,32,.35)" stroke-width="1.5" fill="none"/>';
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
    svg += '<path d="' + rodD + '" fill="' + rodCol(c) + '" stroke="rgba(255,255,255,.55)" stroke-width="1.2" stroke-linejoin="round"/>';
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
    var HPX = c.joined ? clamp(100 * state.handleLen / 14, 56, 112) : clamp(rodPx * state.handleLen / L, 30, 140);
    var hshift = c.joined ? 0 : HPX - 8;   // a sleeve sits on the rod; a joined handle sits behind it
    var hw2 = c.h.bare ? 9 : clamp(8 + c.gripD * 0.55, 11, 26), hcol = handleCol(c);
    svg += '<g transform="translate(' + X0 + "," + Y0 + ') rotate(-26)"><g transform="translate(' + hshift + ',0)">' +
      '<clipPath id="hclip"><rect x="' + -HPX + '" y="' + -hw2 / 2 + '" width="' + (HPX + 8) + '" height="' + hw2 + '" rx="' + hw2 / 2 + '"/></clipPath>' +
      '<rect x="' + -HPX + '" y="' + -hw2 / 2 + '" width="' + (HPX + 8) + '" height="' + hw2 + '" rx="' + hw2 / 2 + '" fill="' + hcol + '"/>' +
      '<g clip-path="url(#hclip)">' + handleDecor(c.h.id, hw2, HPX) + "</g>" +
      '<rect x="' + -HPX + '" y="' + -hw2 / 2 + '" width="' + (HPX + 8) + '" height="' + hw2 + '" rx="' + hw2 / 2 + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/></g></g>';
    if (c.joined) {
      svg += '<g transform="translate(' + X0 + "," + Y0 + ') rotate(-26)"><rect x="-4" y="-7" width="8" height="14" rx="2" fill="none" stroke="#F4B63F" stroke-width="2" stroke-dasharray="3 2"/></g>';
    }

    // line and toys at their positions along it
    var tip = pts[N], spx = state.strLen * 1.6;
    var laid = layoutItems(state.items, 34, 16, state.strLen), maxDx = 0;
    svg += '<g transform="translate(' + tip.x.toFixed(1) + "," + tip.y.toFixed(1) + ')"><g class="swing' + (doSwing ? " go" : "") + '" id="swing">' +
      '<line x1="0" y1="0" x2="0" y2="' + spx.toFixed(1) + '" stroke="' + lineCol(c) + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="0" cy="' + spx.toFixed(1) + '" r="3.2" fill="' + lineCol(c) + '"/>';
    laid.forEach(function (o) {
      var py = o.at * 1.6, hy = py + 12;
      maxDx = Math.max(maxDx, Math.abs(o.dx));
      svg += (c.hk.g ? hookMark(c.hk.id, 0, py.toFixed(1), 1.1) : '<circle cx="0" cy="' + py.toFixed(1) + '" r="2.8" fill="' + lineCol(c) + '"/>') +
        '<line x1="0" y1="' + py.toFixed(1) + '" x2="' + o.dx + '" y2="' + hy.toFixed(1) + '" stroke="' + lineCol(c) + '" stroke-width="1.6"/>' +
        '<g transform="translate(' + o.dx + "," + hy.toFixed(1) + ')">' + toyInner(o.it) + "</g>";
    });
    svg += "</g></g>";
    if (c.hk.g) svg += '<circle cx="' + tip.x.toFixed(1) + '" cy="' + tip.y.toFixed(1) + '" r="4" fill="none" stroke="' + METAL + '" stroke-width="1.8"/>';

    // line length marker
    var mxl = tip.x + maxDx + 52;
    if (state.strLen > 0) svg += '<g stroke="rgba(255,255,255,.7)" stroke-width="1.5" fill="none"><line x1="' + mxl.toFixed(1) + '" y1="' + tip.y.toFixed(1) + '" x2="' + mxl.toFixed(1) + '" y2="' + (tip.y + spx).toFixed(1) + '" stroke-dasharray="5 5"/>' +
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

  var CAT_SVG = '<g fill="#B8693A"><ellipse cx="0" cy="-17" rx="20" ry="9"/><rect x="-17" y="-15" width="5.5" height="15" rx="2.7"/><rect x="-10" y="-15" width="5.5" height="15" rx="2.7"/><ellipse cx="13" cy="-12" rx="7.5" ry="8.5"/><rect x="9.5" y="-7" width="5.5" height="7" rx="2.7"/><rect x="15.5" y="-7" width="5.5" height="7" rx="2.7"/><circle cx="-24" cy="-28" r="8.5"/><path d="M-31 -31 L-30 -41 L-23.5 -35Z"/><path d="M-24.5 -35.5 L-18.5 -40 L-17.5 -31.5Z"/><path d="M19 -20 C30 -22 34 -34 28 -42" fill="none" stroke="#B8693A" stroke-width="4" stroke-linecap="round"/></g><circle cx="-28" cy="-29" r="1.4" fill="#fff"/>';

  function renderScale(c) {
    var h = state.person, L = state.length, hl = state.handleLen, cat = find(D.cats, state.cat), k = cat.k;
    var ink = "#3A2E20", soft = "#6A5A44", i, s = "";
    var font = 'style="font-family:var(--font-body)"';

    // floor and 50 cm grid
    s += '<rect x="-50" y="0" width="300" height="16" fill="rgba(58,46,32,.07)"/>';
    for (i = 50; i <= 200; i += 50) {
      s += '<line x1="-50" y1="' + -i + '" x2="250" y2="' + -i + '" stroke="rgba(58,46,32,.22)" stroke-width=".6" stroke-dasharray="3 3"/>' +
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
    var tx = hx + (c.joined ? L : L - hl) * ca, ty = hy + (c.joined ? L : L - hl) * sa;
    var hw = Math.max(1.6, c.gripD / 10), hcol = handleCol(c);
    s += '<line x1="' + bx.toFixed(1) + '" y1="' + by.toFixed(1) + '" x2="' + fx.toFixed(1) + '" y2="' + fy.toFixed(1) + '" stroke="rgba(58,46,32,.55)" stroke-width="' + (hw + 1.2).toFixed(1) + '" stroke-linecap="round"/>' +
      '<line x1="' + bx.toFixed(1) + '" y1="' + by.toFixed(1) + '" x2="' + fx.toFixed(1) + '" y2="' + fy.toFixed(1) + '" stroke="' + hcol + '" stroke-width="' + hw.toFixed(1) + '" stroke-linecap="round"/>' +
      '<line x1="' + fx.toFixed(1) + '" y1="' + fy.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y2="' + ty.toFixed(1) + '" stroke="rgba(58,46,32,.55)" stroke-width="3" stroke-linecap="round"/>' +
      '<line x1="' + fx.toFixed(1) + '" y1="' + fy.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y2="' + ty.toFixed(1) + '" stroke="' + rodCol(c) + '" stroke-width="2" stroke-linecap="round"/>';

    // length ruler above the rod
    var nx = sa, ny = -ca, off = 10;
    var ox = c.joined ? hx : bx, oy = c.joined ? hy : by;
    var rsx = ox + nx * off, rsy = oy + ny * off, rex = rsx + L * ca, rey = rsy + L * sa;
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
        '<g transform="translate(' + (tx + o.dx).toFixed(1) + "," + hy2.toFixed(1) + ') scale(.2)">' + toyInner(o.it) + "</g>";
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
    $("#sizePill").setAttribute("data-level", key === "sizeFit" ? "good" : "warn");
    setText("#sizePill", t(key === "sizeFit" ? "sizePillOk" : key === "sizeShort" ? "sizePillShort" : "sizePillLong"));
    setText("#sizeFix", t("sizeFix", { mid: r.mid }));
    setText("#sizeFine", t("sizeFine", { h: hl }));
    var mk = D.market, mkey = L < mk.lo ? "marketShort" : L > mk.hi ? "marketLong" : "marketIn";
    setText("#marketNote", t(mkey, { lo: mk.lo, hi: mk.hi, avg: mk.avg, n: mk.n, len: L }));
  }

  /* ---------------- static + list building ---------------- */
  var checked = {};
  var picHidden = false;
  // Below 1240px the preview and the to-scale picture share one spot and this picks which shows;
  // on wide screens CSS shows both and ignores it.
  var view = lsGet("catwand.view") === "scale" ? "scale" : "close";
  function setView(v) {
    view = v;
    lsSet("catwand.view", v);
    $("#views").setAttribute("data-view", v);
    $("#vtClose").setAttribute("aria-pressed", v === "close" ? "true" : "false");
    $("#vtScale").setAttribute("aria-pressed", v === "scale" ? "true" : "false");
  }
  var thickSig = "", itemSig = "";

  function buildStatic() {
    document.documentElement.lang = lang;
    document.title = t("brand");
    setText("#brand", t("brand"));
    setText("#langBtn", t("langBtn"));
    setText("#skip", t("skip"));
    setText("#tapHint", t("tapHint"));
    setText("#vtClose", t("viewClose")); setText("#vtScale", t("viewScale"));
    $("#viewTabs").setAttribute("aria-label", t("viewsLabel"));
    setText("#stageToggle", picHidden ? t("showPic") : t("hidePic"));
    setText("#gRodLabel", t("gRod"));
    setText("#gWristLabel", t("gWrist"));
    setText("#vCatL", t("chkCat") + " "); setText("#vRodL", t("chkRod") + " "); setText("#vWristL", t("chkWrist") + " "); setText("#vGripL", t("chkGrip") + " ");
    ["s1", "s2", "s3", "s4", "s5", "lenLabel", "matLabel", "thickLabel", "lineLenLabel", "hModeLabel", "hookLabel", "hookNote", "lineNote", "lineTypeLabel", "safetyTitle", "safeSrcL", "estTitle", "estNote", "estMoreS",
      "nameLabel", "myDesignsTitle", "shopeeIntro", "partsTitle", "suppliesTitle", "stepsTitle", "affiliateNote",
      "priceTitle", "priceNote", "foot", "srcLink", "sizeTitle", "sizeIntro", "personLabel", "catLabel", "hlLabel", "itemsTitle",
      "whySummary", "why1", "why2", "why3", "why5", "whySources", "rodColorLabel", "rodColorNote", "handleColorLabel", "lineColorLabel", "marketHandle", "marketSrcL", "scaleTitle"].forEach(function (k) {
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
      '<span class="side"><span class="w" data-w="' + kind + ":" + o.id + '"></span>' +
      (kind === "mat" || kind === "handle" || kind === "line" || kind === "hook" ? '<span class="priceBox" data-p="' + (kind === "mat" ? "mat" : kind) + ":" + o.id + '" aria-disabled="true"></span>' : "") + "</span></label>";
  }

  // Round colour buttons. The first one keeps the part as it is; defKind picks its look ("toy" shows a rainbow).
  function swatchRow(name, defKind) {
    var def = t(defKind === "toy" ? "colorAsPictured" : "colorNatural");
    return '<label class="sw" title="' + esc(def) + '"><input type="radio" name="' + name + '" value="" aria-label="' + esc(def) + '"><span class="dot dot--def' + (defKind === "toy" ? " dot--toy" : "") + '"></span></label>' +
      D.colors.map(function (o) {
        return '<label class="sw" title="' + esc(nm(o)) + '"><input type="radio" name="' + name + '" value="' + o.id + '" aria-label="' + esc(nm(o)) + '"><span class="dot" style="background:' + o.hex + '"></span></label>';
      }).join("");
  }

  function chipGroup(name, label, list) {
    return '<div class="itemOpt"><span class="itemOptL" id="' + name + '-l">' + esc(label) + '</span><div class="chips" role="radiogroup" aria-labelledby="' + name + '-l">' +
      list.map(function (o) { return '<label class="chip"><input type="radio" name="' + name + '" value="' + o.id + '"><span>' + esc(nm(o)) + "</span></label>"; }).join("") + "</div></div>";
  }

  // Colour for every paintable toy; pattern and filling for dolls.
  function itemLook(i, toy) {
    var h = "";
    if (toy.paint) h += '<div class="itemOpt"><span class="itemOptL" id="ic-' + i + '-l">' + esc(t("itemColor")) + '</span><div class="swatches" role="radiogroup" aria-labelledby="ic-' + i + '-l">' + swatchRow("ic-" + i, "toy") + "</div></div>";
    if (toy.doll) h += chipGroup("ip-" + i, t("itemPattern"), D.patterns) + chipGroup("if-" + i, t("itemFill"), D.fills) + '<small class="fillNote" data-fnote="' + i + '"></small>';
    return h;
  }

  function checkRadios(root, name, val) {
    var ins = root.querySelectorAll('input[name="' + name + '"]'), k;
    for (k = 0; k < ins.length; k++) ins[k].checked = ins[k].value === val;
  }

  function buildLists() {
    thickSig = ""; itemSig = "";
    $("#rodColorOpts").innerHTML = swatchRow("rodColor", "rod");
    $("#handleColorOpts").innerHTML = swatchRow("handleColor", "handle");
    $("#lineColorOpts").innerHTML = swatchRow("lineColor", "line");
    $("#matOpts").innerHTML = D.materials.map(function (o) { return radio("material", o, "mat"); }).join("");
    $("#handleOpts").innerHTML = D.handles.map(function (o) {
      return radio("handle", o, "handle", o.feel[lang] + (o.d ? " Ø " + o.d + " " + t("mm") : ""));
    }).join("");
    $("#hModeOpts").innerHTML = ["cover", "joined"].map(function (id) {
      return '<label class="opt"><input type="radio" name="hMode" value="' + id + '"><span class="optText"><b>' + esc(t("hm_" + id)) +
        "</b><small>" + esc(t("hm_" + id + "_s")) + "</small></span></label>";
    }).join("");
    $("#lineOpts").innerHTML = D.lines.map(function (o) { return radio("strType", o, "line"); }).join("");
    $("#hookOpts").innerHTML = D.hooks.map(function (o) { return radio("hook", o, "hook"); }).join("");
    $("#catOpts").innerHTML = D.cats.map(function (o) {
      return '<label class="opt"><input type="radio" name="cat" value="' + o.id + '"><span class="optText"><b>' + esc(nm(o)) +
        "</b><small>" + esc(t("catBody", { b: o.body, kg: o.kg })) + "</small></span></label>";
    }).join("");
    $("#toyGrid").innerHTML = D.toys.map(function (o) {
      return '<div class="toy" data-toy="' + o.id + '"><svg viewBox="-26 -2 52 54" aria-hidden="true">' + toyInner(newItem(o.id, 0)) + "</svg>" +
        "<b>" + esc(nm(o)) + '</b><small data-w="toy:' + o.id + '"></small><span class="priceBox" data-p="toy:' + o.id + '" aria-disabled="true"></span>' +
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
        return '<li class="itemRow"><svg class="ico" viewBox="-26 -2 52 54" aria-hidden="true"></svg><div class="itemMain">' +
          '<div class="itemHead"><b>' + esc(nm(toy)) + '</b><small data-itg="' + i + '">' + fmt(toy.g) + ' g</small><button type="button" class="rm" data-rm="' + i + '" aria-label="' + esc(t("removeItem", { name: nm(toy) })) + '"><span aria-hidden="true">×</span></button></div>' +
          (state.strLen > 0 ? '<div class="itemPos"><label for="pos-' + i + '">' + esc(t("posLabel")) + '</label><output data-posout="' + i + '" for="pos-' + i + '"></output></div>' +
          '<input id="pos-' + i + '" class="range" type="range" min="0" max="' + state.strLen + '" step="1" data-pos="' + i + '">' +
          '<button type="button" class="endBtn" data-end="' + i + '">' + esc(t("endBtn")) + "</button>" : '<small class="tipOnly">' + esc(t("atTip")) + "</small>") + itemLook(i, toy) + "</div></li>";
      }).join("");
    }
    state.items.forEach(function (it, i) {
      var r = box.querySelector('[data-pos="' + i + '"]'), o = box.querySelector('[data-posout="' + i + '"]'), eb = box.querySelector('[data-end="' + i + '"]');
      if (r && +r.value !== it.at) r.value = it.at;
      if (o) o.textContent = it.at >= state.strLen ? t("atEnd") : t("atFrom", { at: it.at });
      if (eb) eb.hidden = it.at >= state.strLen;

      // colour, pattern and filling are discrete choices, so only their state and the picture are refreshed
      var row = box.children[i], fl = find(D.fills, it.f), fn = row && row.querySelector("[data-fnote]"), ig = row && row.querySelector("[data-itg]");
      if (!row || !row.classList.contains("itemRow")) return;
      row.querySelector(".ico").innerHTML = toyInner(it);
      if (ig) ig.textContent = fmt(toyG(it)) + " g";
      checkRadios(row, "ic-" + i, it.c); checkRadios(row, "ip-" + i, it.p); checkRadios(row, "if-" + i, it.f);
      if (fn) fn.textContent = fl.feel[lang] + (fl.dg || fl.price ? " (+" + fmt(fl.dg) + " g, +฿ " + fl.price + ")" : "");
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
    setText("#lineOut", state.strLen > 0 ? state.strLen + " " + t("cm") : t("noLine"));
    $("#lineNote").hidden = state.strLen > 0;
    $("#lineTypeBox").hidden = state.strLen === 0;
    setText("#hlOut", state.handleLen + " " + t("cm"));
    setText("#personOut", state.person + " " + t("cm"));
    [["material", state.material], ["rodD", state.rodD], ["handle", state.handle], ["hMode", state.hMode], ["strType", state.strType], ["hook", state.hook], ["cat", state.cat],
      ["rodColor", state.rodColor], ["handleColor", state.handleColor], ["lineColor", state.lineColor]].forEach(function (p) {
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
        txt = fmt((hh.bare ? 0 : hh.gpc) * state.handleLen) + " g";
      } else if (kind === "line") txt = t("weightAtLen", { w: fmt(state.strLen * find(D.lines, id).gpcm) });
      else if (kind === "hook") { var hq = find(D.hooks, id); txt = hq.g ? fmt(hq.g) + " g / " + t("hookEach") : "0 g"; }
      else if (kind === "toy") txt = fmt(find(D.toys, id).g) + " g";
      ws[i].textContent = txt;
    }

    var pbs = document.querySelectorAll("[data-p]");
    for (i = 0; i < pbs.length; i++) {
      var pp = pbs[i].getAttribute("data-p").split(":"), pv = priceOf(pp[0], pp[1]);
      pbs[i].textContent = priceBoxText(pv, pp[0] === "hook" && pv > 0);
      pbs[i].setAttribute("aria-label", t("priceBoxAria", { p: pv }));
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

    $("#hModeBox").hidden = !!c.h.bare;
    $("#handleColorBox").hidden = !!c.h.bare;
    $("#rodColorOpts .dot--def").style.background = c.m.color;
    $("#handleColorOpts .dot--def").style.background = c.h.color;
    $("#lineColorOpts .dot--def").style.background = c.ln.color;
    setText("#hmNote", c.h.bare ? t("hmNoteBare", { len: state.length }) :
      t(c.joined ? "hmNoteJoined" : "hmNoteCover", { total: c.totalLen, len: state.length, hl: state.handleLen, free: c.free }));
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

    var est = prices(state);
    setText("#estTotal", "฿ " + est.diy);
    $("#estTotal").setAttribute("aria-label", t("priceBoxAria", { p: est.diy }));
    setText("#estBadge", priceLive ? t("estBadgeLive") : t("estBadge"));
    $("#estBody").innerHTML = est.rows.filter(function (r) { return r.label !== t("assembly") && r.label !== t("shipping"); }).map(function (r) {
      return "<tr><td>" + esc(r.label) + "</td><td>" + r.v + " " + esc(t("baht")) + "</td></tr>";
    }).join("");

    var sf = safetyItems(c);
    $("#safeList").innerHTML = sf.warn.map(function (x) { return '<li data-level="warn"><b>' + esc(x.title) + "</b> " + esc(x.text) + "</li>"; }).join("") +
      sf.tip.map(function (x) { return '<li data-level="tip"><b>' + esc(x.title) + "</b> " + esc(x.text) + "</li>"; }).join("");
    setCheck("vCat", sf.warn.length ? { lv: "warn", text: t("vCatWarn", { n: sf.warn.length, first: sf.warn[0].title }) } : { lv: "good", text: t("vCatGood") });

    renderParts(c);
    renderPrice();
    renderSaved();

    try { history.replaceState(null, "", "?" + serialize(state)); } catch (e) { /* not allowed here */ }
  }

  /* ---------------- finish panes ---------------- */
  function shopeeUrl(kw) { return C.SHOPEE_LINK_TEMPLATE.replace("{kw}", encodeURIComponent(kw)); }

  function partRow(key, name, spec, kw, icon, price) {
    return '<li><input type="checkbox" data-chk="' + esc(key) + '"' + (checked[key] ? " checked" : "") + ' aria-label="' + esc(name) + '">' + (icon || "") +
      '<span class="pt">' + esc(name) + (spec ? "<small>" + esc(spec) + "</small>" : "") + "</span>" +
      (price === undefined ? "" : '<span class="priceBox" aria-disabled="true" aria-label="' + esc(t("priceBoxAria", { p: price })) + '">฿ ' + price + "</span>") +
      '<a class="btn" href="' + esc(shopeeUrl(kw)) + '" target="_blank" rel="noopener sponsored">' + esc(t("searchShopee")) + "</a></li>";
  }

  function colorSuffix(id) { return id ? " · " + colorName(id) : ""; }
  function kwColor(kw, id) { var o = id ? find(D.colors, id) : null; return o ? kw + " สี" + o.kw : kw; }

  function renderParts(c) {
    var rows = [];
    rows.push(partRow("rod-" + c.m.id + "-" + state.rodD, t("rodPart", { mat: nm(c.m), d: state.rodD }), t("cutTo", { len: state.length }) + colorSuffix(state.rodColor), c.m.kw.split("{d}").join(state.rodD), iconSvg("rod", c.m, tinted(c.m, state.rodColor)), priceOf("mat", c.m.id)));
    if (!c.h.bare) rows.push(partRow("handle-" + c.h.id, t("handleLine", { handle: nm(c.h) }), t(c.joined ? "handlePartJoined" : "handlePartSpec", { len: state.handleLen }) + colorSuffix(state.handleColor), kwColor(c.h.kw, state.handleColor), iconSvg("handle", c.h, tinted(c.h, state.handleColor)), priceOf("handle", c.h.id)));
    if (state.strLen > 0) rows.push(partRow("line-" + c.ln.id, nm(c.ln), t("lenOnly", { len: state.strLen }) + colorSuffix(state.lineColor), kwColor(c.ln.kw, state.lineColor), iconSvg("line", c.ln, tinted(c.ln, state.lineColor)), priceOf("line", c.ln.id)));
    if (c.hk.g) {
      rows.push(partRow("hook-" + c.hk.id, nm(c.hk), t("pieces", { q: c.n }) + " " + t("hookPerToy"), c.hk.kw, iconSvg("hook", c.hk, c.hk.id), c.hk.price * c.n));
      rows.push(partRow("tipfit", nm(D.tipFit), t("tipFitSpec"), D.tipFit.kw, iconSvg("tipfit", D.tipFit), D.tipFit.price));
    }
    groupItems(state.items).forEach(function (g) {
      var toy = find(D.toys, g.it.id), look = lookParts(g.it);
      rows.push(partRow("toy-" + g.key, nm(toy) + (look.length ? " (" + look.join(", ") + ")" : ""), t("pieces", { q: g.q }), toyKw(g.it), iconSvg("toy", toy, g.it), toyPrice(g.it) * g.q));
    });
    $("#partsList").innerHTML = rows.join("");
    $("#suppliesList").innerHTML = D.extras.map(function (e) { return partRow("x-" + e.id, nm(e), "", e.kw, iconSvg(e.id, e), e.price); }).join("");
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
    var c = calc(state), p = prices(state), items = [], hues = [];
    state.items.forEach(function (it) {
      var at = state.strLen === 0 ? t("atTip") : it.at >= state.strLen ? t("atEnd") : t("atFrom", { at: it.at }), look = lookParts(it);
      items.push(nm(find(D.toys, it.id)) + (look.length ? " [" + look.join(", ") + "]" : "") + " (" + at + ")");
    });
    [["rodColorLabel", state.rodColor], ["handleColorLabel", state.handleColor], ["lineColorLabel", state.lineColor]].forEach(function (x) {
      if (x[1]) hues.push(t(x[0]) + " " + colorName(x[1]));
    });
    var L = [t("orderHead"), "",
      t("oSpec") + ": " + t("headline", { mat: nm(c.m), len: state.length }) + ", " + state.rodD + " " + t("mm"),
      t("handleLine", { handle: nm(c.h) }) + " " + state.handleLen + " " + t("cm") + (c.h.bare ? "" : " (" + t(c.joined ? "hm_joined" : "hm_cover") + ")") + ", " + (state.strLen > 0 ? t("lineLine", { line: nm(c.ln), len: state.strLen }) : t("noLine")),
      t("hookLabel") + ": " + nm(c.hk),
      t("oColors") + ": " + (hues.length ? hues.join(", ") : t("oNone")),
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
    else if (n === "hMode") state.hMode = el.value;
    else if (n === "strType") state.strType = el.value;
    else if (n === "hook") state.hook = el.value;
    else if (n === "cat") state.cat = el.value;
    else if (n === "rodColor") state.rodColor = el.value;
    else if (n === "handleColor") state.handleColor = el.value;
    else if (n === "lineColor") state.lineColor = el.value;
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

    $("#vtClose").addEventListener("click", function () { setView("close"); });
    $("#vtScale").addEventListener("click", function () { setView("scale"); });

    var panel = $("#panel");
    panel.addEventListener("change", function (e) {
      var el = e.target;
      if (el.hasAttribute("data-pos")) {
        state.items[+el.getAttribute("data-pos")].at = clamp(Math.round(+el.value), 0, state.strLen);
        update(true); return;
      }
      if (el.getAttribute("data-chk")) { checked[el.getAttribute("data-chk")] = el.checked; return; }
      var lk = /^(ic|ip|if)-(\d+)$/.exec(el.name || "");   // colour, pattern or filling of one toy on the line
      if (lk && state.items[+lk[2]]) { state.items[+lk[2]][{ ic: "c", ip: "p", "if": "f" }[lk[1]]] = el.value; update(true); return; }
      if (applyControl(el)) { if (el.name === "cat" || el.id === "personRange") setView("scale"); update(true); }
    });
    panel.addEventListener("input", function (e) {
      var el = e.target;
      if (el.hasAttribute("data-pos")) {
        state.items[+el.getAttribute("data-pos")].at = clamp(Math.round(+el.value), 0, state.strLen);
        update(false); return;
      }
      if (el.type === "range" && applyControl(el)) { if (el.id === "personRange") setView("scale"); update(false); }
    });

    $("#toyGrid").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]");
      if (!b || b.disabled) return;
      var id = b.getAttribute("data-id"), k;
      if (b.getAttribute("data-act") === "inc") {
        if (state.items.length < C.MAX_ATTACH) state.items.push(newItem(id, state.strLen));
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
    $("#sizeFix").addEventListener("click", function () { state.length = sizeRange(state.person).mid; setView("scale"); update(true); });

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
    buildStatic(); buildLists(); bind(); setView(view); update(true); loadPrices();
  }
  init();
})();
