import { world, system } from "@minecraft/server";

// === Config ===
const FINAL_POS = { x: 304, y: 80, z: 306 };
const STRUCTURE_POS = { x: 300, y: 60, z: 300 };
const STRUCTURE_NAME = "mystructure:island";
const SAFE_POS = { x: 0, y: 100, z: 0 };
const FALL_Y = 40;
const MAX_RADIUS = 100;

// === State
const enteredEnd = new Set();
const teleportTimers = new Map(); // id → ticks before final teleport
const enforceRadius = new Set();  // id of players currently checked for radius
const tagTransfer = new Set();    // id of players already processed for voided
let structurePlaced = false;

system.runInterval(() => {
  try {
    for (const player of world.getPlayers()) {
      const id = player.id;
      const dim = player.dimension;
      const loc = player.location;

      const hasVoided = player.hasTag("voided");

      // === Apply or remove Resistance 15
      if (hasVoided) {
        player.addEffect("minecraft:resistance", 5 * 20, {
          amplifier: 15,
          showParticles: false,
        });
      } else {
        player.removeEffect("minecraft:resistance");
      }

      // === 1. First-time End entry: wait 2s before teleporting
      if (dim.id === "minecraft:the_end" && !enteredEnd.has(id)) {
        enteredEnd.add(id);
        player.teleport(SAFE_POS, { dimension: dim });

        if (!structurePlaced) {
          structurePlaced = true;
          try {
            dim.runCommand(`structure load ${STRUCTURE_NAME} ${STRUCTURE_POS.x} ${STRUCTURE_POS.y} ${STRUCTURE_POS.z}`);
          } catch (e) {
            console.warn(`Structure load failed: ${e}`);
          }
        }

        teleportTimers.set(id, 40); // 2s delay
        continue;
      }

      // === 2. Wait 2 seconds then teleport to final
      if (teleportTimers.has(id)) {
        const time = teleportTimers.get(id) - 1;
        if (time <= 0) {
          teleportTimers.delete(id);
          player.teleport(FINAL_POS, {
            dimension: dim,
            facingLocation: FINAL_POS,
          });
          enforceRadius.add(id); // start enforcing radius only now
        } else {
          teleportTimers.set(id, time);
        }
      }

      // === 3. Voided tag: force End + final position
      if (hasVoided && !tagTransfer.has(id)) {
        const end = world.getDimension("minecraft:the_end");
        player.teleport(FINAL_POS, {
          dimension: end,
          facingLocation: FINAL_POS,
        });
        tagTransfer.add(id);
        enforceRadius.add(id);
        continue;
      }

      // === 4. Enforce radius and Y-limit
      if (hasVoided && dim.id === "minecraft:the_end" && enforceRadius.has(id)) {
        const dx = loc.x - FINAL_POS.x;
        const dz = loc.z - FINAL_POS.z;
        const distSq = dx * dx + dz * dz;

        if (distSq > MAX_RADIUS * MAX_RADIUS || loc.y <= FALL_Y) {
          player.teleport(FINAL_POS, {
            dimension: dim,
            facingLocation: FINAL_POS,
          });
        }
      }

      // === 5. Reset state if tag removed
      if (!hasVoided) {
        tagTransfer.delete(id);
        enforceRadius.delete(id);
      }
    }
  } catch (err) {
    console.warn(`[Void System Crash] ${err}`);
  }
}, 1);