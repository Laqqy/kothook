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
        <span className="text-vermilion-bright">automatically dethrones thee</span>.
      </>
    ),
  },
  {
    numeral: 'V',
    title: 'Reclaim Lost Tribute',
    body: (
      <>
        Twelve hours after dethroning, any keeper may{' '}
        <span className="text-gold">reclaim thy unclaimed coffers</span> · 3%
        keeper&apos;s share; remainder is burned.
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
        className="absolute -right-12 -top-12 text-lapis pointer-events-none"
      >
        <Sigil className="w-[420px] h-[420px] opacity-[0.08]" />
      </div>

      <div className="relative">
        <HairlineDivider
          ornament={
            <div className="flex items-center gap-3 text-gold-leaf">
              <Asterism className="w-3 h-3" />
              <span className="font-mono text-[10px] uppercase tracking-[0.35em]">
                Protocol of Succession
              </span>
              <Asterism className="w-3 h-3" />
            </div>
          }
        />

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10 3xl:gap-x-14 3xl:gap-y-14 max-w-5xl 3xl:max-w-[88rem] 4xl:max-w-[112rem]">
          {RULES.map((rule) => (
            <article key={rule.numeral} className="flex gap-4">
              <span
                className="illuminated-initial shrink-0"
                style={{
                  fontSize: '1.05em',
                  width: '2.6em',
                  height: '2.6em',
                  letterSpacing: '0.04em',
                }}
                aria-hidden
              >
                {rule.numeral}
              </span>
              <div>
                <h3 className="font-display text-xl 3xl:text-2xl 4xl:text-3xl text-parchment mb-1.5 tracking-[0.04em]">
                  {rule.title}
                </h3>
                <p className="font-body text-base 3xl:text-lg 4xl:text-xl text-parchment-soft leading-relaxed">
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
