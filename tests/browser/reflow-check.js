(() => {
  const root = document.documentElement;
  const viewport = root.clientWidth;
  const content = root.scrollWidth;
  const pass = content <= viewport + 1;
  const result = {url: location.pathname, viewport, content, pass};
  if (!pass) throw new Error('Horizontal page overflow: ' + JSON.stringify(result));
  return result;
})()
