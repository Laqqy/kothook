import { Header } from '../_components/header';
import { Marquee } from '../_components/marquee';
import { Whitepaper } from './_components/whitepaper';

export const metadata = {
  title: 'Whitepaper | King of the Hill',
  description:
    'Why $KOTH is a self-contained buy-pressure machine — and why it is only possible on Uniswap v4 hooks.',
};

export default function WhitepaperPage() {
  return (
    <div className="relative grain min-h-screen flex flex-col">
      <Header />
      <main className="relative z-10 flex-1">
        <div className="mx-auto max-w-5xl 2xl:max-w-6xl 3xl:max-w-[104rem] 4xl:max-w-[140rem] px-6 2xl:px-10 3xl:px-12 4xl:px-16 pt-12 pb-16">
          <Whitepaper />
        </div>
        <Marquee />
        <footer className="mx-auto max-w-7xl 2xl:max-w-[88rem] 3xl:max-w-[124rem] 4xl:max-w-[168rem] px-6 2xl:px-10 3xl:px-12 4xl:px-16 py-10 text-stone flex justify-between items-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
            $KOTH · Whitepaper
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
            v0.1 · 2026-05
          </span>
        </footer>
      </main>
    </div>
  );
}
