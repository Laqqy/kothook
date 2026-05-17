// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {KOTHToken} from "src/KOTHToken.sol";
import {KingOfTheHillHook} from "src/KingOfTheHillHook.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";

/// @notice Sepolia post-deploy script: tops up pool liquidity, funds a
///         secondary EOA, and walks through the full king flow
///         (ascend → fees → overthrow → claim).
///
/// Usage:
///     PRIVATE_KEY=<deployer> \
///         forge script script/SeedAndExercise.s.sol \
///         --rpc-url $SEPOLIA_RPC --broadcast --slow
///
/// The tester key is derived deterministically from a seed string below so we
/// don't reuse a known anvil key (those have sweep bots on Sepolia).
contract SeedAndExercise is Script {
    // Sepolia deployment from 2026-05-13.
    address constant MLR  = 0xe99c1420C42E096Adaae6A96fa6C2f57EC1D8207;
    address constant KOTH = 0xEbFc47535909F2AC08Cc041D2445bCaf07730565;
    address constant HOOK = 0x92F87604bA6be55237375EF09C687240d5BAC0Cc;
    address payable constant KOTH_ROUTER = payable(0xEA7D75E16F9D196a65Ac2CeA1B03107aF28c3A03);

    /// @dev Unique seed; the derived address must be untouched on Sepolia.
    bytes32 internal constant TESTER_SEED = keccak256("koth-sepolia-tester-2026-05-13-v1");

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        uint256 testerPk = uint256(TESTER_SEED);
        address deployer = vm.addr(deployerPk);
        address tester = vm.addr(testerPk);

        // Refuse to fund an address that already has bytecode (e.g. a sweep
        // bot at a known anvil address). With a fresh keccak-derived key
        // this should always be empty.
        require(tester.code.length == 0, "tester address has bytecode");

        console.log("Deployer:", deployer);
        console.log("Tester  :", tester);
        console.log("");

        // ─── Stage 1: top up liquidity (deployer) ──────────────────────────
        Currency cEth  = Currency.wrap(address(0));
        Currency cKoth = Currency.wrap(KOTH);
        PoolKey memory key = PoolKey({
            currency0: cEth,
            currency1: cKoth,
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });

        console.log("[stage 1] Adding 1.9e18 liquidity (~0.49 ETH + 0.49 KOTH)");
        vm.startBroadcast(deployerPk);
        PoolModifyLiquidityTest(MLR).modifyLiquidity{value: 0.5 ether}(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: -6000,
                tickUpper: 6000,
                liquidityDelta: int256(uint256(1.9e18)),
                salt: 0
            }),
            ""
        );
        vm.stopBroadcast();

        // ─── Stage 2: fund tester ──────────────────────────────────────────
        console.log("[stage 2] Funding tester with 0.1 ETH");
        vm.startBroadcast(deployerPk);
        (bool ok,) = tester.call{value: 0.1 ether}("");
        require(ok, "fund tester failed");
        vm.stopBroadcast();

        // ─── Stage 3: deployer becomes king ────────────────────────────────
        console.log("[stage 3] Deployer ascends with 0.05 ETH");
        vm.startBroadcast(deployerPk);
        KOTHRouter(KOTH_ROUTER).buy{value: 0.05 ether}(0);
        vm.stopBroadcast();

        // ─── Stage 4: tester pays king fees twice without unseating ────────
        console.log("[stage 4] Tester pays king fees (0.02 ETH x 2)");
        vm.startBroadcast(testerPk);
        // Approve KOTH for the router so a later sell would work — not used
        // in this flow but cheaper to bundle now.
        IERC20(KOTH).approve(KOTH_ROUTER, type(uint256).max);
        KOTHRouter(KOTH_ROUTER).buy{value: 0.02 ether}(0);
        KOTHRouter(KOTH_ROUTER).buy{value: 0.02 ether}(0);
        vm.stopBroadcast();

        // ─── Stage 5: tester overthrows ────────────────────────────────────
        console.log("[stage 5] Tester usurps the throne with 0.06 ETH");
        vm.startBroadcast(testerPk);
        KOTHRouter(KOTH_ROUTER).buy{value: 0.06 ether}(0);
        vm.stopBroadcast();

        // ─── Stage 6: deployer claims accumulated king balance ─────────────
        console.log("[stage 6] Deployer claims accumulated ETH");
        vm.startBroadcast(deployerPk);
        KingOfTheHillHook(payable(HOOK)).claim();
        vm.stopBroadcast();

        // ─── Final state log ───────────────────────────────────────────────
        console.log("");
        console.log("=== Post-test state ===");
        console.log("Current king        :", KingOfTheHillHook(payable(HOOK)).currentKing());
        console.log("Highest buy amount  :", KingOfTheHillHook(payable(HOOK)).highestBuyAmount());
        console.log("Reigns count        :", KingOfTheHillHook(payable(HOOK)).reignsCount());
        console.log("Deployer kingBalance:", KingOfTheHillHook(payable(HOOK)).kingBalances(deployer));
        console.log("Tester kingBalance  :", KingOfTheHillHook(payable(HOOK)).kingBalances(tester));
        console.log("Deployer ETH        :", deployer.balance);
        console.log("Tester ETH          :", tester.balance);
    }
}
