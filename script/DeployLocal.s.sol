// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Constants} from "v4-core/test/utils/Constants.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";

import {KOTHToken} from "src/KOTHToken.sol";
import {KingOfTheHillHook} from "src/KingOfTheHillHook.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";
import {ChronicleSoul} from "src/ChronicleSoul.sol";
import {ChronicleScroll} from "src/ChronicleScroll.sol";

/// @notice Deploy the full KOTH stack to a local Anvil. The hook needs to live at
///         an address whose low byte encodes Uniswap v4's permission flags
///         (BEFORE_SWAP | AFTER_SWAP | BEFORE_SWAP_RETURNS_DELTA |
///         AFTER_SWAP_RETURNS_DELTA = 0xCC). On a real chain that requires
///         CREATE2 mining; on Anvil we cheat with `anvil_setCode` via vm.rpc.
///
/// Usage:
///     anvil &
///     PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
///         forge script script/DeployLocal.s.sol --rpc-url http://localhost:8545 --broadcast
contract DeployLocal is Script {
    address internal constant HOOK_ADDR = address(uint160(0x1100_0000_00CC));

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
        address treasury = vm.envOr("TREASURY", vm.addr(pk));
        address deployer = vm.addr(pk);

        // ─── Phase 1: deploy contracts that don't depend on the hook address ───
        vm.startBroadcast(pk);

        PoolManager manager = new PoolManager(deployer);
        d.poolManager = address(manager);

        PoolModifyLiquidityTest modifyLiquidityRouter = new PoolModifyLiquidityTest(IPoolManager(address(manager)));
        d.modifyLiquidityRouter = address(modifyLiquidityRouter);

        address[] memory exemptions = new address[](2);
        exemptions[0] = address(manager);
        exemptions[1] = address(modifyLiquidityRouter);
        KOTHToken koth = new KOTHToken(exemptions);
        d.koth = address(koth);

        ChronicleSoul soul = new ChronicleSoul(HOOK_ADDR);
        ChronicleScroll scroll = new ChronicleScroll(HOOK_ADDR, treasury);
        d.soul = address(soul);
        d.scroll = address(scroll);

        KOTHRouter kothRouter = new KOTHRouter(IPoolManager(address(manager)), koth, KingOfTheHillHook(payable(HOOK_ADDR)));
        d.kothRouter = address(kothRouter);

        // Deploy the hook implementation at some throwaway CREATE address.
        // Its runtime code is what we'll copy onto HOOK_ADDR below.
        KingOfTheHillHook impl = new KingOfTheHillHook(
            IPoolManager(address(manager)),
            koth,
            soul,
            scroll,
            treasury,
            address(kothRouter)
        );

        vm.stopBroadcast();

        // ─── Phase 2: place the hook bytecode at HOOK_ADDR ────────────────────
        // vm.etch updates *simulation* state for the rest of this script
        // (so the calls below resolve against the right code) and vm.rpc tells
        // the live Anvil node to do the same. Both are needed: forge runs the
        // script in simulation first, then re-runs with --broadcast.
        bytes memory hookCode = address(impl).code;
        vm.etch(HOOK_ADDR, hookCode);

        // anvil_setCode takes ["0xaddr","0xcode"] as a JSON array.
        string memory params = string.concat(
            '["',
            vm.toString(HOOK_ADDR),
            '","',
            vm.toString(hookCode),
            '"]'
        );
        vm.rpc("anvil_setCode", params);

        d.hook = HOOK_ADDR;
        d.treasury = treasury;

        // ─── Phase 3: bind everything, init pool, seed liquidity ──────────────
        vm.startBroadcast(pk);

        KingOfTheHillHook hook = KingOfTheHillHook(payable(HOOK_ADDR));

        koth.setHook(HOOK_ADDR);
        hook.seedRecord(0, 0);

        Currency cEth = Currency.wrap(address(0));
        Currency cKoth = Currency.wrap(address(koth));
        PoolKey memory pk_ = PoolKey({
            currency0: cEth,
            currency1: cKoth,
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(HOOK_ADDR)
        });

        hook.initializePoolKey(pk_);
        kothRouter.initializePool(pk_);

        manager.initialize(pk_, Constants.SQRT_PRICE_1_1);

        koth.approve(address(modifyLiquidityRouter), type(uint256).max);
        // Wider range (~±82% price) than the old ±12% so single buys of a few
        // ETH don't push price out of range. With L=1_000e18 in ticks
        // [-6000, 6000] starting at sqrtP=1:1 the position consumes about
        // ~260 ETH and ~260 KOTH from the seed.
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -6000,
            tickUpper: 6000,
            liquidityDelta: 1_000e18,
            salt: 0
        });
        modifyLiquidityRouter.modifyLiquidity{value: 300 ether}(pk_, liqParams, "");

        vm.stopBroadcast();

        console.log("=== KOTH Local Deployment ===");
        console.log("PoolManager           :", d.poolManager);
        console.log("modifyLiquidityRouter :", d.modifyLiquidityRouter);
        console.log("KOTHToken             :", d.koth);
        console.log("ChronicleSoul         :", d.soul);
        console.log("ChronicleScroll       :", d.scroll);
        console.log("KingOfTheHillHook     :", d.hook);
        console.log("KOTHRouter            :", d.kothRouter);
        console.log("Treasury              :", d.treasury);
    }
}
