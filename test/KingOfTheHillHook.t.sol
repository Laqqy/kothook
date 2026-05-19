// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import {DeployFixture} from "./helpers/DeployFixture.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {KOTHToken} from "src/KOTHToken.sol";
import {KingOfTheHillHook} from "src/KingOfTheHillHook.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";

contract KingOfTheHillHookTest is DeployFixture {
    function setUp() public {
        _deployStack();
    }

    function test_DecayZeroWhenNoKing() public view {
        assertEq(kothHook.getDecayedRecord(), 0);
        assertEq(kothHook.getThreshold(), 0);
    }

    function test_DecayLinear() public {
        uint256 startBlock = block.number;
        kothHook.seedRecord(10 ether, startBlock);
        assertEq(kothHook.getDecayedRecord(), 10 ether);

        vm.roll(startBlock + 1800);
        // 1800 / 3600 = 50%
        assertEq(kothHook.getDecayedRecord(), 5 ether);
        // threshold = decayed * 1.03 = 5.15 ether
        assertEq(kothHook.getThreshold(), 5.15 ether);

        vm.roll(startBlock + 3600);
        assertEq(kothHook.getDecayedRecord(), 0);
        assertEq(kothHook.getThreshold(), 0);

        vm.roll(startBlock + 3601);
        assertEq(kothHook.getDecayedRecord(), 0);
    }

    function test_SeedRecordIsOneShot() public {
        kothHook.seedRecord(1 ether, block.number);
        vm.expectRevert();   // AlreadySeeded selector
        kothHook.seedRecord(2 ether, block.number);
    }

    function test_HookHasCorrectImmutables() public view {
        assertEq(address(kothHook.koth()), address(koth));
        assertEq(address(kothHook.soul()), address(soul));
        assertEq(address(kothHook.scroll()), address(scroll));
        assertEq(kothHook.treasury(), treasury);
        assertEq(kothHook.router(), address(kothRouter));
    }

    function test_PoolKeyBoundOnHookAndRouter() public view {
        assertTrue(kothHook.poolKeySet());
        assertTrue(kothRouter.poolInitialized());
    }

    function test_RouterBuyGoesThroughNoOpHook() public {
        address alice = makeAddr("alice");
        deal(alice, 5 ether);
        vm.prank(alice);
        uint256 kothOut = kothRouter.buy{value: 1 ether}(0);
        assertGt(kothOut, 0);
        assertGt(koth.balanceOf(alice), 0);
    }

    function test_FirstBuyCrowns() public {
        address alice = makeAddr("alice");
        deal(alice, 5 ether);
        vm.prank(alice);
        kothRouter.buy{value: 1 ether}(0);

        assertEq(kothHook.currentKing(), alice);
        assertEq(kothHook.highestBuyAmount(), 1 ether);
        assertEq(kothHook.highestBuyBlock(), block.number);
    }

    function test_BuyBelowThresholdDoesNotChangeKing() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        deal(alice, 5 ether);
        deal(bob, 5 ether);

        vm.prank(alice);
        kothRouter.buy{value: 2 ether}(0);
        assertEq(kothHook.currentKing(), alice);

        // Bob's 1 ether is below threshold (2 * 1.03 = 2.06)
        vm.prank(bob);
        kothRouter.buy{value: 1 ether}(0);
        assertEq(kothHook.currentKing(), alice);
    }

    function test_BuyAboveThresholdReplacesKing() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        deal(alice, 5 ether);
        deal(bob, 5 ether);

        vm.prank(alice);
        kothRouter.buy{value: 2 ether}(0);

        vm.prank(bob);
        kothRouter.buy{value: 2.1 ether}(0);   // > 2 * 1.03 = 2.06
        assertEq(kothHook.currentKing(), bob);
        assertEq(kothHook.highestBuyAmount(), 2.1 ether);

        // Alice should have a soul + scroll from being dethroned
        assertEq(soul.balanceOf(alice), 1);
        assertEq(scroll.balanceOf(alice), 1);
    }

    function test_EthFeeAccumulatesForKing() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        deal(alice, 5 ether);
        deal(bob, 5 ether);

        vm.prank(alice);
        kothRouter.buy{value: 2 ether}(0);
        // First buy still pays 2% fee — but no king yet at fee-time, so it goes to treasury
        // Actually: beforeSwap takes the fee BEFORE afterSwap crowns alice. So this 2% is treasury.
        // After alice is crowned, the fee for HER swap is already in treasury.

        uint256 treasuryAfterAlice = kothHook.treasuryBalance();
        assertEq(treasuryAfterAlice, 0.04 ether);   // 2% of 2 ether

        // Bob's swap of 1 ETH now should put 0.02 ETH (2%) into kingBalances[alice]
        vm.prank(bob);
        kothRouter.buy{value: 1 ether}(0);
        assertEq(kothHook.kingBalances(alice), 0.02 ether);
    }

    function test_KothBurnedOnBuy() public {
        uint256 supplyBefore = koth.totalSupply();

        address alice = makeAddr("alice");
        deal(alice, 5 ether);
        vm.prank(alice);
        uint256 kothOut = kothRouter.buy{value: 1 ether}(0);

        // Burn fee was 1% of gross KOTH out (taken by hook from manager).
        // Approximate: total amm-out ≈ kothOut / 0.99 (user got 99%)
        uint256 totalAmmOut = kothOut * 100 / 99;
        uint256 expectedBurn = totalAmmOut - kothOut;

        uint256 supplyAfter = koth.totalSupply();
        uint256 actualBurn = supplyBefore - supplyAfter;

        // Allow small rounding error
        assertApproxEqAbs(actualBurn, expectedBurn, 100);
    }

    function test_KingSellingDethrones() public {
        address alice = makeAddr("alice");
        deal(alice, 10 ether);

        vm.startPrank(alice);
        uint256 bought = kothRouter.buy{value: 5 ether}(0);
        assertEq(kothHook.currentKing(), alice);

        koth.approve(address(kothRouter), bought);
        kothRouter.sell(bought / 2, 0);

        assertEq(kothHook.currentKing(), address(0));
        assertGt(kothHook.dethronedAt(alice), 0);
        vm.stopPrank();

        // Soul + Scroll minted
        assertEq(soul.balanceOf(alice), 1);
        assertEq(scroll.balanceOf(alice), 1);
    }

    function test_DumpedKingKeepsBalance() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        deal(alice, 10 ether);
        deal(bob, 5 ether);

        vm.prank(alice); kothRouter.buy{value: 5 ether}(0);
        vm.prank(bob);   kothRouter.buy{value: 1 ether}(0);    // accrues 0.02 to alice
        uint256 prebal = kothHook.kingBalances(alice);
        assertEq(prebal, 0.02 ether);

        vm.startPrank(alice);
        uint256 aliceKoth = koth.balanceOf(alice);
        koth.approve(address(kothRouter), type(uint256).max);
        kothRouter.sell(aliceKoth, 0);   // dump
        vm.stopPrank();

        assertEq(kothHook.currentKing(), address(0));
        assertEq(kothHook.kingBalances(alice), prebal);   // unchanged
    }

    function test_ClaimByCurrentKing() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        deal(alice, 5 ether);
        deal(bob, 5 ether);

        vm.prank(alice); kothRouter.buy{value: 2 ether}(0);
        vm.prank(bob);   kothRouter.buy{value: 1 ether}(0);   // 0.02 → alice

        uint256 aliceEthBefore = alice.balance;
        vm.prank(alice);
        kothHook.claim();
        assertEq(alice.balance, aliceEthBefore + 0.02 ether);
        assertEq(kothHook.kingBalances(alice), 0);
    }

    function test_ClaimRevertsForZeroBalance() public {
        address rando = makeAddr("rando");
        vm.prank(rando);
        vm.expectRevert();   // NothingToClaim
        kothHook.claim();
    }

    function test_TreasuryClaimByOwner() public {
        address alice = makeAddr("alice");
        deal(alice, 5 ether);
        // Alice's first buy → 2% goes to treasury (no king at fee-time)
        vm.prank(alice); kothRouter.buy{value: 1 ether}(0);
        assertEq(kothHook.treasuryBalance(), 0.02 ether);

        uint256 tBefore = treasury.balance;
        vm.prank(treasury);
        kothHook.claimTreasury();
        assertEq(treasury.balance, tBefore + 0.02 ether);
        assertEq(kothHook.treasuryBalance(), 0);
    }

    function test_TreasuryClaimRevertsForNonTreasury() public {
        address rando = makeAddr("rando");
        vm.prank(rando);
        vm.expectRevert();   // OnlyTreasury
        kothHook.claimTreasury();
    }

    function test_ForfeitRevertsIfNotDethroned() public {
        address rando = makeAddr("rando");
        vm.expectRevert();   // NotDethroned
        kothHook.forfeit(rando, 0);
    }

    function test_ForfeitRevertsTooEarly() public {
        address alice = makeAddr("alice");
        deal(alice, 5 ether);
        vm.prank(alice); kothRouter.buy{value: 2 ether}(0);

        vm.startPrank(alice);
        koth.approve(address(kothRouter), type(uint256).max);
        kothRouter.sell(koth.balanceOf(alice), 0);
        vm.stopPrank();

        address keeper = makeAddr("keeper");
        vm.prank(keeper);
        vm.expectRevert();   // TooEarly
        kothHook.forfeit(alice, 0);
    }

    function test_ForfeitBurnsKothAndPaysKeeper() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        deal(alice, 10 ether);
        deal(bob, 5 ether);

        vm.prank(alice); kothRouter.buy{value: 5 ether}(0);
        vm.prank(bob);   kothRouter.buy{value: 1 ether}(0);   // alice earns 0.02

        uint256 aliceBalance = kothHook.kingBalances(alice);
        assertEq(aliceBalance, 0.02 ether);

        // Dethrone alice
        vm.startPrank(alice);
        koth.approve(address(kothRouter), type(uint256).max);
        kothRouter.sell(koth.balanceOf(alice), 0);
        vm.stopPrank();
        assertEq(kothHook.currentKing(), address(0));

        // Roll past forfeit deadline
        vm.roll(block.number + kothHook.FORFEIT_BLOCKS() + 1);

        address keeper = makeAddr("keeper");
        uint256 supplyPre = koth.totalSupply();
        uint256 keeperBalPre = keeper.balance;

        vm.prank(keeper);
        kothHook.forfeit(alice, 0);

        // Keeper got tip
        uint256 expectedTip = aliceBalance * kothHook.KEEPER_TIP_BPS() / 10_000;
        assertEq(keeper.balance - keeperBalPre, expectedTip);

        // Balance zeroed
        assertEq(kothHook.kingBalances(alice), 0);
        assertEq(kothHook.dethronedAt(alice), 0);

        // KOTH burned
        assertLt(koth.totalSupply(), supplyPre);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // J.1 — Hybrid identification: stock router swap still crowns via tx.origin
    // ──────────────────────────────────────────────────────────────────────────

    function test_SwapViaStockRouterCrownsViaTxOrigin() public {
        // The fixture's `swapRouter` from Deployers is a stock v4 PoolSwapTest.
        // With Hybrid identification, the hook falls back to tx.origin so
        // swaps via Universal Router / aggregators / trading bots still play.
        address alice = makeAddr("alice");
        deal(alice, 5 ether);

        // tx.origin defaults to the test contract; we want it to be alice so the
        // crown attribution makes sense. vm.startPrank(alice, alice) sets both
        // msg.sender and tx.origin.
        vm.startPrank(alice, alice);
        swapRouter.swap{value: 1 ether}(
            pk,
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: -1 ether,
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""    // no hookData — hook will fall back to tx.origin
        );
        vm.stopPrank();

        // Alice gets crowned because tx.origin == alice
        assertEq(kothHook.currentKing(), alice);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // J.2 — Events are emitted
    // ──────────────────────────────────────────────────────────────────────────

    function test_NewKingEventEmitted() public {
        address alice = makeAddr("alice");
        deal(alice, 5 ether);

        vm.recordLogs();
        vm.prank(alice);
        kothRouter.buy{value: 1 ether}(0);
        Vm.Log[] memory entries = vm.getRecordedLogs();

        bool found = false;
        bytes32 sigNewKing = keccak256("NewKing(address,uint256,uint256)");
        for (uint i; i < entries.length; ++i) {
            if (entries[i].topics[0] == sigNewKing && entries[i].emitter == address(kothHook)) {
                found = true;
                // topic[1] = indexed king
                assertEq(address(uint160(uint256(entries[i].topics[1]))), alice);
                break;
            }
        }
        assertTrue(found, "NewKing not emitted");
    }

    function test_KingDethronedEventEmitted() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        deal(alice, 5 ether); deal(bob, 5 ether);

        vm.prank(alice); kothRouter.buy{value: 2 ether}(0);

        vm.recordLogs();
        vm.prank(bob); kothRouter.buy{value: 2.5 ether}(0);
        Vm.Log[] memory entries = vm.getRecordedLogs();

        bool found = false;
        bytes32 sig = keccak256("KingDethroned(address,bytes32,uint256)");
        for (uint i; i < entries.length; ++i) {
            if (entries[i].topics[0] == sig && entries[i].emitter == address(kothHook)) {
                found = true;
                assertEq(address(uint160(uint256(entries[i].topics[1]))), alice);
                break;
            }
        }
        assertTrue(found, "KingDethroned not emitted");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Security fixes
    // ──────────────────────────────────────────────────────────────────────────

    // C-01: setHook must reject non-admin (would-be hijacker frontrunning deploy)
    function test_SetHookOnlyAdmin() public {
        address[] memory empty = new address[](0);
        // Fresh token so HookAlreadySet doesn't mask the auth check.
        KOTHToken fresh = new KOTHToken(empty);   // admin = this
        address rando = makeAddr("rando");
        vm.prank(rando);
        vm.expectRevert(KOTHToken.OnlyAdmin.selector);
        fresh.setHook(makeAddr("attacker"));
    }

    // C-02: seedRecord must reject non-admin
    function test_SeedRecordOnlyAdmin() public {
        address rando = makeAddr("rando");
        vm.prank(rando);
        vm.expectRevert(KingOfTheHillHook.OnlyAdmin.selector);
        kothHook.seedRecord(1 ether, block.number);
    }

    // C-03: poolKey init must reject non-admin and poison keys
    function test_InitializePoolKeyOnlyAdminAndValidated() public {
        // Deploy a fresh hook impl + etch it so we can test the un-initialised path.
        KingOfTheHillHook fresh = new KingOfTheHillHook(
            IPoolManager(address(manager)),
            koth,
            soul,
            scroll,
            treasury,
            address(kothRouter),
            address(this)
        );
        address freshAddr = address(uint160(0x1100_0000_00FF));
        vm.etch(freshAddr, address(fresh).code);
        // admin is now storage-slot 0 — replay the constructor assignment so
        // the etched bytecode has a non-zero admin to admit our call below.
        vm.store(freshAddr, bytes32(uint256(0)), bytes32(uint256(uint160(address(this)))));
        KingOfTheHillHook newHook = KingOfTheHillHook(payable(freshAddr));

        address rando = makeAddr("rando");
        vm.prank(rando);
        vm.expectRevert(KingOfTheHillHook.OnlyAdmin.selector);
        newHook.initializePoolKey(pk);

        // Invalid currency1 — admin can still call, but validation rejects.
        PoolKey memory bad = pk;
        bad.currency1 = Currency.wrap(address(0xdeadbeef));
        vm.expectRevert(KingOfTheHillHook.InvalidPoolKey.selector);
        newHook.initializePoolKey(bad);
    }

    function test_RouterInitializePoolOnlyAdmin() public {
        address rando = makeAddr("rando");
        vm.prank(rando);
        vm.expectRevert(KOTHRouter.OnlyAdmin.selector);
        kothRouter.initializePool(pk);
    }

    // C-04: a smart-contract king that rejects ERC721 must still be dethrone-able
    function test_ContractKingCanBeDethroned() public {
        ContractKing king = new ContractKing(kothRouter);
        vm.deal(address(king), 5 ether);
        king.buyToCrown(2 ether);
        assertEq(kothHook.currentKing(), address(king));

        address alice = makeAddr("alice");
        deal(alice, 5 ether);
        vm.prank(alice);
        kothRouter.buy{value: 3 ether}(0);   // > 2 * 1.03
        // Without try/catch around mintReign, alice's swap would revert here and
        // ContractKing would be permaking. With the fix, alice replaces it.
        assertEq(kothHook.currentKing(), alice);
        // No NFTs minted to ContractKing — the try/catch swallowed the mint reverts.
        assertEq(soul.balanceOf(address(king)), 0);
        assertEq(scroll.balanceOf(address(king)), 0);
    }

    // C-05: forfeit honours keeper-supplied minKothOut
    function test_ForfeitSlippageReverts() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        deal(alice, 10 ether);
        deal(bob, 5 ether);

        vm.prank(alice); kothRouter.buy{value: 5 ether}(0);
        vm.prank(bob);   kothRouter.buy{value: 1 ether}(0);

        // Dethrone alice via dump
        vm.startPrank(alice);
        koth.approve(address(kothRouter), type(uint256).max);
        kothRouter.sell(koth.balanceOf(alice), 0);
        vm.stopPrank();

        vm.roll(block.number + kothHook.FORFEIT_BLOCKS() + 1);

        address keeper = makeAddr("keeper");
        vm.prank(keeper);
        vm.expectRevert(KingOfTheHillHook.SlippageExceeded.selector);
        kothHook.forfeit(alice, type(uint256).max);   // absurdly high min
    }

    // Tip-after-buyback ordering: the keeper sees the burn already committed
    // when their receive() fires — so they have no intra-tx window to manipulate
    // sqrtPriceX96 before the buyback reads it.
    function test_ForfeitPaysKeeperAfterBuyback() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        deal(alice, 10 ether);
        deal(bob, 5 ether);
        vm.prank(alice); kothRouter.buy{value: 5 ether}(0);
        vm.prank(bob);   kothRouter.buy{value: 1 ether}(0);

        // Dethrone alice via dump
        vm.startPrank(alice);
        koth.approve(address(kothRouter), type(uint256).max);
        kothRouter.sell(koth.balanceOf(alice), 0);
        vm.stopPrank();
        vm.roll(block.number + kothHook.FORFEIT_BLOCKS() + 1);

        SandwichKeeper keeper = new SandwichKeeper(kothHook, koth);
        uint256 supplyPre = koth.totalSupply();

        keeper.callForfeit(alice);

        // The keeper's receive() fired AFTER the burn, so the supply it saw is
        // already lower than the pre-forfeit total. Pre-fix this would have
        // equalled supplyPre.
        assertLt(keeper.kothSupplyOnReceive(), supplyPre);
        // And the keeper got their tip.
        assertGt(address(keeper).balance, 0);
    }

    // M-03: dust coffer goes entirely to keeper, no swap reverts
    function test_ForfeitDustSweepsToKeeper() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        deal(alice, 1 ether);
        deal(bob, 1 ether);

        // Small reign, tiny fee accrual: 2% of 0.01 = 0.0002 ETH < MIN_FORFEIT_AMOUNT
        vm.prank(alice); kothRouter.buy{value: 0.01 ether}(0);
        vm.prank(bob);   kothRouter.buy{value: 0.01 ether}(0);

        uint256 aliceCoffer = kothHook.kingBalances(alice);
        assertGt(aliceCoffer, 0);
        assertLt(aliceCoffer, kothHook.MIN_FORFEIT_AMOUNT());

        // Dethrone alice via dump
        vm.startPrank(alice);
        koth.approve(address(kothRouter), type(uint256).max);
        kothRouter.sell(koth.balanceOf(alice), 0);
        vm.stopPrank();
        vm.roll(block.number + kothHook.FORFEIT_BLOCKS() + 1);

        address keeper = makeAddr("keeper");
        uint256 keeperBalPre = keeper.balance;
        uint256 supplyPre = koth.totalSupply();

        vm.prank(keeper);
        kothHook.forfeit(alice, 0);

        // Keeper got the full dust, no KOTH burned
        assertEq(keeper.balance - keeperBalPre, aliceCoffer);
        assertEq(koth.totalSupply(), supplyPre);   // no buyback fired
        assertEq(kothHook.kingBalances(alice), 0);
    }
}

