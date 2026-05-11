import { Sigil, HairlineDivider, Asterism } from './ornaments';

const RULES: { numeral: string; title: string; body: React.ReactNode }[] = [
  {
    numeral: 'I',
    title: 'Claim',
    body: (
      <>
        Pay tribute above the{' '}
        <span className="text-gold">decayed record × 1.03</span> in a single buy
        to dethrone the king and ascend.
      </>
    ),
  },
  {
    numeral: 'II',
    title: 'Reign',
    body: (
      <>
        Earn <span className="text-gold">2% ETH</span> on every swap. Tribute
        accrues to thy pull-payment balance.
      </>
    ),
  },
  {
    numeral: 'III',
    title: 'Decay',
    body: (
      <>
        The record decays linearly to zero over{' '}
        <span className="text-gold">3,600 blocks</span> (~12h). Threshold
        follows.
      </>
    ),
  },
  {
    numeral: 'IV',
    title: 'Dump Protection',
    body: (
      <>
        If thou dost sell whilst crowned, the protocol{' '}
        <span className="text-crimson">automatically dethrones thee</span>.
      </>
    ),
  },
  {
    numeral: 'V',
    title: 'Forfeit Writ',
    body: (
      <>
        Twelve hours after dethroning, any keeper may{' '}
        <span className="text-gold">forfeit thy unclaimed coffers</span> · 3%
        tip; remainder is burned.
      </>
    ),
  },
  {
    numeral: 'VI',
    title: 'Chronicle',
    body: (
      <>
        Each overthrow mints two relics — the soulbound{' '}
        <span className="text-parchment-soft">Chronicle Soul</span> to the
        deposed, the tradeable{' '}
        <span className="text-parchment-soft">Chronicle Scroll</span> to the
        new sovereign.
      </>
    ),
  },
];

export function Protocol() {
  return (
    <section className="relative overflow-hidden">
      {/* Background sigil */}
      <div
        aria-hidden
        className="absolute -right-12 -top-12 text-bronze-soft pointer-events-none"
      >
        <Sigil className="w-[420px] h-[420px] opacity-[0.07]" />
      </div>

      <div className="relative">
        <HairlineDivider
          ornament={
            <div className="flex items-center gap-3 text-bronze-bright">
              <Asterism className="w-3 h-3" />
              <span className="font-mono text-[10px] uppercase tracking-[0.35em]">
                Protocol of Succession
              </span>
              <Asterism className="w-3 h-3" />
            </div>
          }
        />

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-8 max-w-5xl">
          {RULES.map((rule) => (
            <article key={rule.numeral} className="flex gap-4">
              <span className="font-display italic text-gold-pale text-4xl leading-none w-10 shrink-0 text-right">
                {rule.numeral}
              </span>
              <div>
                <h3 className="font-display text-xl text-parchment mb-1.5 tracking-wide">
                  {rule.title}
                </h3>
                <p className="font-body text-sm text-parchment-soft leading-relaxed">
                  {rule.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
