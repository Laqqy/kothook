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
}
