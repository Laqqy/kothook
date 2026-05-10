// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {DeployFixture} from "./helpers/DeployFixture.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";

contract KOTHRouterTest is DeployFixture {
    function setUp() public { _deployStack(); }

    function test_BuySlippageRevert() public {
        address alice = makeAddr("alice");
        deal(alice, 5 ether);
        vm.prank(alice);
        vm.expectRevert();   // InsufficientOutput
        kothRouter.buy{value: 1 ether}(type(uint256).max);
    }

    function test_BuyZeroValueRevert() public {
        vm.expectRevert();   // ZeroAmount
        kothRouter.buy{value: 0}(0);
    }

    function test_UnlockCallbackOnlyFromManager() public {
        vm.expectRevert();   // NotPoolManager
        kothRouter.unlockCallback("");
    }
}
