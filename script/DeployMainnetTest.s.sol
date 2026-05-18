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
import {KEHTToken} from "src/KEHTToken.sol";
import {KingOfTheHillHook} from "src/KingOfTheHillHook.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";
import {ChronicleSoul} from "src/ChronicleSoul.sol";
import {ChronicleScroll} from "src/ChronicleScroll.sol";

import {HookMiner} from "./HookMiner.sol";
import {IERC20Minimal} from "v4-core/src/interfaces/external/IERC20Minimal.sol";

/// @notice MAINNET TEST deploy of KEHT (test token), seeded via the canonical
///         Uniswap v4 PositionManager. Same liquidity path as production
///         DeployMainnet — proves the full mint-NFT flow works end-to-end on
///         mainnet before committing the real KOTH deploy.
///
///         After deploy, the deployer:
///           1. Owns an ERC-721 LP NFT (no one else can withdraw)
///           2. Has made a 0.0001 ETH verification buy (became king)
contract DeployMainnetTest is Script {
    address internal constant MAINNET_POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    address internal constant MAINNET_POSITION_MANAGER = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    uint160 internal constant HOOK_FLAGS = 0x00CC;
    uint160 internal constant INITIAL_SQRT_PRICE_X96 = 79228162514264337593543950336000;
    int24   internal constant TICK_LOWER = -887220;
    int24   internal constant TICK_UPPER =  887220;
    uint256 internal constant MAINNET_CHAIN_ID = 1;

    uint48 internal constant PERMIT2_EXPIRATION = type(uint48).max;
    uint256 internal constant MINT_DEADLINE_BUFFER = 600;

    /// @dev Verification buy size right after liquidity seed.
    uint256 internal constant TEST_BUY_WEI = 0.0001 ether;

    struct Deployment {
        address poolManager;
        address positionManager;
        address keht;
        address soul;
        address scroll;
        address hook;
        address kothRouter;
        address treasury;
        uint256 lpTokenId;
        uint256 kehtBoughtByDeployer;
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

        // Test defaults: ~0.002 ETH + ~2000 KEHT in pool, 0.0001 ETH test buy.
        uint256 seedEth = vm.envOr("SEED_ETH", uint256(0.002 ether));
        uint256 liquidity = vm.envOr("LIQUIDITY", uint256(2e18));

        require(
            deployer.balance >= seedEth + TEST_BUY_WEI + 0.04 ether,
            "Deployer ETH insufficient (need >=0.05 ETH)"
        );

        IPoolManager manager = IPoolManager(MAINNET_POOL_MANAGER);
        d.poolManager = MAINNET_POOL_MANAGER;
        d.positionManager = MAINNET_POSITION_MANAGER;
        d.treasury = treasury;

        console.log("=== KEHT Mainnet TEST Deploy (PositionManager) ===");
        console.log("Deployer  :", deployer);
        console.log("Treasury  :", treasury);
        console.log("SEED_ETH  :", seedEth);
        console.log("LIQUIDITY :", liquidity);
        console.log("TEST_BUY  :", TEST_BUY_WEI);

        uint64 nonce = vm.getNonce(deployer);
        address predictedKeht        = vm.computeCreateAddress(deployer, nonce + 0);
        address predictedSoul        = vm.computeCreateAddress(deployer, nonce + 2);
        address predictedScroll      = vm.computeCreateAddress(deployer, nonce + 3);
        address predictedKothRouter  = vm.computeCreateAddress(deployer, nonce + 4);

        bytes memory hookCreationCode = type(KingOfTheHillHook).creationCode;
        bytes memory hookCtorArgs = abi.encode(
            manager,
            KOTHToken(predictedKeht),
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

        // 1. KEHTToken (with PoolManager + PositionManager exempt from anti-snipe)
        address[] memory exemptions = new address[](2);
        exemptions[0] = address(manager);
        exemptions[1] = MAINNET_POSITION_MANAGER;
        KEHTToken keht = new KEHTToken(exemptions);
        require(address(keht) == predictedKeht, "keht nonce drift");
        d.keht = address(keht);

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

        KOTHRouter kothRouter = new KOTHRouter(manager, keht, KingOfTheHillHook(payable(minedHook)));
        require(address(kothRouter) == predictedKothRouter, "kothRouter nonce drift");
        d.kothRouter = address(kothRouter);

        // 4. Bind + initialize pool
        keht.setHook(minedHook);
        KingOfTheHillHook hook = KingOfTheHillHook(payable(minedHook));
        hook.seedRecord(0, 0);

        Currency cEth = Currency.wrap(address(0));
        Currency cKeht = Currency.wrap(address(keht));
        PoolKey memory pk_ = PoolKey({
            currency0: cEth,
            currency1: cKeht,
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(minedHook)
        });
        hook.initializePoolKey(pk_);
        kothRouter.initializePool(pk_);
        manager.initialize(pk_, INITIAL_SQRT_PRICE_X96);

        // 5. Permit2 dance
        IERC20Minimal(address(keht)).approve(PERMIT2, type(uint256).max);
        IAllowanceTransfer(PERMIT2).approve(
            address(keht),
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
            liquidity,
            type(uint128).max,
            type(uint128).max,
            deployer,
            bytes("")
        );
        params[1] = abi.encode(cEth, cKeht);

        IPositionManager(MAINNET_POSITION_MANAGER).modifyLiquidities{value: seedEth}(
            abi.encode(actions, params),
            block.timestamp + MINT_DEADLINE_BUFFER
        );

        // 7. VERIFICATION BUY
        uint256 kehtBefore = keht.balanceOf(deployer);
        d.kehtBoughtByDeployer = kothRouter.buy{value: TEST_BUY_WEI}(0);
        uint256 kehtAfter = keht.balanceOf(deployer);
        require(kehtAfter > kehtBefore, "Test buy did not deliver KEHT");

        vm.stopBroadcast();

        console.log("=== KEHT Mainnet TEST Deploy Complete ===");
        console.log("PoolManager      :", d.poolManager);
        console.log("PositionManager  :", d.positionManager);
        console.log("KEHTToken        :", d.keht);
        console.log("ChronicleSoul    :", d.soul);
        console.log("ChronicleScroll  :", d.scroll);
        console.log("KingOfTheHillHook:", d.hook);
        console.log("KOTHRouter       :", d.kothRouter);
        console.log("Treasury         :", d.treasury);
        console.log("LP NFT tokenId   :", d.lpTokenId);
        console.log("");
        console.log("Verification buy : ", d.kehtBoughtByDeployer, " KEHT (wei)");
        console.log("");
        console.log("LP NFT owner - verify:");
        console.log("  cast call", d.positionManager, "'ownerOf(uint256)(address)'", d.lpTokenId);
    }
}
