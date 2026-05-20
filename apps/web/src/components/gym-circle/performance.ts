"use client";

const PERF_PREFIX = "gym-circle";

function perfEnabled() {
  return process.env.NEXT_PUBLIC_PERF_DEBUG === "true";
}

function perfName(name: string) {
  return `${PERF_PREFIX}:${name}`;
}

export function markPerf(name: string) {
  if (!perfEnabled() || typeof performance === "undefined") return;
  performance.mark(perfName(name));
}

export function measurePerf(name: string, start: string, end?: string) {
  if (!perfEnabled() || typeof performance === "undefined") return;
  try {
    const endName = end ? perfName(end) : undefined;
    if (end) performance.mark(endName as string);
    performance.measure(perfName(name), perfName(start), endName);
    const entries = performance.getEntriesByName(perfName(name), "measure");
    const latest = entries.at(-1);
    if (latest) {
      console.info("[GymCirclePerf]", name, {
        durationMs: Math.round(latest.duration),
      });
    }
  } catch {
    // Performance marks are diagnostic only.
  }
}
