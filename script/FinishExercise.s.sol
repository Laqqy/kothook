// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import {KingOfTheHillHook} from "src/KingOfTheHillHook.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";

/// @notice Resumes SeedAndExercise from stage 5: tops up tester gas, performs
///         overthrow, deployer claims.
contract FinishExercise is Script {
    address constant HOOK = 0x92F87604bA6be55237375EF09C687240d5BAC0Cc;
    address payable constant KOTH_ROUTER = payable(0xEA7D75E16F9D196a65Ac2CeA1B03107aF28c3A03);

    bytes32 internal constant TESTER_SEED = keccak256("koth-sepolia-tester-2026-05-13-v1");

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        uint256 testerPk = uint256(TESTER_SEED);
        address deployer = vm.addr(deployerPk);
        address tester = vm.addr(testerPk);

        console.log("Deployer:", deployer);
        console.log("Tester  :", tester);
        console.log("Tester ETH before top-up:", tester.balance);

        // Top up tester with extra gas budget.
        vm.startBroadcast(deployerPk);
        (bool ok,) = tester.call{value: 0.01 ether}("");
        require(ok, "top-up failed");
        vm.stopBroadcast();

        // Overthrow.
        console.log("[overthrow] Tester buys 0.06 ETH");
        vm.startBroadcast(testerPk);
        KOTHRouter(KOTH_ROUTER).buy{value: 0.06 ether}(0);
        vm.stopBroadcast();

        // Deployer claims accumulated balance.
        console.log("[claim] Deployer pulls accumulated ETH");
        uint256 before = deployer.balance;
        vm.startBroadcast(deployerPk);
        KingOfTheHillHook(payable(HOOK)).claim();
        vm.stopBroadcast();

        console.log("");
        console.log("=== Final state ===");
        console.log("Current king        :", KingOfTheHillHook(payable(HOOK)).currentKing());
        console.log("Highest buy amount  :", KingOfTheHillHook(payable(HOOK)).highestBuyAmount());
        console.log("Reigns count        :", KingOfTheHillHook(payable(HOOK)).reignsCount());
        console.log("Deployer kingBalance:", KingOfTheHillHook(payable(HOOK)).kingBalances(deployer));
        console.log("Tester kingBalance  :", KingOfTheHillHook(payable(HOOK)).kingBalances(tester));
        console.log("Deployer ETH delta  :", deployer.balance - before);
    }
}
