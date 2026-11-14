/**
 * Browser fullscreen with the WebKit-prefixed API older Safari still uses.
 *
 * Every helper takes an optional document so it can be tested without a DOM. A refused request
 * (an iframe without `allowfullscreen`, a phone browser without the API) resolves silently:
 * the UI reads the real state from `fullscreenchange`, so it never shows a state the browser
 * did not actually grant.
 */

interface VendorDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void | Promise<void>;
}

interface VendorElement extends HTMLElement {
  webkitRequestFullscreen?: () => void | Promise<void>;
}

function rootOf(doc: Document): VendorElement {
  return doc.documentElement as VendorElement;
}

/** True when this browser can put the page in real fullscreen. */
export function fullscreenSupported(doc: Document = document): boolean {
  const vendor = doc as VendorDocument;
  const enabled = doc.fullscreenEnabled ?? vendor.webkitFullscreenEnabled;
  const request = rootOf(doc).requestFullscreen ?? rootOf(doc).webkitRequestFullscreen;
  return enabled !== false && typeof request === 'function';
}

export function fullscreenActive(doc: Document = document): boolean {
  const vendor = doc as VendorDocument;
  const element = doc.fullscreenElement ?? vendor.webkitFullscreenElement;
  return element != null;
}

/** Enters or leaves fullscreen; resolves either way so callers never need a try/catch. */
export function toggleFullscreen(doc: Document = document): Promise<void> {
  return fullscreenActive(doc) ? leave(doc) : enter(doc);
}

function enter(doc: Document): Promise<void> {
  const element = rootOf(doc);
  const request = element.requestFullscreen ?? element.webkitRequestFullscreen;
  if (typeof request !== 'function') return Promise.resolve();
  try {
    return Promise.resolve(request.call(element)).then(
      () => lockLandscape(),
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}

function leave(doc: Document): Promise<void> {
  const vendor = doc as VendorDocument;
  const exit = doc.exitFullscreen ?? vendor.webkitExitFullscreen;
  if (typeof exit !== 'function') return Promise.resolve();
  try {
    return Promise.resolve(exit.call(doc)).then(
      () => unlockOrientation(),
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}

/**
 * The game is landscape, so fullscreen asks the phone to stay that way. Android Chrome honours
 * this while in fullscreen; everywhere else the promise rejects or the API is missing, and the
 * game simply follows the user's rotation.
 */
function lockLandscape(): void {
  if (typeof screen === 'undefined') return;
  const orientation = screen.orientation;
  if (!orientation || typeof orientation.lock !== 'function') return;
  try {
    void orientation.lock('landscape').catch(() => undefined);
  } catch {
    // Unsupported or refused: keep the current orientation.
  }
}

function unlockOrientation(): void {
  if (typeof screen === 'undefined') return;
  const orientation = screen.orientation;
  if (!orientation || typeof orientation.unlock !== 'function') return;
  try {
    orientation.unlock();
  } catch {
    // Nothing to restore.
  }
}
