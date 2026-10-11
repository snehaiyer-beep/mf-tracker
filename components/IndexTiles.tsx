import { Pct, Sparkline } from "./format";

export type IndexStat = {
  name: string;
  wow: number | null;
  mom: number | null;
  ytd: number | null;
  spark: number[];
  as_of: string | null;
};

const BLURB: Record<string, string> = {
  "Nifty 50": "India's 50 biggest companies",
  "Nifty Midcap 150": "Mid-sized companies",
  "Nifty Smallcap 100": "Smaller companies",
};

export function IndexTiles({ indices }: { indices: IndexStat[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {indices.map((ix) => (
        <div key={ix.name} className="panel relative overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{ix.name}</div>
              <div className="text-xs text-muted">{BLURB[ix.name] ?? ""}</div>
            </div>
            <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-faint">proxy</span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div>
              <div className="label mb-0.5">This week</div>
              <Pct value={ix.wow} size="lg" />
            </div>
            <Sparkline values={ix.spark} width={110} height={36} color="var(--series-index)" />
          </div>
          <div className="mt-3 flex gap-4 border-t border-line pt-2 text-xs text-muted">
            <span>
              Month <Pct value={ix.mom} />
            </span>
            <span>
              Since Jan <Pct value={ix.ytd} />
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
