import type Phaser from 'phaser';

export type CursorKind = 'pointer' | 'default';

/** The CSS cursor for a point: a hand over anything that reacts to a click, the arrow elsewhere. */
export function cursorFor(clickable: boolean): CursorKind {
  return clickable ? 'pointer' : 'default';
}

/**
 * Keeps the canvas cursor in sync with `clickable`, checked every frame against the active pointer
 * so it also follows layout changes under a still mouse. Touch has no cursor, so it is skipped.
 * The cursor is reset when the scene shuts down so a hand never leaks into the next scene.
 */
export function bindCursor(scene: Phaser.Scene, clickable: (pointer: Phaser.Input.Pointer) => boolean): void {
  const set = (kind: CursorKind): void => {
    scene.game.canvas.style.cursor = kind;
  };
  const onUpdate = (): void => {
    const pointer = scene.input.activePointer;
    set(pointer.wasTouch ? 'default' : cursorFor(clickable(pointer)));
  };
  scene.events.on('update', onUpdate);
  scene.events.once('shutdown', () => {
    scene.events.off('update', onUpdate);
    set('default');
  });
}
