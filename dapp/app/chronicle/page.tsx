import { Header } from '../_components/header';
import { Marquee } from '../_components/marquee';
import { Chronicle } from './_components/chronicle';

export const metadata = {
  title: 'Chronicle | King of the Hill',
  description:
    'The full chronicle of every reign — kings ascended, kings fallen, NFTs minted, fortunes claimed.',
};

export default function ChroniclePage() {
  return (
    <div className="relative grain min-h-screen flex flex-col">
      <Header />
      <main className="relative z-10 flex-1">
        <div className="mx-auto max-w-7xl 2xl:max-w-[88rem] 3xl:max-w-[124rem] 4xl:max-w-[168rem] px-6 2xl:px-10 3xl:px-12 4xl:px-16 pt-12 pb-16">
          <Chronicle />
        </div>
        <Marquee />
        <footer className="mx-auto max-w-7xl 2xl:max-w-[88rem] 3xl:max-w-[124rem] 4xl:max-w-[168rem] px-6 2xl:px-10 3xl:px-12 4xl:px-16 py-10 text-stone-soft flex justify-between items-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
            $KOTH · Chronicle
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
            Every reign · forever on-chain
          </span>
        </footer>
      </main>
    </div>
  );
}
