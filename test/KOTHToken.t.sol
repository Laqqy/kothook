// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import {KOTHToken} from "src/KOTHToken.sol";

contract KOTHTokenTest is Test {
    KOTHToken token;
    address deployer = address(this);

    function setUp() public {
        address[] memory exemptions = new address[](0);
        token = new KOTHToken(exemptions);
    }

    function test_TotalSupplyMintedToDeployer() public view {
        assertEq(token.totalSupply(), 1_000_000 ether);
        assertEq(token.balanceOf(deployer), 1_000_000 ether);
        assertEq(token.name(), "King of the Hill");
        assertEq(token.symbol(), "KOTH");
        assertEq(token.decimals(), 18);
    }

    function test_AntiSniperBlocksLargeTransfer() public {
        address victim = makeAddr("victim");
        uint256 maxAllowed = (1_000_000 ether * 100) / 10_000;   // 10_000 ether
        uint256 oneOver = maxAllowed + 1;

        vm.expectRevert(
            abi.encodeWithSelector(KOTHToken.AntiSniperLimit.selector, oneOver, maxAllowed)
        );
        token.transfer(victim, oneOver);
    }

    function test_AntiSniperAllowsAtLimit() public {
        address victim = makeAddr("victim");
        uint256 maxAllowed = (1_000_000 ether * 100) / 10_000;
        token.transfer(victim, maxAllowed);
        assertEq(token.balanceOf(victim), maxAllowed);
    }

    function test_ExemptAddressBypassesLimit() public {
        address pool = makeAddr("pool");
        address[] memory exemptions = new address[](1);
        exemptions[0] = pool;
        KOTHToken t2 = new KOTHToken(exemptions);
        t2.transfer(pool, 500_000 ether);   // 50%, way over 1% cap
        assertEq(t2.balanceOf(pool), 500_000 ether);
    }

    function test_AntiSniperLiftsAfterWindow() public {
        address victim = makeAddr("victim");
        vm.roll(block.number + token.SNIPER_BLOCKS());
        token.transfer(victim, 500_000 ether);
        assertEq(token.balanceOf(victim), 500_000 ether);
    }

    function test_SetHookOnce() public {
        address fakeHook = makeAddr("hook");
        token.setHook(fakeHook);
        assertEq(token.hook(), fakeHook);
        assertTrue(token.isExempt(fakeHook));
    }

    function test_SetHookRevertsOnSecondCall() public {
        token.setHook(makeAddr("hook1"));
        vm.expectRevert(KOTHToken.HookAlreadySet.selector);
        token.setHook(makeAddr("hook2"));
    }

    function test_BurnFromHookOnlyByHook() public {
        address fakeHook = makeAddr("hook");
        token.setHook(fakeHook);
        token.transfer(fakeHook, 1000 ether);

        vm.expectRevert(KOTHToken.OnlyHook.selector);
        token.burnFromHook(500 ether);
    }

    function test_BurnFromHookReducesSupply() public {
        address fakeHook = makeAddr("hook");
        token.setHook(fakeHook);
        token.transfer(fakeHook, 1000 ether);

        uint256 supplyBefore = token.totalSupply();
        vm.prank(fakeHook);
        token.burnFromHook(400 ether);

        assertEq(token.totalSupply(), supplyBefore - 400 ether);
        assertEq(token.balanceOf(fakeHook), 600 ether);
    }
}
