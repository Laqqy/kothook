import { Header } from './_components/header';
import { Hero } from './_components/hero';
import { StatCards } from './_components/stat-cards';
import { SwapWidget } from './_components/swap-widget';
import { TokenCodex } from './_components/token-codex';
import { Protocol } from './_components/protocol';
import { Marquee } from './_components/marquee';
import { HairlineDivider, Asterism } from './_components/ornaments';

export default function Home() {
  return (
    <div className="relative grain min-h-screen flex flex-col">
      <Header />

      <main className="relative z-10 flex-1">
        {/* Hero band: throne on the left, swap ledger on the right */}
        <div className="mx-auto max-w-7xl 2xl:max-w-[88rem] 3xl:max-w-[124rem] 4xl:max-w-[168rem] px-6 2xl:px-10 3xl:px-12 4xl:px-16 pt-12 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <div className="lg:col-span-7">
              <Hero />
            </div>
            <div className="lg:col-span-5 lg:sticky lg:top-8 lg:self-start space-y-4">
              <SwapWidget />
              <TokenCodex />
            </div>
          </div>
        </div>

        {/* Divider before stats */}
        <div className="mx-auto max-w-7xl 2xl:max-w-[88rem] 3xl:max-w-[124rem] 4xl:max-w-[168rem] px-6 2xl:px-10 3xl:px-12 4xl:px-16">
          <HairlineDivider
            ornament={
              <div className="flex items-center gap-3 text-gold-leaf">
                <Asterism className="w-3 h-3" />
                <span className="font-mono text-[10px] uppercase tracking-[0.35em]">
                  State of the Realm
                </span>
                <Asterism className="w-3 h-3" />
              </div>
            }
          />
        </div>

        {/* Stat cards */}
        <div className="mx-auto max-w-7xl 2xl:max-w-[88rem] 3xl:max-w-[124rem] 4xl:max-w-[168rem] px-6 2xl:px-10 3xl:px-12 4xl:px-16 py-12">
          <StatCards />
        </div>

        {/* Protocol of Succession */}
        <div className="mx-auto max-w-7xl 2xl:max-w-[88rem] 3xl:max-w-[124rem] 4xl:max-w-[168rem] px-6 2xl:px-10 3xl:px-12 4xl:px-16 pb-16">
          <Protocol />
        </div>

        {/* Marquee */}
        <Marquee />

        {/* Footnote */}
        <footer className="mx-auto max-w-7xl 2xl:max-w-[88rem] 3xl:max-w-[124rem] 4xl:max-w-[168rem] px-6 2xl:px-10 3xl:px-12 4xl:px-16 py-10 flex flex-col md:flex-row gap-4 justify-between items-center text-stone-soft">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em]">
            $KOTH · A Uniswap V4 Hook Experiment
          </div>
          <div className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.3em]">
            <a
              href="https://github.com/Laqqy/kothook"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gold transition-colors"
            >
              Github
            </a>
            <span className="text-bronze-bright">·</span>
            <a href="/whitepaper" className="hover:text-gold transition-colors">
              Whitepaper
            </a>
            <span className="text-bronze-bright">·</span>
            <a
              href="https://x.com/KOTHook"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gold transition-colors"
            >
              X
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
