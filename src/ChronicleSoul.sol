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

    function _update(address to, uint256 tokenId, address auth)
        internal override returns (address)
    {
        address from = _ownerOf(tokenId);
        // allow mint (from == 0) and burn (to == 0); block transfer
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override { revert Soulbound(); }
    function setApprovalForAll(address, bool) public pure override { revert Soulbound(); }
}
