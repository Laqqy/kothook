// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {KOTHToken} from "./KOTHToken.sol";

/// @notice Test variant of KOTHToken with display ticker "KEST".
/// @dev    Inherits the entire KOTHToken implementation — identical storage,
///         identical anti-sniper, identical burnFromHook gating. Only the
///         `name()` and `symbol()` view functions are overridden so wallets
///         and Etherscan show this token as KEST, separating it from the
///         eventual production KOTH deploy.
contract KESTToken is KOTHToken {
    constructor(address[] memory exemptions) KOTHToken(exemptions) {}

    function name() public pure override returns (string memory) {
        return "King of the Hill TEST";
    }

    function symbol() public pure override returns (string memory) {
        return "KEST";
    }
}
