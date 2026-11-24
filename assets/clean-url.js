// Keep legacy entry files usable without leaving index.html in the address bar.
(function () {
  if (/\/index\.html$/.test(window.location.pathname)) {
    window.history.replaceState(window.history.state, '',
      window.location.pathname.replace(/index\.html$/, '') + window.location.search + window.location.hash);
  }
})();
