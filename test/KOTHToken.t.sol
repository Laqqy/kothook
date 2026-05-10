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
        assertEq(token.totalSupply(), 10_000_000 ether);
        assertEq(token.balanceOf(deployer), 10_000_000 ether);
        assertEq(token.name(), "King of the Hill");
        assertEq(token.symbol(), "KOTH");
        assertEq(token.decimals(), 18);
    }

    function test_AntiSniperBlocksLargeTransfer() public {
        address victim = makeAddr("victim");
        uint256 maxAllowed = (10_000_000 ether * 100) / 10_000;   // 100_000 ether
        uint256 oneOver = maxAllowed + 1;

        vm.expectRevert(
            abi.encodeWithSelector(KOTHToken.AntiSniperLimit.selector, oneOver, maxAllowed)
        );
        token.transfer(victim, oneOver);
    }

    function test_AntiSniperAllowsAtLimit() public {
        address victim = makeAddr("victim");
        uint256 maxAllowed = (10_000_000 ether * 100) / 10_000;
        token.transfer(victim, maxAllowed);
        assertEq(token.balanceOf(victim), maxAllowed);
    }
}
