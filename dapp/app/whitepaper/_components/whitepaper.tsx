'use client';

import {
  HairlineDivider,
  Asterism,
  Sigil,
  Initial,
} from '@/app/_components/ornaments';

export function Whitepaper() {
  return (
    <article className="relative">
      {/* Eyebrow */}
      <div className="reveal flex items-center gap-3 text-gold-leaf text-[11px] font-mono uppercase tracking-[0.35em]">
        <span>The Whitepaper</span>
        <span className="text-bronze-bright">·</span>
        <span className="text-stone">v0.1 · 2026-05</span>
      </div>
      <HairlineDivider
        ornament={<Asterism className="w-3 h-3 text-gold-leaf" />}
        className="reveal mt-3"
      />

      {/* Display title */}
      <h1
        className="reveal-ink mt-10 font-display font-medium text-balance"
        style={{ animationDelay: '120ms' }}
      >
        <span className="block font-body italic font-normal text-stone text-xl md:text-2xl mb-1 tracking-wide">
          A passive throne game
        </span>
        <span className="block text-5xl sm:text-6xl md:text-7xl 2xl:text-8xl 3xl:text-[8.5rem] 4xl:text-[11rem] leading-[0.95] tracking-tight text-parchment">
          The Self-Sealing{' '}
          <span className="font-body italic font-medium text-gold-pale">
            Flywheel
          </span>
        </span>
        <span className="block text-stone text-base md:text-lg max-w-2xl mt-4 tracking-wide leading-relaxed font-body">
          $KOTH is the first AMM-native game whose <em>only</em> mechanic is a
          competitive auction over passive yield — and the protocol burns its
          own supply every time a king walks away.
        </span>
      </h1>

      {/* Section background sigil */}
      <div
        aria-hidden
        className="absolute -right-16 top-72 text-lapis pointer-events-none"
      >
        <Sigil className="w-[420px] h-[420px] opacity-[0.05]" />
      </div>

      {/* ───────────────────────────────────────────────── */}
      <Section
        index="I"
        title="What's new"
        body={
          <>
            <P>
              Memecoins ask the holder to <em>hope</em>. Yield-bearing tokens
              demand the holder to <em>stake</em>. $KOTH does neither. The buy
              transaction itself is the entire claim: a single swap above the
              decayed-record × 1.03 threshold seats the buyer on the throne, and
              from that block forward <strong className="text-gold">2 % of
              every subsequent swap</strong> — buy or sell — flows to their
              wallet, untouched.
            </P>
            <P>
              No staking contract, no emissions schedule, no vote. The yield is
              a side-effect of the pool itself, paid in ETH, settled by the AMM
              every time someone touches the pair. Price discovery and the
              auction over the cashflow are the same trade.
            </P>
          </>
        }
      />

      <Section
        index="II"
        title="Utility — three loops in one"
        body={
          <>
            <P>
              The protocol stitches three economic loops together. None of them
              require a UI or a multisig vote.
            </P>
            <Loop
              label="The yield loop"
              body={
                <>
                  Holding the crown earns 2 % ETH on every swap. Bigger volume,
                  bigger yield. The king has every reason to{' '}
                  <strong className="text-gold">advertise the token</strong>{' '}
                  because their inbox grows with the pool's volume.
                </>
              }
            />
            <Loop
              label="The succession loop"
              body={
                <>
                  Anyone can dethrone the king by paying ≥ record × 1.03. The
                  record decays linearly to zero over 3,600 blocks, so the
                  ticket gets cheaper every block. There is{' '}
                  <strong className="text-gold">always a future buyer</strong>{' '}
                  for whom the throne becomes affordable.
                </>
              }
            />
            <Loop
              label="The burn loop"
              body={
                <>
                  Every swap burns 1 % of the KOTH side. Every unclaimed reign
                  gets its ETH coffers spent on KOTH and burned. Supply only
                  ever moves down. See <em>Buyback &amp; Burn</em> below.
                </>
              }
            />
          </>
        }
      />

      <Section
        index="III"
        title="Why only v4 hooks make this possible"
        body={
          <>
            <P>
              The whole machine is wired into the AMM, not bolted on top. That
              is not a stylistic choice — it is the only way the math closes.
            </P>
            <Bullet>
              <strong className="text-gold-leaf">beforeSwap / afterSwap
              </strong>{' '}
              hooks let the contract observe every trade against the pair and
              take a delta from the swap atomically. Pre-v4 (v2, v3, every fork)
              there is no callback at the pool level — you can only tax at
              the token's <code className="text-parchment-soft">transfer()</code>{' '}
              level, which traders work around by routing through wrappers.
            </Bullet>
            <CodeBlock>{`function beforeSwap(address sender, PoolKey calldata key, SwapParams calldata p, bytes calldata)
    external returns (bytes4, BeforeSwapDelta, uint24)
{
    uint256 amt = uint256(-p.amountSpecified);
    uint256 fee;

    if (p.zeroForOne) {                              // ETH -> KOTH (buy)
        fee = amt * 200 / 10_000;                    // 2% to the king
        poolManager.take(key.currency0, address(this), fee);
        kingBalances[currentKing] += fee;
    } else {                                         // KOTH -> ETH (sell)
        fee = amt * 100 / 10_000;                    // 1% burned
        poolManager.take(key.currency1, address(this), fee);
        koth.burnFromHook(fee);
    }

    BeforeSwapDelta delta = toBeforeSwapDelta(int128(int256(fee)), 0);
    return (IHooks.beforeSwap.selector, delta, 0);
}`}</CodeBlock>
            <Bullet>
              <strong className="text-gold-leaf">
                BEFORE_SWAP_RETURNS_DELTA
              </strong>{' '}
              and{' '}
              <strong className="text-gold-leaf">
                AFTER_SWAP_RETURNS_DELTA
              </strong>{' '}
              (hook address bits 0xCC) let us settle fees in the swap's own
              currency without a separate transfer — so the king's 2 % and the
              burn's 1 % cost no extra gas and no extra approvals.
            </Bullet>
            <Bullet>
              <strong className="text-gold-leaf">tx.origin coronation</strong>.
              Because the hook runs inside the PoolManager's locked context,
              every swap — direct, through 1inch, through CoW, through any
              aggregator that hasn't even shipped yet — is visible to the hook.
              The new king is whoever signed the transaction, even if the swap
              went through ten wrappers in between. There is no DEX you have to
              integrate against; the integration is the AMM.
            </Bullet>
            <Bullet>
              <strong className="text-gold-leaf">Internal unlock</strong>. The
              forfeit / buyback path uses the same{' '}
              <code className="text-parchment-soft">poolManager.unlock()</code>{' '}
              primitive to buy KOTH out of the pool and burn it — without
              leaving the hook, without slippage attacks, without a keeper bot
              that can front-run. The mechanism is part of the pool.
            </Bullet>
            <P>
              In short: $KOTH could not exist on Solana, on a Curve-style AMM,
              on Uniswap v2, or on a wrapper token. It needs the hooked AMM
              boundary that v4 introduces, and it needs the exact return-delta
              flags that v4 added to that boundary.
            </P>
          </>
        }
      />

      <Section
        index="IV"
        title="Self-contained buy pressure"
        body={
          <>
            <P>
              Most tokens ask <em>why would someone buy this</em>. $KOTH builds
              the answer into the contract. Four mechanisms apply on every
              swap:
            </P>
            <Bullet>
              <strong className="text-gold">Throne competition</strong>. The
              record threshold (record × 1.03) is the smallest buy that lays
              claim. Every coronation is, by definition, a price-discovery
              event larger than the previous record — until decay re-opens the
              window.
            </Bullet>
            <Bullet>
              <strong className="text-gold">Yield arbitrage</strong>. The 2 %
              cashflow scales with volume. As volume grows, the implied yield
              on a coronation grows, and the implied fair price of the throne
              follows it. There is a rational price for the crown at any volume
              level.
            </Bullet>
            <Bullet>
              <strong className="text-gold">Programmatic buyback</strong>. Every
              unclaimed reign (no claim within 12 h after dethrone) becomes
              swap-and-burn fuel. The hook itself buys KOTH out of the pool
              with the coffers and incinerates the result.
            </Bullet>
            <Bullet>
              <strong className="text-gold">Per-swap burn</strong>. 1 % of the
              KOTH side of every trade is permanently destroyed. The total
              supply ratchets down forever, with no admin switch to disable it.
            </Bullet>
          </>
        }
      />

      <Section
        index="V"
        title="Buyback &amp; Burn"
        body={
          <>
            <P>
              When a king is dethroned, their accumulated 2 % stream is locked
              in a coffer. They have <strong className="text-gold">12 hours
              </strong> to claim it. If they do not, the protocol acts on its
              own — without an admin call.
            </P>
            <Bullet>
              <strong className="text-gold-leaf">3 %</strong> of the coffer is
              paid to whichever wallet calls{' '}
              <code className="text-parchment-soft">forfeit()</code> — a
              keeper-economics primitive so the buyback never gets stuck.
            </Bullet>
            <Bullet>
              <strong className="text-gold-leaf">97 %</strong> is spent inside
              the same transaction on KOTH from the pool. The KOTH the hook
              receives goes straight to{' '}
              <code className="text-parchment-soft">burnFromHook()</code> and is
              destroyed.
            </Bullet>
            <P>
              The pool sees a real buy, the supply shrinks, and every remaining
              holder ends up with a marginally larger claim on future swaps.
            </P>
            <Aside>
              At <strong>1,000,000 KOTH</strong> max supply, every burn moves
              the needle. The supply is small on purpose — it makes the
              flywheel visible.
            </Aside>
          </>
        }
      />

      <Section
        index="VI"
        title="What we are not"
        body={
          <>
            <P>
              We are not a yield farm. There is no LP token, no staking, no
              auto-compounding vault on top. The yield is the swap fee, paid
              in ETH, to one wallet, until that wallet is replaced.
            </P>
            <P>
              We are not a governance token. There is nothing to vote on. The
              parameters (3 %, 2 %, 1 %, 12 h, 3,600 blocks) are immutable
              constants compiled into the hook bytecode.
            </P>
            <P>
              We are not a memecoin. The throne is the entire utility, and the
              throne is{' '}
              <strong className="text-parchment-cream">measurable</strong>: at
              any block you can compute the king's running yield, the
              record-decay, and the next coronation cost. Holding KOTH is
              exposure to the realm's volume, paid in ETH.
            </P>
          </>
        }
      />

    </article>
  );
}

