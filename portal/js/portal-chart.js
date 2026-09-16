/* =========================================================
   portal-chart.js
   ---------------------------------------------------------
   The share price, drawn.

   A board sets an internal share price on a date, and that
   price stands until the next one. So the line is a step, not
   a slope: drawing a diagonal between two valuations would
   show prices nobody ever set. Each valuation is a marked
   point; the last one runs on to today.

   The chart shows one measure at a time: the share price, or
   what the reader's own holding was worth. They are different
   units of different size, and putting both on one plot needs
   two scales, which invents a relationship between them. A
   toggle above the chart swaps one for the other instead.

   Mark specs follow the data visualisation method this
   project uses: a 2px line, a ~10% wash under it, 8px markers
   with a 2px ring in the surface colour, hairline recessive
   grid, and text in text colours rather than the series
   colour. The series colour is HaveStack's own hue at chart
   strength, validated against the panel surface.

   Every value the tooltip shows is also in the table view, so
   hovering is never the only way to read one. The chart is
   focusable: arrow keys move between points and the tooltip
   follows, the same as the pointer.
   ========================================================= */
window.PortalChart = (function () {
  "use strict";

  var SVG = "http://www.w3.org/2000/svg";
  var DAY = 86400000;
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- time ----------
     Dates arrive as YYYY-MM-DD. They are placed at noon UTC so that no time
     zone or daylight change can move a valuation onto the neighbouring day. */
  function toTime(d) {
    if (d == null || d === "") return NaN;
    var s = String(d).slice(0, 10).split("-");
    return Date.UTC(+s[0], +s[1] - 1, +s[2], 12);
  }
  function todayTime() {
    var n = new Date();
    return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), 12);
  }
  function dateLabel(t, style) {
    var o = style === "month" ? { month: "short", year: "numeric" }
          : style === "year"  ? { year: "numeric" }
          : { day: "numeric", month: "short", year: "numeric" };
    o.timeZone = "UTC";
    return new Date(t).toLocaleDateString("en-GB", o);
  }

  /* ---------- numbers ---------- */
  function fixed(v, dp) {
    return Number(v).toLocaleString("en-US",
      { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function compact(v) {
    var a = Math.abs(v);
    function trim(x) { return Number(x.toFixed(x >= 100 ? 0 : 1)).toLocaleString("en-US"); }
    if (a >= 1e9) return trim(v / 1e9) + "B";
    if (a >= 1e6) return trim(v / 1e6) + "M";
    if (a >= 1e4) return trim(v / 1e3) + "K";
    return Math.round(v).toLocaleString("en-US");
  }
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  // Ticks from zero, in clean steps. Zero is the baseline because the wash
  // under the line is an area, and an area read against a floor other than
  // zero exaggerates every change.
  function yTicks(max, count) {
    if (!(max > 0)) max = 1;
    var step = niceStep(max / count);
    var top = Math.ceil(max / step) * step;
    var out = [];
    for (var v = 0; v <= top + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  // Calendar boundaries, spaced so there are never more than maxCount.
  function xTicks(t0, t1, maxCount) {
    var steps = [1, 2, 3, 6, 12, 24, 60];
    var spanMonths = (t1 - t0) / (30.44 * DAY);
    var every = steps[steps.length - 1];
    for (var i = 0; i < steps.length; i++) {
      if (spanMonths / steps[i] <= maxCount) { every = steps[i]; break; }
    }
    var d = new Date(t0);
    var index = d.getUTCFullYear() * 12 + d.getUTCMonth() + (d.getUTCDate() > 1 ? 1 : 0);
    var k = Math.ceil(index / every) * every;
    var out = [];
    for (;;) {
      var t = Date.UTC(Math.floor(k / 12), k % 12, 1, 12);
      if (t > t1) break;
      if (t >= t0) out.push(t);
      k += every;
    }
    return { ticks: out, style: every >= 12 ? "year" : "month" };
  }

  /* ---------- the two measures ---------- */
  function priceSeries(valuations) {
    return (valuations || [])
      .filter(function (v) { return v && v.published !== false && Number(v.price_per_share) > 0; })
      .map(function (v) {
        return { t: toTime(v.effective_on), v: Number(v.price_per_share), row: v, kind: "valuation" };
      })
      .filter(function (p) { return !isNaN(p.t); })
      .sort(function (a, b) { return a.t - b.t; });
  }

  function priceAt(series, t) {
    var hit = null;
    for (var i = 0; i < series.length; i++) {
      if (series[i].t <= t) hit = series[i]; else break;
    }
    return hit;
  }

  // What the reader's shares were worth: it changes when the price changes and
  // when their holding does, so both kinds of date are points on this line.
  function valueSeries(valuations, ledger) {
    var prices = priceSeries(valuations);
    var moves = (ledger || [])
      .filter(function (m) { return m && m.status === "settled" && Number(m.shares); })
      .map(function (m) { return { t: toTime(m.occurred_on), shares: Number(m.shares) }; })
      .filter(function (m) { return !isNaN(m.t); })
      .sort(function (a, b) { return a.t - b.t; });

    var priceTimes = {};
    prices.forEach(function (p) { priceTimes[p.t] = true; });
    var times = prices.map(function (p) { return p.t; })
      .concat(moves.map(function (m) { return m.t; }))
      .sort(function (a, b) { return a - b; })
      .filter(function (t, i, all) { return i === 0 || t !== all[i - 1]; });

    var out = [];
    times.forEach(function (t) {
      var px = priceAt(prices, t);
      if (!px) return;
      var held = 0;
      moves.forEach(function (m) { if (m.t <= t) held += m.shares; });
      out.push({
        t: t, v: held * px.v, shares: held, price: px.v, row: px.row,
        kind: priceTimes[t] ? "valuation" : "holding"
      });
    });
    return out;
  }

  /* ---------- drawing ---------- */
  function node(name, attrs, parent) {
    var el = document.createElementNS(SVG, name);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(el);
    return el;
  }

  function mount(host, options) {
    var state = {
      valuations: [], ledger: [], measure: "price", range: "all",
      currency: "BDT", drawnOnce: false, active: -1, pts: [], table: false
    };
    Object.keys(options || {}).forEach(function (k) { state[k] = options[k]; });

    host.classList.add("viz");
    host.textContent = "";
    var plot = document.createElement("div");
    plot.className = "viz-plot";
    var tip = document.createElement("div");
    tip.className = "viz-tip";
    tip.hidden = true;
    tip.setAttribute("role", "status");
    tip.setAttribute("aria-live", "polite");
    var table = document.createElement("div");
    table.className = "viz-table table-wrap";
    table.hidden = true;
    host.appendChild(plot);
    host.appendChild(tip);
    host.appendChild(table);

    var geometry = null;   // x(), y(), margins, for the pointer handlers
    var lastWidth = 0;
    var frame = 0;

    function series() {
      return state.measure === "value"
        ? valueSeries(state.valuations, state.ledger)
        : priceSeries(state.valuations);
    }

    /* The points inside the chosen range. When the range starts part way
       through a price, that price is carried to the start so the line does
       not begin in mid air. */
    function windowed(all, end) {
      if (!all.length) return [];
      if (state.range === "all") return all.filter(function (p) { return p.t <= end; });
      var years = state.range === "1y" ? 1 : 3;
      var start = end - Math.round(years * 365.25) * DAY;
      var inside = all.filter(function (p) { return p.t >= start && p.t <= end; });
      var before = all.filter(function (p) { return p.t < start; }).pop();
      if (before) {
        var carried = {};
        Object.keys(before).forEach(function (k) { carried[k] = before[k]; });
        carried.t = start;
        carried.carried = true;
        inside.unshift(carried);
      }
      return inside;
    }

    function valueText(v, short) {
      if (state.measure === "price") return (short ? "" : state.currency + " ") + fixed(v, 2);
      return short ? compact(v) : state.currency + " " + fixed(v, 0);
    }
    function measureName() {
      return state.measure === "price" ? "Share price" : "Your holding value";
    }

    function draw() {
      var W = Math.max(260, Math.floor(host.clientWidth || 0));
      lastWidth = W;
      var narrow = W < 560;
      var H = narrow ? 244 : 304;
      var M = { top: 16, right: narrow ? 16 : 80, bottom: 32, left: narrow ? 42 : 56 };
      var iw = W - M.left - M.right;
      var ih = H - M.top - M.bottom;

      var end = todayTime();
      var pts = windowed(series(), end);
      state.pts = pts;
      state.active = -1;
      tip.hidden = true;
      plot.textContent = "";

      if (!pts.length) {
        var none = document.createElement("div");
        none.className = "viz-empty";
        none.textContent = state.measure === "value"
          ? "Nothing to chart yet. Your holding value appears here once you hold shares and a price has been set."
          : "No share price has been published yet.";
        plot.appendChild(none);
        renderTable();
        return;
      }

      var t0 = pts[0].t;
      var t1 = Math.max(end, pts[pts.length - 1].t);
      if (t1 - t0 < 30 * DAY) t0 = t1 - 30 * DAY;

      var max = 0;
      pts.forEach(function (p) { if (p.v > max) max = p.v; });
      var ticks = yTicks(max * 1.06, narrow ? 3 : 4);
      var ymax = ticks[ticks.length - 1] || 1;

      function x(t) { return M.left + (t - t0) / (t1 - t0) * iw; }
      function y(v) { return M.top + ih - (v / ymax) * ih; }
      geometry = { x: x, y: y, M: M, iw: iw, ih: ih, W: W, H: H, t1: t1 };

      var last = pts[pts.length - 1];
      var firstReal = pts[0];
      var svg = node("svg", {
        width: W, height: H, viewBox: "0 0 " + W + " " + H,
        class: "viz-svg", tabindex: "0", role: "img",
        "aria-label": measureName() + ", " + valueText(last.v) + " as of " + dateLabel(last.t) +
          (pts.length > 1 ? ", from " + valueText(firstReal.v) + " on " + dateLabel(firstReal.t) : "") +
          ". Use the arrow keys to move between points, or open the table view."
      });

      // grid and value axis
      ticks.forEach(function (v) {
        node("line", {
          x1: M.left, x2: M.left + iw, y1: Math.round(y(v)) + 0.5, y2: Math.round(y(v)) + 0.5,
          class: v === 0 ? "viz-base" : "viz-grid"
        }, svg);
        var label = node("text", { x: M.left - 10, y: y(v) + 4, "text-anchor": "end", class: "viz-tick" }, svg);
        label.textContent = state.measure === "price" ? fixed(v, v < 10 && v % 1 ? 1 : 0) : compact(v);
      });

      // time axis
      var xt = xTicks(t0, t1, narrow ? 3 : 6);
      xt.ticks.forEach(function (t) {
        var label = node("text", { x: x(t), y: M.top + ih + 21, "text-anchor": "middle", class: "viz-tick" }, svg);
        label.textContent = dateLabel(t, xt.style);
      });

      // the data, revealed left to right the first time only
      var data = node("g", { class: "viz-data" }, svg);
      var d = "M" + x(pts[0].t).toFixed(2) + "," + y(pts[0].v).toFixed(2);
      for (var i = 1; i < pts.length; i++) {
        d += "H" + x(pts[i].t).toFixed(2) + "V" + y(pts[i].v).toFixed(2);
      }
      d += "H" + x(t1).toFixed(2);
      node("path", {
        d: d + "V" + y(0).toFixed(2) + "H" + x(pts[0].t).toFixed(2) + "Z",
        class: "viz-area"
      }, data);
      node("path", { d: d, class: "viz-line" }, data);

      pts.forEach(function (p, i) {
        if (p.carried) return;
        node("circle", {
          cx: x(p.t), cy: y(p.v), r: i === pts.length - 1 ? 5 : 4,
          class: "viz-dot" + (p.kind === "holding" ? " viz-dot-hold" : "")
        }, data);
      });

      // the one label on the chart: where it ends, which is the number the
      // reader came for. Everything else is on the axis, in the tooltip, or in
      // the table.
      if (!narrow) {
        var endY = Math.max(M.top + 8, Math.min(M.top + ih - 14, y(last.v)));
        var endLabel = node("text", { x: x(t1) + 12, y: endY + 4, class: "viz-end" }, svg);
        endLabel.textContent = valueText(last.v, true);
        var endSub = node("text", { x: x(t1) + 12, y: endY + 19, class: "viz-end-sub" }, svg);
        endSub.textContent = "today";
      }

      // hover layer
      var cross = node("line", { class: "viz-cross", y1: M.top, y2: M.top + ih, visibility: "hidden" }, svg);
      var ring = node("circle", { class: "viz-ring", r: 7, visibility: "hidden" }, svg);
      var hit = node("rect", { x: M.left, y: M.top, width: iw, height: ih, class: "viz-hit" }, svg);
      geometry.cross = cross;
      geometry.ring = ring;

      hit.addEventListener("pointermove", function (e) {
        var box = svg.getBoundingClientRect();
        var px = (e.clientX - box.left) * (W / box.width);
        var best = 0, bestGap = Infinity;
        pts.forEach(function (p, i) {
          var gap = Math.abs(x(p.t) - px);
          if (gap < bestGap) { bestGap = gap; best = i; }
        });
        activate(best);
      });
      hit.addEventListener("pointerleave", function () { activate(-1); });

      svg.addEventListener("keydown", function (e) {
        var n = pts.length, i = state.active;
        if (e.key === "ArrowRight") i = i < 0 ? 0 : Math.min(n - 1, i + 1);
        else if (e.key === "ArrowLeft") i = i < 0 ? n - 1 : Math.max(0, i - 1);
        else if (e.key === "Home") i = 0;
        else if (e.key === "End") i = n - 1;
        else if (e.key === "Escape") i = -1;
        else return;
        e.preventDefault();
        activate(i);
      });
      svg.addEventListener("focus", function () { if (state.active < 0) activate(pts.length - 1); });
      svg.addEventListener("blur", function () { activate(-1); });

      plot.appendChild(svg);

      if (!state.drawnOnce) {
        state.drawnOnce = true;
        if (!(REDUCED && REDUCED.matches)) {
          data.classList.add("viz-reveal");
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { data.classList.add("viz-revealed"); });
          });
        }
      }
      renderTable();
    }

    function activate(i) {
      state.active = i;
      var g = geometry;
      if (!g || i < 0 || !state.pts[i]) {
        tip.hidden = true;
        if (g && g.cross) { g.cross.setAttribute("visibility", "hidden"); g.ring.setAttribute("visibility", "hidden"); }
        return;
      }
      var p = state.pts[i];
      var px = g.x(p.t), py = g.y(p.v);
      g.cross.setAttribute("x1", Math.round(px) + 0.5);
      g.cross.setAttribute("x2", Math.round(px) + 0.5);
      g.cross.setAttribute("visibility", "visible");
      g.ring.setAttribute("cx", px);
      g.ring.setAttribute("cy", py);
      g.ring.setAttribute("visibility", "visible");

      // built from text nodes: a valuation method is typed by a person
      tip.textContent = "";
      var value = document.createElement("b");
      value.textContent = valueText(p.v);
      tip.appendChild(value);

      var name = document.createElement("div");
      name.className = "viz-tip-name";
      var key = document.createElement("span");
      key.className = "viz-key";
      key.setAttribute("aria-hidden", "true");
      name.appendChild(key);
      name.appendChild(document.createTextNode(measureName()));
      tip.appendChild(name);

      var when = document.createElement("div");
      when.className = "viz-tip-row";
      when.textContent = p.carried
        ? "In effect on " + dateLabel(p.t)
        : (p.kind === "holding" ? "Holding changed " : "Set ") + dateLabel(p.t);
      tip.appendChild(when);

      var detail = document.createElement("div");
      detail.className = "viz-tip-row";
      detail.textContent = state.measure === "price"
        ? ((p.row && p.row.method) || "Valuation")
        : fixed(p.shares, 0) + " shares at " + state.currency + " " + fixed(p.price, 2);
      tip.appendChild(detail);

      var prev = state.pts[i - 1];
      if (prev && prev.v > 0 && !p.carried) {
        var move = (p.v - prev.v) / prev.v * 100;
        var change = document.createElement("div");
        change.className = "viz-tip-row viz-tip-change " +
          (move > 0.05 ? "delta-up" : move < -0.05 ? "delta-down" : "delta-flat");
        change.textContent = (move > 0.05 ? "+" : move < -0.05 ? "−" : "") +
          Math.abs(move).toFixed(1) + "% on the previous point";
        tip.appendChild(change);
      }

      tip.hidden = false;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var scale = (host.clientWidth || g.W) / g.W;
      var left = px * scale + 16;
      if (left + tw > host.clientWidth - 4) left = px * scale - tw - 16;
      var top = Math.max(0, Math.min(g.H * scale - th, py * scale - th / 2));
      tip.style.left = Math.max(0, left) + "px";
      tip.style.top = top + "px";
    }

    function renderTable() {
      table.textContent = "";
      var rows = state.pts.filter(function (p) { return !p.carried; }).slice().reverse();
      if (!rows.length) return;
      var t = document.createElement("table");
      t.className = "table";
      var head = document.createElement("thead");
      var hr = document.createElement("tr");
      ["Date", state.measure === "price" ? "Share price" : "Holding value",
       "Change", state.measure === "price" ? "How it was set" : "Shares at price"]
        .forEach(function (h, i) {
          var th = document.createElement("th");
          th.textContent = h;
          if (i === 1 || i === 2) th.className = "money";
          hr.appendChild(th);
        });
      head.appendChild(hr);
      t.appendChild(head);
      var body = document.createElement("tbody");
      rows.forEach(function (p) {
        var ordered = state.pts.filter(function (q) { return !q.carried; });
        var idx = ordered.indexOf(p);
        var prev = ordered[idx - 1];
        var tr = document.createElement("tr");
        var cells = [
          dateLabel(p.t),
          valueText(p.v),
          prev && prev.v > 0
            ? ((p.v >= prev.v ? "+" : "−") + Math.abs((p.v - prev.v) / prev.v * 100).toFixed(1) + "%")
            : "·",
          state.measure === "price"
            ? ((p.row && p.row.method) || "·")
            : fixed(p.shares, 0) + " at " + state.currency + " " + fixed(p.price, 2)
        ];
        cells.forEach(function (c, i) {
          var td = document.createElement("td");
          td.textContent = c;
          if (i === 0) td.className = "num";
          if (i === 1 || i === 2) td.className = "money";
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      t.appendChild(body);
      table.appendChild(t);
    }

    function schedule() {
      if (Math.floor(host.clientWidth || 0) === lastWidth) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    }
    var observer = window.ResizeObserver ? new ResizeObserver(schedule) : null;
    if (observer) observer.observe(host);
    else window.addEventListener("resize", schedule);

    draw();

    return {
      update: function (patch) {
        Object.keys(patch || {}).forEach(function (k) { state[k] = patch[k]; });
        draw();
      },
      showTable: function (on) {
        state.table = !!on;
        table.hidden = !on;
        plot.hidden = !!on;
        tip.hidden = true;
      },
      summary: function () {
        var real = state.pts.filter(function (p) { return !p.carried; });
        var first = state.pts[0], last = state.pts[state.pts.length - 1];
        return {
          count: real.filter(function (p) { return p.kind === "valuation"; }).length,
          first: first || null,
          last: last || null,
          change: first && last && first.v > 0 ? (last.v - first.v) / first.v * 100 : null
        };
      },
      destroy: function () {
        if (observer) observer.disconnect();
        else window.removeEventListener("resize", schedule);
        host.textContent = "";
      }
    };
  }

  return {
    mount: mount,
    priceSeries: priceSeries,
    valueSeries: valueSeries,
    yTicks: yTicks,
    xTicks: xTicks,
    toTime: toTime
  };
})();
