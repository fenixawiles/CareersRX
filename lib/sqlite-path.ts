import "server-only";

import path from "node:path";

const SQLITE_FILE_NAME = "careersrx-live-resume-sandbox.sqlite";
let warnedAboutVolatileStorage = false;

function absolutePath(inputPath: string) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(/* turbopackIgnore: true */ process.cwd(), inputPath);
}

export function careersRxSqlitePath() {
  const explicitPath = process.env.CAREERSRX_SQLITE_PATH?.trim();
  if (explicitPath) return absolutePath(explicitPath);

  const explicitDataDir = process.env.CAREERSRX_DATA_DIR?.trim();
  if (explicitDataDir) return path.join(absolutePath(explicitDataDir), SQLITE_FILE_NAME);

  const railwayVolumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (railwayVolumePath) return path.join(absolutePath(railwayVolumePath), SQLITE_FILE_NAME);

  return path.join(process.cwd(), "data", SQLITE_FILE_NAME);
}

export function careersRxSqlitePersistenceInfo() {
  const explicitPath = process.env.CAREERSRX_SQLITE_PATH?.trim();
  const explicitDataDir = process.env.CAREERSRX_DATA_DIR?.trim();
  const railwayVolumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();

  return {
    path: careersRxSqlitePath(),
    source: explicitPath
      ? "CAREERSRX_SQLITE_PATH"
      : explicitDataDir
        ? "CAREERSRX_DATA_DIR"
        : railwayVolumePath
          ? "RAILWAY_VOLUME_MOUNT_PATH"
          : "default-local-data",
    railwayVolumeAttached: Boolean(railwayVolumePath),
  };
}

export function warnIfVolatileSqliteStorage(context: string) {
  if (warnedAboutVolatileStorage) return;
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build") return;
  const info = careersRxSqlitePersistenceInfo();
  const isDefaultLocalData = info.source === "default-local-data";
  const isProduction = process.env.NODE_ENV === "production";
  const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  if (!isProduction && !isRailway) return;
  if (!isDefaultLocalData) return;

  warnedAboutVolatileStorage = true;
  console.warn("[careersrx/sqlite] Using local container storage for account data; data may not survive redeploys", {
    context,
    path: info.path,
    source: info.source,
    railwayVolumeAttached: info.railwayVolumeAttached,
  });
}