function Section({
  index,
  title,
  body,
}: {
  index: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <section className="reveal mt-14">
      <header className="flex items-start gap-4 mb-5">
        <Initial char={index} size="1.6em" className="3xl:!text-[2.2em] 4xl:!text-[2.6em]" />
        <div className="flex-1 pt-1">
          <h2 className="font-display text-2xl md:text-3xl 3xl:text-4xl 4xl:text-5xl text-parchment tracking-[0.04em]">
            {title}
          </h2>
        </div>
      </header>
      <div className="space-y-4 pl-0 md:pl-[3.4em]">{body}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body text-base md:text-lg 3xl:text-xl 4xl:text-2xl text-parchment-soft leading-relaxed max-w-3xl 3xl:max-w-4xl 4xl:max-w-5xl">
      {children}
    </p>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 max-w-3xl 3xl:max-w-4xl 4xl:max-w-5xl">
      <span
        aria-hidden
        className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-gold-leaf"
      />
      <p className="font-body text-base md:text-lg 3xl:text-xl 4xl:text-2xl text-parchment-soft leading-relaxed">
        {children}
      </p>
    </div>
  );
}

function Loop({
  label,
  body,
}: {
  label: string;
  body: React.ReactNode;
}) {
  return (
    <div className="vellum-card rounded-sm px-5 py-4 3xl:px-7 3xl:py-6 max-w-3xl 3xl:max-w-4xl 4xl:max-w-5xl">
      <div className="font-mono text-[10px] 3xl:text-xs uppercase tracking-[0.3em] text-gold-leaf mb-1.5">
        {label}
      </div>
      <p className="font-body text-base 3xl:text-lg 4xl:text-xl text-parchment-soft leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function Aside({ children }: { children: React.ReactNode }) {
  return (
    <div className="engraved-inset rounded-sm px-4 py-3 3xl:px-6 3xl:py-5 max-w-3xl 3xl:max-w-4xl 4xl:max-w-5xl font-body text-sm 3xl:text-base text-parchment-soft italic">
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      className="engraved-inset rounded-sm px-4 py-3 3xl:px-6 3xl:py-5 max-w-3xl 3xl:max-w-4xl 4xl:max-w-5xl font-mono text-[11px] md:text-xs 3xl:text-sm text-parchment-soft leading-relaxed overflow-x-auto"
      aria-label="Solidity excerpt"
    >
      <code>{children}</code>
    </pre>
  );
}
