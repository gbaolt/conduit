const CANVAS_ID = /^c[a-z0-9]{24}$/;

export function isCanvasLink(url: URL, appOrigin: string) {
  if (url.origin !== appOrigin) return false;
  if (/^\/canvases\/[^/]+\/?$/.test(url.pathname)) return true;
  if (!/^\/(channels|dms?)\/[^/]+\/?$/.test(url.pathname)) return false;

  const tab = url.searchParams.get('tab');
  return tab === 'canvas' || (tab !== null && CANVAS_ID.test(tab));
}
