// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Reign} from "./Types.sol";

contract ChronicleSoul is ERC721 {
    address public immutable hook;
    mapping(uint256 => Reign) public reigns;

    error OnlyHook();
    error Soulbound();

    constructor(address _hook) ERC721("KOTH Chronicle Soul", "KOTH-SOUL") {
        hook = _hook;
    }

    function mintReign(address to, uint256 reignId, Reign calldata data) external {
        if (msg.sender != hook) revert OnlyHook();
        reigns[reignId] = data;
        _safeMint(to, reignId);
    }
}
