// Speeding (Phase 6.1): a traffic cop who spots you speeding starts a PULL-OVER pursuit (no stars,
// no arrest); stop beside them and you get a fine. All numbers here.
export const SPEEDING = {
  fine: 200,             // $ per fine
  margin: 10,            // km/h over the limit before it counts
  cooldown: 20,          // s per catcher after a fine or a lost pursuit
  CAMERAS_ENABLED: false, // fixed speed cameras (+ their signs / map icons). Off: no automatic fines at all
  CAMERAS_FINE: true,     // (only when cameras are enabled) cameras fine directly
  EVADE_STARS: 0,         // stars for losing a pull-over pursuit (0 = none)
};
export const PULLOVER = {
  follow: 9,          // m behind the player while driving
  followStopped: 6.5, // m behind once the player has stopped
  tailCap: 0.95,      // never faster than this x the player's speed (you CAN outrun them)
  catchUp: 19,        // m/s the cop may do while the player is slow (< slowBelow)
  slowBelow: 9,       // m/s
  maxV: 55,           // m/s absolute cap
  stopSpeed: 2,       // m/s: the player counts as stopped below this
  stopDist: 8,        // m: cop car this close...
  stopHold: 1,        // s: ...for this long -> officer gets out
  issueTime: 3,       // s "Issuing fine..." (officer at the window)
  driveOff: 4,        // m/s: player above this during issuing = drove off, pursuit resumes
  loseLOS: 8,         // s without line of sight -> lost
  loseDist: 150,      // m -> lost
  maxTime: 90,        // s -> gives up, no fine
  leaveTime: 8,       // s the cop drives off before resetting to its post / patrol
};
