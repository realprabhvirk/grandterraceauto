// Wanted-level timing (stars: SOLID -> FLASHING -> cleared). Tweak here.
export const WANTED_CFG = {
  thresholds: [20, 60, 120, 200, 300], // heat for 1..5 stars
  grace: 15,        // s - stars stay solid after any new witnessed crime (police get dispatched meanwhile)
  hidden: 6,        // s - no cop line of sight for this long ...
  nearMin: 80,      // m - ... AND the nearest cop at least this far -> flashing may start
  farAny: 150,      // m - nearest cop this far -> flashing may start even with line of sight
  flash: 10,        // s - flashing this long without interruption -> wanted cleared
  flashHz: 2,       // HUD blink rate while flashing
};
