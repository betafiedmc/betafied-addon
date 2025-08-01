import { world, system } from "@minecraft/server";

const bedInteractions = new Map();

function isNight() {
  const time = world.getTimeOfDay();
  return time >= 13000 && time <= 23000;
}

function isNearBed(player, bedLoc) {
  const pos = player.location;
  return (
    Math.abs(pos.x - bedLoc.x) <= 1 &&
    Math.abs(pos.y - bedLoc.y) <= 1 &&
    Math.abs(pos.z - bedLoc.z) <= 1
  );
}

function hasTorchNearby(block) {
  const { x: bx, y: by, z: bz } = block.location;
  const dim = block.dimension;

  const maxRadius = 13;
  const yMin = by - 3;
  const yMax = by + 7;

  for (let dx = -maxRadius; dx <= maxRadius; dx++) {
    for (let dz = -maxRadius; dz <= maxRadius; dz++) {
      const manhattan = Math.abs(dx) + Math.abs(dz);
      if (manhattan > maxRadius) continue;

      for (let dy = yMin; dy <= yMax; dy++) {
        const pos = { x: bx + dx, y: dy, z: bz + dz };
        try {
          const nearbyBlock = dim.getBlock(pos);
          if (!nearbyBlock) continue;

          const id = nearbyBlock.typeId;
          if (
            id.includes("torch") ||
            id.includes("lantern") ||
            id.includes("glowstone") ||
            id.includes("sea_lantern") ||
            id.includes("redstone_lamp") ||
            id.includes("shroomlight")
          ) {
            return true;
          }
        } catch {}
      }
    }
  }

  return false;
}

function getOffsetSpawnPos(bedBlock) {
  const facing = Number(bedBlock.permutation.getState("minecraft:facing_direction"));
  const [left, right] = {
    0: [ [-1, 0], [1, 0] ],
    1: [ [0, 1], [0, -1] ],
    2: [ [1, 0], [-1, 0] ],
    3: [ [0, -1], [0, 1] ]
  }[facing] || [[0, 0], [0, 0]];

  const offset = Math.random() < 0.5 ? left : right;
  const base = bedBlock.location;

  return {
    x: base.x + offset[0],
    y: base.y,
    z: base.z + offset[1]
  };
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { player, block } = event;
  if (!block || !block.typeId.includes("bed")) return;

  const bedKey = `${block.location.x},${block.location.y},${block.location.z}`;
  const current = bedInteractions.get(bedKey);

  if (!current) {
    bedInteractions.set(bedKey, { count: 1, player });

    system.runTimeout(() => {
      const record = bedInteractions.get(bedKey);
      if (!record) return;

      const { count, player: lastPlayer } = record;
      const bedLoc = block.location;

      if (
        count === 1 &&
        isNight() &&
        isNearBed(lastPlayer, bedLoc) &&
        !hasTorchNearby(block)
      ) {
        system.runTimeout(() => {
          try {
            lastPlayer.applyDamage(1); // wake-up damage
            const mob = Math.random() < 0.5 ? "minecraft:zombie" : "minecraft:skeleton";
            const spawnLoc = getOffsetSpawnPos(block);
            block.dimension.spawnEntity(mob, spawnLoc);
          } catch {}
        }, 1);
      }

      bedInteractions.delete(bedKey);
    }, 20);
  } else {
    current.count += 1;
  }
});