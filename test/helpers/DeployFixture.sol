// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Constants} from "v4-core/test/utils/Constants.sol";

import {KOTHToken} from "src/KOTHToken.sol";
import {KingOfTheHillHook} from "src/KingOfTheHillHook.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";
import {ChronicleSoul} from "src/ChronicleSoul.sol";
import {ChronicleScroll} from "src/ChronicleScroll.sol";

/// @notice Deploys the full KOTH stack on top of v4-core's Deployers helper.
///         Uses vm.etch to place the hook at an address with the correct permission flag bits.
abstract contract DeployFixture is Test, Deployers {
    KOTHToken          internal koth;
    KingOfTheHillHook  internal kothHook;
    KOTHRouter         internal kothRouter;
    ChronicleSoul      internal soul;
    ChronicleScroll    internal scroll;
    PoolKey            internal pk;
    address            internal treasury = makeAddr("treasury");

    /// @dev Permission flag bits we need on the hook address (low byte 0xCC):
    ///      BEFORE_SWAP_FLAG (1<<7) | AFTER_SWAP_FLAG (1<<6) |
    ///      BEFORE_SWAP_RETURNS_DELTA_FLAG (1<<3) | AFTER_SWAP_RETURNS_DELTA_FLAG (1<<2)
    ///      = 0xCC. Anything above bit 13 is fine; we use 0x1100_0000_00CC for clarity.
    address internal constant HOOK_ADDR = address(uint160(0x1100_0000_00CC));

    function _deployStack() internal {
        // 1. v4 PoolManager + helper routers
        deployFreshManagerAndRouters();

        // 2. KOTHToken with PoolManager + modifyLiquidityRouter + swapRouter exempted
        address[] memory exemptions = new address[](3);
        exemptions[0] = address(manager);
        exemptions[1] = address(modifyLiquidityRouter);
        exemptions[2] = address(swapRouter);
        koth = new KOTHToken(exemptions);

        // 3. Chronicles bound to the future hook address
        soul = new ChronicleSoul(HOOK_ADDR);
        scroll = new ChronicleScroll(HOOK_ADDR, treasury);

        // 4. Router referencing the future hook (cast — hook impl will land at HOOK_ADDR via vm.etch)
        kothRouter = new KOTHRouter(IPoolManager(address(manager)), koth, KingOfTheHillHook(payable(HOOK_ADDR)));

        // 5. Exempt router (must be done after deploy)
        // KOTHToken stores exemptions only in constructor for now; the plan adds setExempt later.
        // Until that lands, we transfer through the router won't trigger anti-sniper because we
        // roll past SNIPER_BLOCKS in setUp. For early-block tests we explicitly set exempt below
        // once setExempt is added.

        // 6. Deploy hook impl with full constructor args, then etch its code at HOOK_ADDR
        KingOfTheHillHook impl = new KingOfTheHillHook(
            IPoolManager(address(manager)),
            koth,
            soul,
            scroll,
            treasury,
            address(kothRouter)
        );
        vm.etch(HOOK_ADDR, address(impl).code);

        kothHook = KingOfTheHillHook(payable(HOOK_ADDR));

        // 7. Bind token <-> hook (also exempts hook from anti-sniper)
        koth.setHook(HOOK_ADDR);

        // 8. Build the PoolKey: currency0 = ETH (address(0)), currency1 = KOTH
        Currency cEth = Currency.wrap(address(0));
        Currency cKoth = Currency.wrap(address(koth));
        // Native ETH (address(0)) sorts first; sanity:
        assertLt(uint160(address(0)), uint160(address(koth)));

        pk = PoolKey({
            currency0: cEth,
            currency1: cKoth,
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(HOOK_ADDR)
        });

        // 9. Bind poolKey to hook + router
        kothHook.initializePoolKey(pk);
        kothRouter.initializePool(pk);

        // 10. Initialize the v4 pool at sqrtPriceX96 = 1:1
        manager.initialize(pk, Constants.SQRT_PRICE_1_1);

        // 11. Roll past anti-sniper window so most tests don't trip the 1% wallet cap.
        //     Tests that specifically test anti-sniper deploy a fresh KOTHToken in their own setup.
        vm.roll(block.number + 101);
    }
}
