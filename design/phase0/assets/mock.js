// Phase 0 mock helper. The design direction comes from the link's #a / #b / #c (or ?d=a|b|c),
// default a, and every link between mock pages carries it along. Switching only changes the
// hash, so the page re-themes in place. After load it draws the lucide icons and typesets the
// $…$ / $$…$$ math. ?shot=1 hides the floating switcher for screenshots.
(function () {
  var root = document.documentElement;
  var query = new URLSearchParams(location.search);
  if (query.get("shot")) root.classList.add("shot");

  function pick() {
    var h = location.hash.slice(1);
    if (/^[abc]$/.test(h)) return h;
    return /^[abc]$/.test(query.get("d") || "") ? query.get("d") : "a";
  }
  var dir = pick();
  root.setAttribute("data-dir", dir);

  function relink() {
    var page = location.pathname.split("/").pop();
    document.querySelectorAll("a[href]").forEach(function (a) {
      var href = a.getAttribute("href");
      if (/^[a-z-]+\.html(#[abc])?$/.test(href)) a.setAttribute("href", href.split("#")[0] + "#" + dir);
    });
    document.querySelectorAll("[data-page]").forEach(function (a) {
      a.setAttribute("href", a.getAttribute("data-page") + "#" + dir);
      a.classList.toggle("on", a.getAttribute("data-page") === page);
    });
    document.querySelectorAll("[data-set-dir]").forEach(function (a) {
      a.setAttribute("href", "#" + a.getAttribute("data-set-dir"));
      a.classList.toggle("on", a.getAttribute("data-set-dir") === dir);
    });
  }

  window.addEventListener("hashchange", function () {
    dir = pick();
    root.setAttribute("data-dir", dir);
    relink();
  });

  document.addEventListener("DOMContentLoaded", function () {
    relink();
    if (window.lucide) window.lucide.createIcons();
    if (window.renderMathInElement) {
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    }
    // a scrolled tab bar should show its selected tab, as the real app will
    document.fonts.ready.then(function () {
      document.querySelectorAll(".tabs").forEach(function (t) {
        var on = t.querySelector(".on");
        if (on && t.scrollWidth > t.clientWidth) t.scrollLeft = on.offsetLeft - t.offsetLeft - 16;
      });
    });
    root.classList.add("ready");
  });
})();
