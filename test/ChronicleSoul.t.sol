// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import {ChronicleSoul} from "src/ChronicleSoul.sol";
import {Reign, REASON_OVERTHROWN} from "src/Types.sol";

contract ChronicleSoulTest is Test {
    ChronicleSoul soul;
    address hook = makeAddr("hook");
    address king = makeAddr("king");

    function setUp() public {
        soul = new ChronicleSoul(hook);
    }

    function _reign(uint256 id) internal view returns (Reign memory) {
        return Reign({
            king: king,
            reignId: id,
            startBlock: 100,
            endBlock: 200,
            ethEarned: 1 ether,
            recordHigh: 2 ether,
            dethroneReason: REASON_OVERTHROWN
        });
    }

    function test_HookCanMint() public {
        vm.prank(hook);
        soul.mintReign(king, 0, _reign(0));
        assertEq(soul.ownerOf(0), king);
        assertEq(soul.balanceOf(king), 1);
    }

    function test_NonHookCannotMint() public {
        vm.expectRevert(ChronicleSoul.OnlyHook.selector);
        soul.mintReign(king, 0, _reign(0));
    }

    function test_TransferFromReverts() public {
        vm.prank(hook);
        soul.mintReign(king, 0, _reign(0));

        vm.prank(king);
        vm.expectRevert(ChronicleSoul.Soulbound.selector);
        soul.transferFrom(king, address(0xBEEF), 0);
    }

    function test_SafeTransferFromReverts() public {
        vm.prank(hook);
        soul.mintReign(king, 0, _reign(0));

        vm.prank(king);
        vm.expectRevert(ChronicleSoul.Soulbound.selector);
        soul.safeTransferFrom(king, address(0xBEEF), 0);
    }

    function test_ApproveReverts() public {
        vm.prank(hook);
        soul.mintReign(king, 0, _reign(0));

        vm.prank(king);
        vm.expectRevert(ChronicleSoul.Soulbound.selector);
        soul.approve(address(0xBEEF), 0);
    }

    function test_SetApprovalForAllReverts() public {
        vm.prank(king);
        vm.expectRevert(ChronicleSoul.Soulbound.selector);
        soul.setApprovalForAll(address(0xBEEF), true);
    }

    function test_TokenURIDecodesToJson() public {
        vm.prank(hook);
        soul.mintReign(king, 0, _reign(0));
        string memory uri = soul.tokenURI(0);
        bytes memory uriB = bytes(uri);
        bytes memory prefix = bytes("data:application/json;base64,");
        assertGt(uriB.length, prefix.length);
        for (uint i; i < prefix.length; ++i) assertEq(uriB[i], prefix[i]);
    }
}
