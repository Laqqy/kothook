import { Header } from '../_components/header';
import { Marquee } from '../_components/marquee';
import { ThroneRoom } from './_components/throne-room';

export const metadata = {
  title: 'Throne Room — King of the Hill',
  description:
    'Deposed sovereigns and their unclaimed coffers. After 12h any keeper may forfeit on their behalf — 3% tip, 97% burned to KOTH.',
};

export default function ThroneRoomPage() {
  return (
    <div className="relative grain min-h-screen flex flex-col">
      <Header />
      <main className="relative z-10 flex-1">
        <div className="mx-auto max-w-7xl px-6 pt-12 pb-16">
          <ThroneRoom />
        </div>
        <Marquee />
        <footer className="mx-auto max-w-7xl px-6 py-10 text-stone-soft flex justify-between items-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
            $KOTH · Throne Room
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
            Forfeit window · 3,600 blocks · ~12h
          </span>
        </footer>
      </main>
    </div>
  );
}
