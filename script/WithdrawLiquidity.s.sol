// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";

/// @notice Burns the LP NFT minted by DeployMainnet[Test].s.sol and returns
///         the underlying ETH + TOKEN to the deployer. Uses PositionManager's
///         BURN_POSITION + TAKE_PAIR actions — only the NFT owner can call.
///
/// Required env:
///     PRIVATE_KEY     deployer key (only owner of the LP NFT can burn it)
///     POSITION_MANAGER  canonical Uniswap v4 PositionManager
///                       (mainnet: 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e)
///     HOOK            our KingOfTheHillHook address
///     TOKEN           KOTH / KEHT address (pool's currency1)
///     LP_TOKEN_ID     ERC-721 tokenId of the position (printed by deploy script)
contract WithdrawLiquidity is Script {
    uint256 internal constant BURN_DEADLINE_BUFFER = 600;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address positionManager = vm.envAddress("POSITION_MANAGER");
        address hook = vm.envAddress("HOOK");
        address token = vm.envAddress("TOKEN");
        uint256 tokenId = vm.envUint("LP_TOKEN_ID");

        address recipient = vm.addr(pk);

        console.log("=== Burn LP Position ===");
        console.log("Recipient        :", recipient);
        console.log("PositionManager  :", positionManager);
        console.log("LP tokenId       :", tokenId);
        console.log("Hook             :", hook);
        console.log("Token (currency1):", token);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(token),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });

        bytes memory actions = abi.encodePacked(
            uint8(Actions.BURN_POSITION),
            uint8(Actions.TAKE_PAIR)
        );
        bytes[] memory params = new bytes[](2);
        // BURN_POSITION(tokenId, amount0Min, amount1Min, hookData)
        params[0] = abi.encode(tokenId, uint128(0), uint128(0), bytes(""));
        // TAKE_PAIR(currency0, currency1, recipient)
        params[1] = abi.encode(key.currency0, key.currency1, recipient);

        vm.startBroadcast(pk);
        IPositionManager(positionManager).modifyLiquidities(
            abi.encode(actions, params),
            block.timestamp + BURN_DEADLINE_BUFFER
        );
        vm.stopBroadcast();

        console.log("");
        console.log("Burn complete. ETH + TOKEN sent to recipient.");
    }
}
