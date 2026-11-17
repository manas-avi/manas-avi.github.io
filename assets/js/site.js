// Site behaviour: theme toggle, collapsible news list, copy BibTeX.
// Every feature is an enhancement; with JS off the page shows everything.
(function () {
  "use strict";

  // Theme: follow the system until the reader picks one, then remember it.
  var root = document.documentElement;
  var toggle = document.querySelector(".theme-toggle");
  var systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  function current() {
    return root.getAttribute("data-theme") || (systemDark.matches ? "dark" : "light");
  }
  function syncToggle() {
    toggle.setAttribute("aria-label", current() === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
  if (toggle) {
    toggle.hidden = false;
    syncToggle();
    toggle.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* private mode: not remembered */ }
      syncToggle();
    });
    if (systemDark.addEventListener) systemDark.addEventListener("change", syncToggle);
  }

  // News: show the first N entries, with a button for the rest.
  document.querySelectorAll("[data-collapse]").forEach(function (list) {
    var limit = parseInt(list.getAttribute("data-collapse"), 10);
    var items = Array.prototype.slice.call(list.children);
    if (!(limit > 0) || items.length <= limit) return;
    var extra = items.slice(limit);
    var expanded = false;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "more";
    button.setAttribute("aria-controls", list.id);
    function render() {
      extra.forEach(function (li) { li.hidden = !expanded; });
      button.setAttribute("aria-expanded", String(expanded));
      button.textContent = expanded ? "Show fewer" : "Show all " + items.length + " news items";
    }
    button.addEventListener("click", function () {
      expanded = !expanded;
      render();
      if (!expanded) button.scrollIntoView({ block: "nearest" });
    });
    render();
    list.insertAdjacentElement("afterend", button);
  });

  // Copy BibTeX.
  document.querySelectorAll("[data-copy]").forEach(function (button) {
    var source = document.getElementById(button.getAttribute("data-copy"));
    if (!source || !navigator.clipboard) return;
    button.hidden = false;
    button.addEventListener("click", function () {
      navigator.clipboard.writeText(source.textContent).then(function () {
        button.textContent = "Copied";
        setTimeout(function () { button.textContent = "Copy BibTeX"; }, 2000);
      }, function () {
        button.textContent = "Copy failed: select the text instead";
      });
    });
  });
})();
