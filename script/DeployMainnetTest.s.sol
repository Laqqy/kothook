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
import {KESTToken} from "src/KESTToken.sol";
import {KingOfTheHillHook} from "src/KingOfTheHillHook.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";
import {ChronicleSoul} from "src/ChronicleSoul.sol";
import {ChronicleScroll} from "src/ChronicleScroll.sol";

import {HookMiner} from "./HookMiner.sol";
import {IERC20Minimal} from "v4-core/src/interfaces/external/IERC20Minimal.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";

/// @notice MAINNET TEST deploy of KEST (test token), seeded via the canonical
///         Uniswap v4 PositionManager. Same liquidity path as production
///         DeployMainnet — proves the full mint-NFT flow works end-to-end on
///         mainnet before committing the real KOTH deploy.
///
///         Defaults: 100% of supply + 0.005 ETH into LP, 0.0005 ETH test buy.
///         After deploy, the deployer:
///           1. Owns an ERC-721 LP NFT (no one else can withdraw)
///           2. Has made a 0.0005 ETH verification buy (became king)
contract DeployMainnetTest is Script {
    address internal constant MAINNET_POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    address internal constant MAINNET_POSITION_MANAGER = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    uint160 internal constant HOOK_FLAGS = 0x00CC;
    int24   internal constant TICK_LOWER = -887220;
    int24   internal constant TICK_UPPER =  887220;
    /// @dev Full token supply (constant in KOTHToken).
    uint256 internal constant TOTAL_SUPPLY = 1_000_000 ether;
    uint256 internal constant MAINNET_CHAIN_ID = 1;

    uint48 internal constant PERMIT2_EXPIRATION = type(uint48).max;
    uint256 internal constant MINT_DEADLINE_BUFFER = 600;

    /// @dev Verification buy size right after liquidity seed.
    uint256 internal constant TEST_BUY_WEI = 0.0005 ether;

    struct Deployment {
        address poolManager;
        address positionManager;
        address kest;
        address soul;
        address scroll;
        address hook;
        address kothRouter;
        address treasury;
        uint256 lpTokenId;
        uint256 kestBoughtByDeployer;
    }

    function run() external returns (Deployment memory d) {
        require(block.chainid == MAINNET_CHAIN_ID, "Not mainnet - refusing");
        require(MAINNET_POOL_MANAGER.code.length > 0, "PoolManager missing");
        require(MAINNET_POSITION_MANAGER.code.length > 0, "PositionManager missing");
        require(PERMIT2.code.length > 0, "Permit2 missing");

        uint256 pkEnv = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = pkEnv != 0 ? vm.addr(pkEnv) : msg.sender;
        require(deployer != address(0), "Deployer unresolved");

        address treasury = vm.envOr("TREASURY", deployer);
        if (treasury == deployer) {
            console.log(unicode"⚠️  TREASURY = deployer. Single key controls all fees.");
        }

        // Defaults: 0.005 ETH + 100% of KEST supply (1M tokens) at full range.
        // The initial price is *derived* from these two amounts — it's the only
        // sqrtP that lets us deposit both at the same time.
        uint256 seedEth = vm.envOr("SEED_ETH", uint256(0.005 ether));
        uint256 seedKest = vm.envOr("SEED_KEST", TOTAL_SUPPLY);

        require(
            deployer.balance >= seedEth + TEST_BUY_WEI + 0.04 ether,
            "Deployer ETH insufficient (need >=0.0455 ETH + gas)"
        );

        // For a full-range position:
        //   amount0 ≈ L / sqrtP        amount1 ≈ L * sqrtP
        //   → L = sqrt(amount0 * amount1),    sqrtP = sqrt(amount1 / amount0)
        // We derive sqrtPriceX96 by computing sqrt(amount1 * 2^192 / amount0)
        // staged via two integer sqrts to avoid overflow:
        //   sqrtPriceX96 = (sqrt(amount1) << 96) / sqrt(amount0)
        uint256 sqrtA1 = FixedPointMathLib.sqrt(seedKest);
        uint256 sqrtA0 = FixedPointMathLib.sqrt(seedEth);
        require(sqrtA0 > 0, "seed ETH too small");
        uint160 initialSqrtPriceX96 = uint160((sqrtA1 << 96) / sqrtA0);
        // Uniswap's modifyLiquidity rounds each side UP when adding liquidity,
        // so L_raw * sqrtP can need a few hundred extra wei of token1 than the
        // ideal `amount1 = L * sqrtP` suggests. Shave 0.001% off L to guarantee
        // we never request more than the deployer's actual KEST/ETH balance.
        uint128 liquidity =
            uint128(FixedPointMathLib.sqrt(seedEth * seedKest) * 99_999 / 100_000);

        IPoolManager manager = IPoolManager(MAINNET_POOL_MANAGER);
        d.poolManager = MAINNET_POOL_MANAGER;
        d.positionManager = MAINNET_POSITION_MANAGER;
        d.treasury = treasury;

        console.log("=== KEST Mainnet TEST Deploy (PositionManager) ===");
        console.log("Deployer  :", deployer);
        console.log("Treasury  :", treasury);
        console.log("SEED_ETH  :", seedEth);
        console.log("SEED_KEST :", seedKest);
        console.log("LIQUIDITY :", uint256(liquidity));
        console.log("sqrtP_X96 :", uint256(initialSqrtPriceX96));
        console.log("TEST_BUY  :", TEST_BUY_WEI);

        uint64 nonce = vm.getNonce(deployer);
        address predictedKest        = vm.computeCreateAddress(deployer, nonce + 0);
        address predictedSoul        = vm.computeCreateAddress(deployer, nonce + 2);
        address predictedScroll      = vm.computeCreateAddress(deployer, nonce + 3);
        address predictedKothRouter  = vm.computeCreateAddress(deployer, nonce + 4);

        bytes memory hookCreationCode = type(KingOfTheHillHook).creationCode;
        bytes memory hookCtorArgs = abi.encode(
            manager,
            KOTHToken(predictedKest),
            ChronicleSoul(predictedSoul),
            ChronicleScroll(predictedScroll),
            treasury,
            predictedKothRouter,
            deployer
        );
        (address minedHook, bytes32 hookSalt) = HookMiner.find(HOOK_FLAGS, hookCreationCode, hookCtorArgs);
        console.log("[mine] hook addr :", minedHook);
        console.log("[mine] hook salt :", uint256(hookSalt));

        if (pkEnv != 0) vm.startBroadcast(pkEnv);
        else            vm.startBroadcast();

        // 1. KESTToken (with PoolManager + PositionManager exempt from anti-snipe)
        address[] memory exemptions = new address[](2);
        exemptions[0] = address(manager);
        exemptions[1] = MAINNET_POSITION_MANAGER;
        KESTToken kest = new KESTToken(exemptions);
        require(address(kest) == predictedKest, "kest nonce drift");
        d.kest = address(kest);

        // 2. Hook via CREATE2
        bytes memory initCode = bytes.concat(hookCreationCode, hookCtorArgs);
        (bool ok, bytes memory ret) = CREATE2_DEPLOYER.call(bytes.concat(hookSalt, initCode));
        require(ok, "CREATE2 hook deploy failed");
        address deployedHook;
        if (ret.length >= 20) {
            assembly { deployedHook := mload(add(ret, 20)) }
        } else {
            deployedHook = minedHook;
        }
        require(deployedHook == minedHook, "hook addr mismatch");
        require(minedHook.code.length > 0, "hook code missing");
        d.hook = minedHook;

        // 3. Soul / Scroll / KOTHRouter
        ChronicleSoul soul = new ChronicleSoul(minedHook);
        require(address(soul) == predictedSoul, "soul nonce drift");
        d.soul = address(soul);

        ChronicleScroll scroll = new ChronicleScroll(minedHook, treasury);
        require(address(scroll) == predictedScroll, "scroll nonce drift");
        d.scroll = address(scroll);

        KOTHRouter kothRouter = new KOTHRouter(manager, kest, KingOfTheHillHook(payable(minedHook)));
        require(address(kothRouter) == predictedKothRouter, "kothRouter nonce drift");
        d.kothRouter = address(kothRouter);

        // 4. Bind + initialize pool
        kest.setHook(minedHook);
        KingOfTheHillHook hook = KingOfTheHillHook(payable(minedHook));
        hook.seedRecord(0, 0);

        Currency cEth = Currency.wrap(address(0));
        Currency cKest = Currency.wrap(address(kest));
        PoolKey memory pk_ = PoolKey({
            currency0: cEth,
            currency1: cKest,
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(minedHook)
        });
        hook.initializePoolKey(pk_);
        kothRouter.initializePool(pk_);
        manager.initialize(pk_, initialSqrtPriceX96);

        // 5. Permit2 dance
        IERC20Minimal(address(kest)).approve(PERMIT2, type(uint256).max);
        IAllowanceTransfer(PERMIT2).approve(
            address(kest),
            MAINNET_POSITION_MANAGER,
            type(uint160).max,
            PERMIT2_EXPIRATION
        );

        // 6. Mint LP NFT
        uint256 tokenId = IPositionManager(MAINNET_POSITION_MANAGER).nextTokenId();
        d.lpTokenId = tokenId;

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
        params[1] = abi.encode(cEth, cKest);

        IPositionManager(MAINNET_POSITION_MANAGER).modifyLiquidities{value: seedEth}(
            abi.encode(actions, params),
            block.timestamp + MINT_DEADLINE_BUFFER
        );

        // 7. VERIFICATION BUY
        uint256 kestBefore = kest.balanceOf(deployer);
        d.kestBoughtByDeployer = kothRouter.buy{value: TEST_BUY_WEI}(0);
        uint256 kestAfter = kest.balanceOf(deployer);
        require(kestAfter > kestBefore, "Test buy did not deliver KEST");

        // 8. Renounce admin on all three. Same flow we run on mainnet —
        //    keeps the test deploy representative.
        kest.renounceAdmin();
        hook.renounceAdmin();
        kothRouter.renounceAdmin();

        vm.stopBroadcast();

        console.log("=== KEST Mainnet TEST Deploy Complete ===");
        console.log("PoolManager      :", d.poolManager);
        console.log("PositionManager  :", d.positionManager);
        console.log("KESTToken        :", d.kest);
        console.log("ChronicleSoul    :", d.soul);
        console.log("ChronicleScroll  :", d.scroll);
        console.log("KingOfTheHillHook:", d.hook);
        console.log("KOTHRouter       :", d.kothRouter);
        console.log("Treasury         :", d.treasury);
        console.log("LP NFT tokenId   :", d.lpTokenId);
        console.log("");
        console.log("Verification buy : ", d.kestBoughtByDeployer, " KEST (wei)");
        console.log("");
        console.log("LP NFT owner - verify:");
        console.log("  cast call", d.positionManager, "'ownerOf(uint256)(address)'", d.lpTokenId);
    }
}
