// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {DeployFixture} from "./helpers/DeployFixture.sol";

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
}
