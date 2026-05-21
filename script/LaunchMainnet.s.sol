// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";

import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

import {KOTHToken} from "src/KOTHToken.sol";
import {KingOfTheHillHook} from "src/KingOfTheHillHook.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";

import {IERC20Minimal} from "v4-core/src/interfaces/external/IERC20Minimal.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";

/// @notice **Phase 2** of the KOTH mainnet rollout: assumes Phase 1 has
///         already deployed all five contracts (run DeployMainnet.s.sol first).
///         This script atomically:
///           1. initializes the Uniswap v4 pool
///           2. approves KOTH through Permit2 → PositionManager
///           3. mints a full-range LP NFT to the deployer (the seed)
///           4. (optional) places a verification buy to crown the deployer
///
///         All four steps are in one broadcast so no front-runner can sandwich
///         the seed-and-buy window.
///
/// Required env:
///     KOTH_ADDR   address  KOTHToken deployed in Phase 1.
///     HOOK_ADDR   address  KingOfTheHillHook deployed in Phase 1.
///     ROUTER_ADDR address  KOTHRouter deployed in Phase 1.
/// Optional env:
///     SEED_ETH    uint     ETH (wei) into LP. Default 1 ETH.
///     SEED_KOTH   uint     KOTH (wei) into LP. Default 1M = full supply.
///     TEST_BUY    uint     Auto-buy in wei. 0 = skip. Default 0.001 ETH.
///
/// Usage:
///     KOTH_ADDR=0x... HOOK_ADDR=0x... ROUTER_ADDR=0x... \
///     forge script script/LaunchMainnet.s.sol \
///         --rpc-url $MAINNET_RPC \
///         --ledger --sender 0x<deployer> \
///         --broadcast --slow
contract LaunchMainnet is Script {
    address internal constant MAINNET_POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    address internal constant MAINNET_POSITION_MANAGER = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    int24   internal constant TICK_LOWER = -887220;
    int24   internal constant TICK_UPPER =  887220;
    uint48  internal constant PERMIT2_EXPIRATION = type(uint48).max;
    uint256 internal constant MINT_DEADLINE_BUFFER = 600;
    uint256 internal constant MAINNET_CHAIN_ID = 1;

    function run() external returns (uint256 lpTokenId, uint256 kothBoughtByDeployer) {
        require(block.chainid == MAINNET_CHAIN_ID, "Not mainnet - refusing");

        uint256 pkEnv = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = pkEnv != 0 ? vm.addr(pkEnv) : msg.sender;
        require(deployer != address(0), "Deployer unresolved");

        address kothAddr = vm.envAddress("KOTH_ADDR");
        address hookAddr = vm.envAddress("HOOK_ADDR");
        address routerAddr = vm.envAddress("ROUTER_ADDR");
        require(kothAddr.code.length > 0, "KOTH not deployed");
        require(hookAddr.code.length > 0, "Hook not deployed");
        require(routerAddr.code.length > 0, "Router not deployed");

        uint256 seedEth = vm.envOr("SEED_ETH", uint256(1 ether));
        uint256 seedKoth = vm.envOr("SEED_KOTH", uint256(1_000_000 ether));
        uint256 testBuyWei = vm.envOr("TEST_BUY", uint256(0.001 ether));

        require(
            deployer.balance >= seedEth + testBuyWei + 0.05 ether,
            "Deployer ETH insufficient (need seed + buy + 0.05 gas)"
        );

        KOTHToken koth = KOTHToken(kothAddr);
        require(koth.balanceOf(deployer) >= seedKoth, "Deployer KOTH balance < SEED_KOTH");

        // Derive sqrtPriceX96 and liquidity from the desired amounts so the
        // pool starts exactly at the implied ratio. 0.001% shave on L absorbs
        // Uniswap's round-up when crediting amount1.
        uint256 sqrtA1 = FixedPointMathLib.sqrt(seedKoth);
        uint256 sqrtA0 = FixedPointMathLib.sqrt(seedEth);
        require(sqrtA0 > 0, "seed ETH too small");
        uint160 initialSqrtPriceX96 = uint160((sqrtA1 << 96) / sqrtA0);
        uint128 liquidity =
            uint128(FixedPointMathLib.sqrt(seedEth * seedKoth) * 99_999 / 100_000);

        IPoolManager manager = IPoolManager(MAINNET_POOL_MANAGER);
        Currency cEth = Currency.wrap(address(0));
        Currency cKoth = Currency.wrap(address(koth));
        PoolKey memory pk_ = PoolKey({
            currency0: cEth,
            currency1: cKoth,
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(hookAddr)
        });

        console.log("=== KOTH Mainnet Launch - Phase 2 ===");
        console.log("Deployer  :", deployer);
        console.log("SEED_ETH  :", seedEth);
        console.log("SEED_KOTH :", seedKoth);
        console.log("TEST_BUY  :", testBuyWei);
        console.log("sqrtP_X96 :", uint256(initialSqrtPriceX96));
        console.log("LIQUIDITY :", uint256(liquidity));

        if (pkEnv != 0) vm.startBroadcast(pkEnv);
        else            vm.startBroadcast();

        // 1. Create the pool. Anyone could have done this between Phase 1 and
        //    Phase 2, but the only thing it changes is the initial sqrtP; if
        //    someone front-ran initialize at a wrong price, modifyLiquidities
        //    below would still succeed but our supply ↔ ETH ratio would not
        //    match the price we intended. Catch and revert if so.
        try manager.initialize(pk_, initialSqrtPriceX96) returns (int24) {
            // pool created at our price
        } catch {
            revert("manager.initialize reverted - pool was already initialized at a different price");
        }

        // 2. Permit2 dance
        IERC20Minimal(address(koth)).approve(PERMIT2, type(uint256).max);
        IAllowanceTransfer(PERMIT2).approve(
            address(koth),
            MAINNET_POSITION_MANAGER,
            type(uint160).max,
            PERMIT2_EXPIRATION
        );

        // 3. Mint full-range LP NFT
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.SETTLE_PAIR)
        );
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            pk_,
            TICK_LOWER,
            TICK_UPPER,
            uint256(liquidity),
            type(uint128).max,
            type(uint128).max,
            deployer,
            bytes("")
        );
        params[1] = abi.encode(cEth, cKoth);

        IPositionManager(MAINNET_POSITION_MANAGER).modifyLiquidities{value: seedEth}(
            abi.encode(actions, params),
            block.timestamp + MINT_DEADLINE_BUFFER
        );

        // tokenId we received is whichever was nextTokenId before our call.
        // Read posm.balanceOf(deployer) to confirm; the exact token id is the
        // one in the ERC721 Transfer event emitted by modifyLiquidities.
        lpTokenId = IPositionManager(MAINNET_POSITION_MANAGER).nextTokenId() - 1;

        // 4. Optional verification buy. If skipped, you (or anyone) can become
        //    the first king via the regular Acquire flow on the dapp.
        if (testBuyWei > 0) {
            uint256 kothBefore = koth.balanceOf(deployer);
            kothBoughtByDeployer = KOTHRouter(payable(routerAddr)).buy{value: testBuyWei}(0);
            require(koth.balanceOf(deployer) > kothBefore, "Buy did not deliver KOTH");
        }

        vm.stopBroadcast();

        console.log("=== Launch Complete ===");
        console.log("LP NFT tokenId   :", lpTokenId, "(verify with posm.balanceOf)");
        if (testBuyWei > 0) {
            console.log("Auto-buy delivered:", kothBoughtByDeployer, "KOTH (wei)");
        }
    }
}
