import { world, system } from "@minecraft/server";

// Track which players have fog applied
const hasFog = new Set();

// Track which players have already triggered the End music
const hasPlayedMusic = new Set();

// Run every 1 second
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const name = player.name;
    const dim = player.dimension.id;

    try {
      if (dim === "minecraft:the_end") {
        // Push fog if not already applied
        if (!hasFog.has(name)) {
          player.runCommand(`fog @s push bt:old_water_fog_dense end`);
          hasFog.add(name);
        }

        // Play sound on first entry into the End
        if (!hasPlayedMusic.has(name)) {
          player.runCommand(`playsound music.game.sou`);
          hasPlayedMusic.add(name);
        }

      } else {
        // Remove fog and reset music trigger when leaving the End
        if (hasFog.has(name)) {
          player.runCommand(`fog @s pop "end"`);
          hasFog.delete(name);
        }

        // Optional: Reset music trigger if you want music to play again on re-entry
        // Comment out the next line if you want it to play only once ever
        hasPlayedMusic.delete(name);
      }

    } catch (e) {
      console.warn(`Fog/music error for ${name}: ${e}`);
    }
  }
}, 20); // Every 1 second