// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import {ChronicleScroll} from "src/ChronicleScroll.sol";
import {Reign, REASON_OVERTHROWN} from "src/Types.sol";

contract ChronicleScrollTest is Test {
    ChronicleScroll scroll;
    address hook = makeAddr("hook");
    address treasury = makeAddr("treasury");
    address king = makeAddr("king");

    function setUp() public {
        scroll = new ChronicleScroll(hook, treasury);
    }

    function _r() internal view returns (Reign memory) {
        return Reign({
            king: king, reignId: 0, startBlock: 1, endBlock: 2,
            ethEarned: 0, recordHigh: 0, dethroneReason: REASON_OVERTHROWN
        });
    }

    function test_HookMintsAndKingOwns() public {
        vm.prank(hook);
        scroll.mintReign(king, 0, _r());
        assertEq(scroll.ownerOf(0), king);
    }

    function test_RoyaltyInfo() public view {
        (address recv, uint256 amount) = scroll.royaltyInfo(0, 1 ether);
        assertEq(recv, treasury);
        assertEq(amount, 0.05 ether);
    }

    function test_TransferIsAllowed() public {
        vm.prank(hook);
        scroll.mintReign(king, 0, _r());
        vm.prank(king);
        scroll.transferFrom(king, address(0xBEEF), 0);
        assertEq(scroll.ownerOf(0), address(0xBEEF));
    }

    function test_NonHookCannotMint() public {
        vm.expectRevert(ChronicleScroll.OnlyHook.selector);
        scroll.mintReign(king, 0, _r());
    }
}
