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

/// @notice Deploy the full KOTH stack to a local Anvil. Uses vm.etch to place the
///         hook at an address with the required permission flag bits — same trick
///         the test fixture uses. Real-mainnet deploy needs CREATE2 mining (future).
///
/// Usage:
///     anvil &
///     PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
///         forge script script/DeployLocal.s.sol --rpc-url http://localhost:8545 --broadcast
///
/// The default anvil mnemonic gives every test account 10,000 ETH, so the
/// 100-ETH liquidity seed at the end of `run()` succeeds. Without `--broadcast`
/// (i.e. pure simulation) the deployer's balance is 0 and the last
/// modifyLiquidity call reverts with OutOfFunds — that is expected, not a bug.
contract DeployLocal is Script {
    /// @dev Permission flag bits the hook must encode in its low byte:
    ///      BEFORE_SWAP_FLAG (1<<7) | AFTER_SWAP_FLAG (1<<6) |
    ///      BEFORE_SWAP_RETURNS_DELTA_FLAG (1<<3) | AFTER_SWAP_RETURNS_DELTA_FLAG (1<<2)
    ///      = 0xCC.
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

        vm.startBroadcast(pk);

        // 1. Fresh PoolManager
        PoolManager manager = new PoolManager(deployer);
        d.poolManager = address(manager);

        // 2. Helper router for adding liquidity
        PoolModifyLiquidityTest modifyLiquidityRouter = new PoolModifyLiquidityTest(IPoolManager(address(manager)));
        d.modifyLiquidityRouter = address(modifyLiquidityRouter);

        // 3. KOTHToken with PoolManager + modifyLiquidityRouter exempted
        address[] memory exemptions = new address[](2);
        exemptions[0] = address(manager);
        exemptions[1] = address(modifyLiquidityRouter);
        KOTHToken koth = new KOTHToken(exemptions);
        d.koth = address(koth);

        // 4. Chronicles bound to the future hook address
        ChronicleSoul soul = new ChronicleSoul(HOOK_ADDR);
        ChronicleScroll scroll = new ChronicleScroll(HOOK_ADDR, treasury);
        d.soul = address(soul);
        d.scroll = address(scroll);

        // 5. Router referencing the future hook (cast — hook impl will land at HOOK_ADDR via vm.etch)
        KOTHRouter kothRouter = new KOTHRouter(IPoolManager(address(manager)), koth, KingOfTheHillHook(payable(HOOK_ADDR)));
        d.kothRouter = address(kothRouter);

        // 6. Deploy hook impl with full constructor args, then etch its code at HOOK_ADDR
        KingOfTheHillHook impl = new KingOfTheHillHook(
            IPoolManager(address(manager)),
            koth,
            soul,
            scroll,
            treasury,
            address(kothRouter)
        );
        // vm.etch is a cheatcode — works on Anvil with --no-rate-limit + foundry's mode.
        // For real mainnet we'd need CREATE2 mining instead.
        vm.etch(HOOK_ADDR, address(impl).code);
        d.hook = HOOK_ADDR;
        d.treasury = treasury;

        KingOfTheHillHook hook = KingOfTheHillHook(payable(HOOK_ADDR));

        // 7. Bind token <-> hook
        koth.setHook(HOOK_ADDR);

        // 8. Lock the seedRecord one-shot in production deploy
        hook.seedRecord(0, 0);

        // 9. Build the PoolKey: currency0 = ETH (address(0)), currency1 = KOTH
        Currency cEth = Currency.wrap(address(0));
        Currency cKoth = Currency.wrap(address(koth));
        PoolKey memory pk_ = PoolKey({
            currency0: cEth,
            currency1: cKoth,
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(HOOK_ADDR)
        });

        // 10. Bind poolKey to hook + router
        hook.initializePoolKey(pk_);
        kothRouter.initializePool(pk_);

        // 11. Initialize the v4 pool at sqrtPriceX96 = 1:1
        manager.initialize(pk_, Constants.SQRT_PRICE_1_1);

        // 12. Seed initial liquidity — wide range around tick 0
        koth.approve(address(modifyLiquidityRouter), type(uint256).max);
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower: -1200,
            tickUpper: 1200,
            liquidityDelta: 1_000e18,
            salt: 0
        });
        modifyLiquidityRouter.modifyLiquidity{value: 100 ether}(pk_, liqParams, "");

        vm.stopBroadcast();

        // Log all addresses
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
