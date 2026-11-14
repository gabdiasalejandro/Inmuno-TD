import { describe, expect, it, vi } from 'vitest';
import { fullscreenActive, fullscreenSupported, toggleFullscreen } from '../../src/game/fullscreen';

interface FakeRoot {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => void;
}

interface FakeDocument {
  documentElement: FakeRoot;
  fullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void;
}

function fake(overrides: Partial<FakeDocument> = {}): Document {
  return {
    documentElement: { requestFullscreen: async () => undefined },
    fullscreenEnabled: true,
    fullscreenElement: null,
    ...overrides,
  } as unknown as Document;
}

describe('fullscreen support detection', () => {
  it('accepts a browser with the standard API', () => {
    expect(fullscreenSupported(fake())).toBe(true);
  });

  it('rejects a browser that reports fullscreen disabled, such as a framed page', () => {
    expect(fullscreenSupported(fake({ fullscreenEnabled: false }))).toBe(false);
  });

  it('rejects a browser with no request method at all', () => {
    expect(fullscreenSupported(fake({ documentElement: {} }))).toBe(false);
  });

  it('accepts the WebKit-prefixed API older Safari exposes', () => {
    const doc = fake({
      documentElement: { webkitRequestFullscreen: () => undefined },
      fullscreenEnabled: undefined,
      webkitFullscreenEnabled: true,
    });
    expect(fullscreenSupported(doc)).toBe(true);
  });

  it('rejects prefixed fullscreen when the browser says it is disabled', () => {
    const doc = fake({
      documentElement: { webkitRequestFullscreen: () => undefined },
      fullscreenEnabled: undefined,
      webkitFullscreenEnabled: false,
    });
    expect(fullscreenSupported(doc)).toBe(false);
  });
});

describe('fullscreen state', () => {
  it('is active with the standard element and inactive when null', () => {
    const element = {} as Element;
    expect(fullscreenActive(fake({ fullscreenElement: element }))).toBe(true);
    expect(fullscreenActive(fake({ fullscreenElement: null }))).toBe(false);
  });

  it('recognises the WebKit-prefixed element', () => {
    const element = {} as Element;
    expect(fullscreenActive(fake({ fullscreenElement: undefined, webkitFullscreenElement: element }))).toBe(true);
  });
});

describe('toggleFullscreen', () => {
  it('requests fullscreen when the page is not in it', async () => {
    const request = vi.fn(async () => undefined);
    const exit = vi.fn(async () => undefined);
    const doc = fake({ documentElement: { requestFullscreen: request }, exitFullscreen: exit });
    await expect(toggleFullscreen(doc)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
  });

  it('leaves fullscreen when the page is already in it', async () => {
    const request = vi.fn(async () => undefined);
    const exit = vi.fn(async () => undefined);
    const doc = fake({ documentElement: { requestFullscreen: request }, fullscreenElement: {} as Element, exitFullscreen: exit });
    await expect(toggleFullscreen(doc)).resolves.toBeUndefined();
    expect(exit).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
  });

  it('swallows a refused request so the scene never crashes', async () => {
    const doc = fake({ documentElement: { requestFullscreen: () => Promise.reject(new Error('denied')) } });
    await expect(toggleFullscreen(doc)).resolves.toBeUndefined();
  });

  it('swallows a synchronous throw', async () => {
    const doc = fake({
      documentElement: {
        requestFullscreen: () => {
          throw new Error('denied');
        },
      },
    });
    await expect(toggleFullscreen(doc)).resolves.toBeUndefined();
  });

  it('does nothing when the browser has no API', async () => {
    const doc = fake({ documentElement: {}, fullscreenElement: {} as Element });
    await expect(toggleFullscreen(doc)).resolves.toBeUndefined();
  });
});
