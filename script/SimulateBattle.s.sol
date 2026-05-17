// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import "forge-std/Test.sol";
import {DeployFixture} from "../test/helpers/DeployFixture.sol";

/// @notice Replays the design's reference battle timeline. Run with `forge test --match-contract SimulateBattle -vv`
///         (we use Test instead of Script because we need vm.roll/vm.prank cheats).
contract SimulateBattle is DeployFixture {
    function setUp() public { _deployStack(); }

    function test_replayBattle() public {
        address founder = makeAddr("founder");
        address alice   = makeAddr("alice");
        address bob     = makeAddr("bob");
        address charlie = makeAddr("charlie");
        address dave    = makeAddr("dave");
        address keeper  = makeAddr("keeper");

        deal(founder, 100 ether);
        deal(alice,   100 ether);
        deal(bob,     100 ether);
        deal(charlie, 100 ether);
        deal(dave,    100 ether);

        uint256 b0 = block.number;

        // Founder takes the throne
        vm.prank(founder);
        kothRouter.buy{value: 2 ether}(0);
        require(kothHook.currentKing() == founder, "founder not king");
        emit log_named_address("Block 1: founder is king", founder);

        // Skip ahead, alice takes it with 2.07 ETH (above 2 * 1.03)
        vm.roll(b0 + 500);
        vm.prank(alice);
        kothRouter.buy{value: 2.07 ether}(0);
        require(kothHook.currentKing() == alice, "alice not king");
        emit log_named_address("Block 500: alice is king", alice);

        // Bob's small buy: not enough
        vm.roll(b0 + 1000);
        vm.prank(bob);
        kothRouter.buy{value: 0.5 ether}(0);
        require(kothHook.currentKing() == alice, "alice should still be king");
        emit log_string("Block 1000: bob's 0.5 ETH was not enough");

        // After ~1800 blocks, decay halved
        vm.roll(b0 + 2000);
        emit log_named_uint("Block 2000: getDecayedRecord (wei)", kothHook.getDecayedRecord());

        // Charlie buys 2 ETH which beats the decayed threshold
        vm.roll(b0 + 2100);
        vm.prank(charlie);
        kothRouter.buy{value: 2 ether}(0);
        require(kothHook.currentKing() == charlie, "charlie not king");
        emit log_named_address("Block 2100: charlie is king", charlie);

        // Dave buys a small amount while charlie is king — gives charlie a kingBalance for forfeit
        vm.roll(b0 + 2100);
        vm.prank(dave);
        kothRouter.buy{value: 0.1 ether}(0);
        require(kothHook.currentKing() == charlie, "charlie still king after dave small buy");
        emit log_named_uint("Block 2100: charlie kingBalance (wei)", kothHook.kingBalances(charlie));

        // Charlie dumps → loses crown
        vm.roll(b0 + 2101);
        vm.startPrank(charlie);
        koth.approve(address(kothRouter), type(uint256).max);
        kothRouter.sell(koth.balanceOf(charlie) / 4, 0);
        vm.stopPrank();
        require(kothHook.currentKing() == address(0), "throne should be empty");
        emit log_string("Block 2101: charlie dumped, throne empty");

        // Dave buys cheap to take empty throne
        vm.roll(b0 + 2102);
        vm.prank(dave);
        kothRouter.buy{value: 0.01 ether}(0);
        require(kothHook.currentKing() == dave, "dave not king");
        emit log_named_address("Block 2102: dave is king", dave);

        // Skip past 24h forfeit window for charlie
        vm.roll(b0 + 2101 + kothHook.FORFEIT_BLOCKS() + 1);
        uint256 supplyPre = koth.totalSupply();
        vm.prank(keeper);
        kothHook.forfeit(charlie, 0);
        require(koth.totalSupply() < supplyPre, "supply should decrease");
        emit log_named_uint("Forfeit burned KOTH", supplyPre - koth.totalSupply());
    }
}
