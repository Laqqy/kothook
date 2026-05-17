// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title HookMiner
/// @notice Brute-forces a CREATE2 salt that produces a hook address whose
///         lower 14 bits encode the desired Uniswap v4 permission flags.
/// @dev    Uses Arachnid's deterministic deployer at
///         0x4e59b44847b379578588920cA78FbF26c0B4956C, which is pre-deployed
///         on virtually every EVM chain (Sepolia, mainnet, L2s).
library HookMiner {
    /// @dev Arachnid's CREATE2 factory. Constant across chains.
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @dev v4-core's flag mask: Hooks.ALL_HOOK_MASK = (1 << 14) - 1.
    uint160 internal constant FLAG_MASK = 0x3FFF;

    /// @notice Iterate salts until `address & FLAG_MASK == targetFlags`.
    /// @param targetFlags  Lower 14 bits the deployed address must carry.
    /// @param creationCode Output of `type(Hook).creationCode`.
    /// @param ctorArgs     ABI-encoded constructor arguments (use `abi.encode(...)`).
    /// @return hookAddress The CREATE2 address that satisfies the flag mask.
    /// @return salt        The salt that produces `hookAddress`.
    function find(
        uint160 targetFlags,
        bytes memory creationCode,
        bytes memory ctorArgs
    ) internal pure returns (address hookAddress, bytes32 salt) {
        bytes memory initCode = bytes.concat(creationCode, ctorArgs);
        bytes32 initCodeHash = keccak256(initCode);

        // 200k iterations covers ~3× the expected ~16k needed for 14-bit match.
        for (uint256 i; i < 200_000; ++i) {
            bytes32 candidate = bytes32(i);
            address predicted = computeAddress(candidate, initCodeHash);
            if (uint160(predicted) & FLAG_MASK == targetFlags) {
                return (predicted, candidate);
            }
        }
        revert("HookMiner: no salt found in 200k iterations");
    }

    /// @notice Compute the CREATE2 address for (salt, initCode).
    function computeAddress(bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(bytes1(0xff), CREATE2_DEPLOYER, salt, initCodeHash)
                    )
                )
            )
        );
    }
}
