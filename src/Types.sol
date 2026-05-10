// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

struct Reign {
    address king;
    uint256 reignId;
    uint256 startBlock;
    uint256 endBlock;
    uint256 ethEarned;
    uint256 recordHigh;
    bytes32 dethroneReason;     // "OVERTHROWN" | "DUMP" | "FORFEIT"
}

bytes32 constant REASON_OVERTHROWN = "OVERTHROWN";
bytes32 constant REASON_DUMP       = "DUMP";
bytes32 constant REASON_FORFEIT    = "FORFEIT";
