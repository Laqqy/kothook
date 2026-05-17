// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";

import {KOTHToken} from "src/KOTHToken.sol";
import {KingOfTheHillHook} from "src/KingOfTheHillHook.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";
import {ChronicleSoul} from "src/ChronicleSoul.sol";
import {ChronicleScroll} from "src/ChronicleScroll.sol";

import {HookMiner} from "./HookMiner.sol";

/// @notice Deploys the full KOTH stack to Sepolia using the canonical
///         Uniswap v4 PoolManager and Arachnid's CREATE2 factory.
///
/// Usage:
///     PRIVATE_KEY=0x... \
///         forge script script/DeploySepolia.s.sol \
///         --rpc-url $SEPOLIA_RPC \
///         --broadcast \
///         --slow
///
/// Optional envs:
///     TREASURY    address — defaults to deployer
///     SEED_ETH    uint    — ETH (wei) put into the seed liquidity (default 1.05e18)
///     LIQUIDITY   uint    — liquidityDelta (default 1e21 → 1 ETH + 1M KOTH full-range)
contract DeploySepolia is Script {
    /// @dev Canonical Uniswap v4 PoolManager on Sepolia (chain id 11155111).
    /// Source: https://developers.uniswap.org/contracts/v4/deployments
    address internal constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    /// @dev Arachnid's deterministic CREATE2 factory — pre-deployed on Sepolia.
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @dev Hook permission flags our contract claims: BEFORE_SWAP | AFTER_SWAP
    ///      | BEFORE_SWAP_RETURNS_DELTA | AFTER_SWAP_RETURNS_DELTA = 0xCC.
    uint160 internal constant HOOK_FLAGS = 0x00CC;

    /// @dev Initial price: 1 ETH = 1,000,000 KOTH ⇒ price (token1/token0) = 1e6
    ///      sqrtPriceX96 = sqrt(1e6) × 2^96 = 1000 × 2^96.
    uint160 internal constant INITIAL_SQRT_PRICE_X96 = 79228162514264337593543950336000;

    /// @dev Full-range usable ticks at tickSpacing=60.
    ///      TickMath.MIN_TICK = -887272, rounded up to the nearest multiple of 60.
    int24 internal constant TICK_LOWER = -887220;
    int24 internal constant TICK_UPPER = 887220;

    struct Deployment {
        address poolManager;
        address modifyLiquidityRouter;
        address koth;
        address soul;
        address scroll;
        address hook;
        address kothRouter;
        address treasury;
    }

    function run() external returns (Deployment memory d) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address treasury = vm.envOr("TREASURY", deployer);
        // Full-range pool, price 1 ETH = 1M KOTH (sqrtP = 1000):
        //   amount0 ≈ L / sqrtP, amount1 ≈ L × sqrtP
        //   For 1 ETH (1e18) + 1M KOTH (1e24): L = 1e21.
        // Send a tiny extra ETH so rounding rounds in our favour; excess
        // settles back to the deployer as a currency credit.
        uint256 seedEth = vm.envOr("SEED_ETH", uint256(1.05 ether));
        uint256 liquidityDelta = vm.envOr("LIQUIDITY", uint256(1e21));

        IPoolManager manager = IPoolManager(SEPOLIA_POOL_MANAGER);
        d.poolManager = SEPOLIA_POOL_MANAGER;
        d.treasury = treasury;

        // ─── Predict CREATE addresses based on current deployer nonce ──────────
        // The CREATE2 hook deploy is a *call* from the deployer to Arachnid's
        // factory, so it bumps the deployer's nonce by one even though no
        // CREATE happens from the EOA. We skip nonce+2 for that reason.
        uint64 nonce = vm.getNonce(deployer);
        address predictedRouter = vm.computeCreateAddress(deployer, nonce + 0);
        address predictedKoth   = vm.computeCreateAddress(deployer, nonce + 1);
        address predictedSoul   = vm.computeCreateAddress(deployer, nonce + 3);
        address predictedScroll = vm.computeCreateAddress(deployer, nonce + 4);
        address predictedKothRouter = vm.computeCreateAddress(deployer, nonce + 5);

        // ─── Mine CREATE2 salt for the hook ────────────────────────────────────
        bytes memory hookCreationCode = type(KingOfTheHillHook).creationCode;
        bytes memory hookCtorArgs = abi.encode(
            manager,
            KOTHToken(predictedKoth),
            ChronicleSoul(predictedSoul),
            ChronicleScroll(predictedScroll),
            treasury,
            predictedKothRouter,
            deployer   // admin — gates setHook/seedRecord/initializePoolKey
        );

        (address minedHook, bytes32 hookSalt) = HookMiner.find(HOOK_FLAGS, hookCreationCode, hookCtorArgs);
        console.log("[mine] hook addr  :", minedHook);
        console.log("[mine] hook salt  :", uint256(hookSalt));

        // ─── Phase 1: deploy regular CREATE contracts ──────────────────────────
        vm.startBroadcast(pk);

        // 1. modifyLiquidityRouter — used only by us to seed initial liquidity.
        PoolModifyLiquidityTest modifyLiquidityRouter = new PoolModifyLiquidityTest(manager);
        require(address(modifyLiquidityRouter) == predictedRouter, "router nonce drift");
        d.modifyLiquidityRouter = address(modifyLiquidityRouter);

        // 2. KOTH — anti-snipe exempts: canonical PM + our seeding router.
        address[] memory exemptions = new address[](2);
        exemptions[0] = address(manager);
        exemptions[1] = address(modifyLiquidityRouter);
        KOTHToken koth = new KOTHToken(exemptions);
        require(address(koth) == predictedKoth, "koth nonce drift");
        d.koth = address(koth);

        // 3. Hook — CREATE2 via Arachnid's factory. Payload = salt || initCode.
        bytes memory initCode = bytes.concat(hookCreationCode, hookCtorArgs);
        (bool ok, bytes memory ret) = CREATE2_DEPLOYER.call(bytes.concat(hookSalt, initCode));
        require(ok, "CREATE2 hook deploy failed");
        // Factory returns the 20-byte address right-padded; decode defensively.
        address deployedHook;
        if (ret.length >= 20) {
            assembly { deployedHook := mload(add(ret, 20)) }
        } else {
            deployedHook = minedHook;
        }
        require(deployedHook == minedHook, "hook addr mismatch");
        require(minedHook.code.length > 0, "hook code missing");
        d.hook = minedHook;

        // 4-5-6. Soul / Scroll / KOTHRouter — all need the hook addr.
        ChronicleSoul soul = new ChronicleSoul(minedHook);
        require(address(soul) == predictedSoul, "soul nonce drift");
        d.soul = address(soul);

        ChronicleScroll scroll = new ChronicleScroll(minedHook, treasury);
        require(address(scroll) == predictedScroll, "scroll nonce drift");
        d.scroll = address(scroll);

        KOTHRouter kothRouter = new KOTHRouter(manager, koth, KingOfTheHillHook(payable(minedHook)));
        require(address(kothRouter) == predictedKothRouter, "kothRouter nonce drift");
        d.kothRouter = address(kothRouter);

        // ─── Phase 2: bind ────────────────────────────────────────────────────
        koth.setHook(minedHook);
        KingOfTheHillHook hook = KingOfTheHillHook(payable(minedHook));
        hook.seedRecord(0, 0);

        // ─── Phase 3: pool init + seed liquidity ──────────────────────────────
        Currency cEth = Currency.wrap(address(0));
        Currency cKoth = Currency.wrap(address(koth));
        PoolKey memory pk_ = PoolKey({
            currency0: cEth,
            currency1: cKoth,
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(minedHook)
        });

        hook.initializePoolKey(pk_);
        kothRouter.initializePool(pk_);
        manager.initialize(pk_, INITIAL_SQRT_PRICE_X96);

        koth.approve(address(modifyLiquidityRouter), type(uint256).max);
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: TICK_LOWER,
            tickUpper: TICK_UPPER,
            liquidityDelta: int256(liquidityDelta),
            salt: 0
        });
        modifyLiquidityRouter.modifyLiquidity{value: seedEth}(pk_, liqParams, "");

        vm.stopBroadcast();

        console.log("=== KOTH Sepolia Deployment ===");
        console.log("PoolManager (canonical):", d.poolManager);
        console.log("modifyLiquidityRouter  :", d.modifyLiquidityRouter);
        console.log("KOTHToken              :", d.koth);
        console.log("ChronicleSoul          :", d.soul);
        console.log("ChronicleScroll        :", d.scroll);
        console.log("KingOfTheHillHook      :", d.hook);
        console.log("KOTHRouter             :", d.kothRouter);
        console.log("Treasury               :", d.treasury);
    }
}