/// @notice Test helper: a contract that buys KOTH (becomes king) but rejects
///         ERC721 callbacks. Without the dethrone try/catch fix it would be a
///         permaking — its successor's swap would revert on Soul mint.
contract ContractKing {
    KOTHRouter public immutable router;
    constructor(KOTHRouter _router) { router = _router; }
    function buyToCrown(uint256 amount) external {
        router.buy{value: amount}(0);
    }
    receive() external payable {}
    // Notably no `onERC721Received` — that's the whole point.
}

/// @notice Test helper: a malicious keeper that records whether its receive()
///         was called BEFORE or AFTER the buyback.  Pre-fix, the tip arrived
///         before the swap and the receive() could re-enter `poolManager.unlock`
///         to shift the price; post-fix the buyback is committed before any
///         tip transfer, so the keeper has no window.
contract SandwichKeeper {
    KingOfTheHillHook public immutable hook;
    KOTHToken public immutable koth;
    uint256 public kothSupplyOnReceive;

    constructor(KingOfTheHillHook _hook, KOTHToken _koth) {
        hook = _hook;
        koth = _koth;
    }

    function callForfeit(address staleKing) external {
        hook.forfeit(staleKing, 0);
    }

    receive() external payable {
        // Snapshot the KOTH supply at the moment we receive the tip. With the
        // post-fix ordering this is AFTER the burn, so it is strictly less than
        // the pre-forfeit supply.
        kothSupplyOnReceive = koth.totalSupply();
    }
}
