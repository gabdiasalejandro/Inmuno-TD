import { secondsToTicks } from '../time';
import type { PlaceResult } from '../types';
import type { World } from '../world';

/** The player's one command: deploy a unit from the deck onto a free cell. */
export function createPlacement(world: World): (defId: string, row: number, col: number) => PlaceResult {
  const { level, state } = world;
  const { rows, cols } = level.grid;

  return (defId, row, col) => {
    if (state.status !== 'playing') return { ok: false, reason: 'game_over' };
    if (!level.deck.includes(defId)) return { ok: false, reason: 'not_in_deck' };
    const inGrid = Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < rows && col >= 0 && col < cols;
    if (!inGrid) return { ok: false, reason: 'out_of_bounds' };
    if (world.unitAt(row, col)) return { ok: false, reason: 'cell_occupied' };
    if (state.tick < (state.deployReadyAt[defId] ?? 0)) return { ok: false, reason: 'on_cooldown' };
    const def = world.unitDef(defId);
    if (state.energy < def.cost) return { ok: false, reason: 'insufficient_energy' };

    state.energy -= def.cost;
    const recruitSpeed =
      1 + world.boostFrom((signal) => (def.tags?.includes(signal.recruitTag ?? '') ? signal.recruitBoost : 0));
    state.deployReadyAt[defId] = state.tick + Math.round(secondsToTicks(def.cooldown) / recruitSpeed);
    state.units.push({
      uid: state.nextUid++,
      defId,
      row,
      col,
      hp: def.hp,
      bornAt: state.tick,
      attackReadyAt: 0,
      alarmed: false,
      charge: 0,
      chargedAt: state.tick,
    });
    return { ok: true };
  };
}
