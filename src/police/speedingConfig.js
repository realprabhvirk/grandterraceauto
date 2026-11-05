// Speeding fines (never heat, never a chase). Tweak here.
export const SPEEDING = {
  fine: 200,          // $ per fine
  margin: 10,         // km/h over the limit before it counts
  cooldown: 20,       // s per catcher (camera / traffic cop)
  CAMERAS_FINE: true, // false = speed cameras flash but don't fine
};
