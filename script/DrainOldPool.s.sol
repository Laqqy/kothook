// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";

/// @notice One-shot script: removes the deployer's residual liquidity from the
///         narrow-range pool of the *first* (orphaned) Sepolia deploy and
///         returns the remaining ETH + KOTH back to the deployer.
contract DrainOldPool is Script {
    // First (orphaned) Sepolia deploy from 2026-05-13.
    address constant OLD_KOTH = 0xEbFc47535909F2AC08Cc041D2445bCaf07730565;
    address constant OLD_HOOK = 0x92F87604bA6be55237375EF09C687240d5BAC0Cc;
    address constant OLD_MLR  = 0xe99c1420C42E096Adaae6A96fa6C2f57EC1D8207;

    // Cumulative L added across initial seed (350e15) and the top-up (1.9e18).
    int256 constant TOTAL_LIQUIDITY = -int256(uint256(2.25e18));

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(OLD_KOTH),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(OLD_HOOK)
        });

        console.log("Deployer:", deployer);
        console.log("Deployer ETH before :", deployer.balance);

        vm.startBroadcast(pk);
        PoolModifyLiquidityTest(OLD_MLR).modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: -6000,
                tickUpper: 6000,
                liquidityDelta: TOTAL_LIQUIDITY,
                salt: 0
            }),
            ""
        );
        vm.stopBroadcast();

        console.log("Deployer ETH after  :", deployer.balance);
    }
}
