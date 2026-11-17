import { TICKS_PER_SECOND, secondsToTicks } from '../time';
import type { ChargeDef, SignalDef, SignalSource } from '../types';
import { MILLI, type System, type World } from '../world';

/** A source resolved against the current state: what it feeds and how much it holds. */
interface LiveSource {
  signal: string;
  def: ChargeDef;
  /** Stored charge, in thousandths of a point. */
  charge: number;
  setCharge(milli: number): void;
}

/** A source loses stored charge only after this long without gaining any. */
const IDLE_TICKS = secondsToTicks(1);

const perTick = (perSecond: number): number => Math.round((perSecond * MILLI) / TICKS_PER_SECOND);
const capacityOf = (def: ChargeDef): number => def.capacity * MILLI;

/**
 * Signal sources store charge that the player pours into the meters by holding the release.
 * Units with `emits` charge while they detect a matching enemy and/or when they take damage;
 * open wounds charge while an active signal declares `fromWounds`. While the player holds the
 * release, each signal drains its pooled charge into its meter at a steady rate, taking from
 * every source in proportion to what it holds. Idle sources and the meters decay slowly.
 */
export function createSources(world: World): {
  charge: System;
  release: System;
  chargeFromDamage: System;
  setReleasing(on: boolean): void;
  chargeOf(source: SignalSource): number | null;
  stored(name: string): number;
} {
  const { state, signalDefs } = world;
  const active = new Map(signalDefs);
  // Wounds feed the first active signal that declares them, so a level without it keeps wounds inert.
  const woundFeed = signalDefs.find(([, def]) => def.fromWounds);
  // A level without wounds has every lane open from the start, but none of them is a wound.
  const woundLanes = new Set((world.level.wounds ?? []).map((wound) => wound.lane));
  const isOpenWound = (lane: number): boolean => woundLanes.has(lane) && state.openLanes.includes(lane);

  const emitsOf = (defId: string) => {
    const emits = world.unitDef(defId).emits;
    return emits && active.has(emits.signal) ? emits : undefined;
  };

  const resolve = (source: SignalSource): LiveSource | undefined => {
    if (source.kind === 'unit') {
      const unit = state.units.find((u) => u.uid === source.uid);
      const emits = unit && emitsOf(unit.defId);
      if (!unit || !emits) return undefined;
      return { signal: emits.signal, def: emits, charge: unit.charge, setCharge: (milli) => (unit.charge = milli) };
    }
    if (!woundFeed || !isOpenWound(source.lane)) return undefined;
    const [signal, { fromWounds }] = woundFeed;
    return {
      signal,
      def: fromWounds!,
      charge: state.woundCharge[source.lane] ?? 0,
      setCharge: (milli) => (state.woundCharge[source.lane] = milli),
    };
  };

  /** Every live source of a signal, units first (in deploy order), then wounds (in opening order). */
  const sourcesOf = (signal: string): LiveSource[] =>
    [
      ...state.units.map((unit): SignalSource => ({ kind: 'unit', uid: unit.uid })),
      ...state.openLanes.map((lane): SignalSource => ({ kind: 'wound', lane })),
    ]
      .map(resolve)
      .filter((live): live is LiveSource => live !== undefined && live.signal === signal);

  const pool = (sources: LiveSource[]): number => sources.reduce((sum, s) => sum + s.charge, 0);

  /** Takes `amount` from the sources in proportion to their charge; exact, so the pool drops by `amount`. */
  const drain = (sources: LiveSource[], amount: number): void => {
    let remainingAmount = amount;
    let remainingPool = pool(sources);
    for (const source of sources) {
      if (remainingPool <= 0) break;
      const take = Math.round((remainingAmount * source.charge) / remainingPool);
      remainingPool -= source.charge;
      remainingAmount -= take;
      source.setCharge(source.charge - take);
    }
  };

  const releaseInto = (name: string, def: SignalDef): number => {
    const sources = sourcesOf(name);
    const room = def.max * MILLI - (state.signals[name] ?? 0);
    const amount = Math.max(0, Math.min(perTick(def.releasePerSecond ?? 0), pool(sources), room));
    if (amount === 0) return 0;
    drain(sources, amount);
    state.signals[name] = (state.signals[name] ?? 0) + amount;
    state.released[name] = (state.released[name] ?? 0) + amount;
    return amount;
  };

  return {
    charge() {
      for (const unit of state.units) {
        const emits = emitsOf(unit.defId);
        unit.alarmed = !!emits && emits.range !== undefined && world.findTarget(unit, emits.range, emits.requires) !== undefined;
        if (!emits) continue;
        if (unit.alarmed && emits.perSecond) {
          unit.charge = Math.min(capacityOf(emits), unit.charge + perTick(emits.perSecond));
          unit.chargedAt = state.tick;
        } else if (state.tick - unit.chargedAt > IDLE_TICKS) {
          unit.charge = Math.max(0, unit.charge - perTick(active.get(emits.signal)!.storeDecayPerSecond ?? 0));
        }
      }
      if (!woundFeed) return;
      // Open wounds never stop generating, so they never go idle.
      const wounds = woundFeed[1].fromWounds!;
      for (const lane of state.openLanes.filter(isOpenWound)) {
        state.woundCharge[lane] = Math.min(capacityOf(wounds), (state.woundCharge[lane] ?? 0) + perTick(wounds.perSecond ?? 0));
      }
    },

    release(events) {
      if (!state.releasing) return;
      for (const [name, def] of signalDefs) {
        const amount = releaseInto(name, def);
        if (amount > 0) events.push({ type: 'signal_released', signal: name, amount: amount / MILLI });
      }
    },

    /** Runs after the enemies attack: units that take damage and store charge from it gain it now. */
    chargeFromDamage(events) {
      for (const event of events) {
        if (event.type !== 'enemy_attacked') continue;
        const unit = state.units.find((u) => u.uid === event.target);
        const emits = unit && emitsOf(unit.defId);
        if (!unit || !emits?.perDamage) continue;
        unit.charge = Math.min(capacityOf(emits), unit.charge + Math.round(event.damage * emits.perDamage * MILLI));
        unit.chargedAt = state.tick;
      }
    },

    setReleasing(on) {
      state.releasing = on;
    },

    chargeOf(source) {
      const live = resolve(source);
      return live ? live.charge / capacityOf(live.def) : null;
    },

    stored(name) {
      return active.has(name) ? pool(sourcesOf(name)) / MILLI : 0;
    },
  };
}
