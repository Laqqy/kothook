// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Reign} from "./Types.sol";

library ChronicleRenderer {
    using Strings for uint256;

    function render(Reign memory r, string memory variant) internal pure returns (string memory) {
        string memory svg = _buildSVG(r, variant);
        string memory json = string.concat(
            '{"name":"KOTH Chronicle ', variant, ' #', r.reignId.toString(),
            '","description":"On-chain record of reign by ', _shortAddr(r.king), '",',
            '"attributes":[',
                '{"trait_type":"King","value":"', Strings.toHexString(uint256(uint160(r.king)), 20), '"},',
                '{"trait_type":"Reign ID","value":', r.reignId.toString(), '},',
                '{"trait_type":"Start Block","value":', r.startBlock.toString(), '},',
                '{"trait_type":"End Block","value":', r.endBlock.toString(), '},',
                '{"trait_type":"Duration Blocks","value":', (r.endBlock - r.startBlock).toString(), '},',
                '{"trait_type":"ETH Earned (wei)","value":"', r.ethEarned.toString(), '"},',
                '{"trait_type":"Record High (wei)","value":"', r.recordHigh.toString(), '"},',
                '{"trait_type":"Dethrone Reason","value":"', _bytes32ToString(r.dethroneReason), '"}',
            '],',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _buildSVG(Reign memory r, string memory variant) internal pure returns (string memory) {
        string memory borderColor = keccak256(bytes(variant)) == keccak256("Soul") ? "#FFD700" : "#C0C0C0";
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">',
                '<rect width="400" height="500" fill="#0D0D14"/>',
                '<rect x="10" y="10" width="380" height="480" fill="none" stroke="', borderColor, '" stroke-width="3"/>',
                '<text x="200" y="60" font-family="Georgia,serif" font-size="40" fill="', borderColor, '" text-anchor="middle">CROWN</text>',
                '<text x="200" y="110" font-family="Georgia,serif" font-size="22" fill="#FFFFFF" text-anchor="middle">Chronicle ', variant, '</text>',
                '<text x="200" y="170" font-family="monospace" font-size="14" fill="#AAAAAA" text-anchor="middle">King: ', _shortAddr(r.king), '</text>',
                '<text x="200" y="210" font-family="monospace" font-size="14" fill="#AAAAAA" text-anchor="middle">Reign #', r.reignId.toString(), '</text>',
                '<text x="200" y="250" font-family="monospace" font-size="13" fill="#AAAAAA" text-anchor="middle">Blocks ', r.startBlock.toString(), ' - ', r.endBlock.toString(), '</text>',
                '<text x="200" y="300" font-family="monospace" font-size="13" fill="#AAAAAA" text-anchor="middle">ETH earned: ', _formatEthShort(r.ethEarned), '</text>',
                '<text x="200" y="330" font-family="monospace" font-size="13" fill="#AAAAAA" text-anchor="middle">Record: ', _formatEthShort(r.recordHigh), '</text>',
                '<text x="200" y="380" font-family="monospace" font-size="13" fill="', borderColor, '" text-anchor="middle">', _bytes32ToString(r.dethroneReason), '</text>',
            '</svg>'
        );
    }

    function _shortAddr(address a) internal pure returns (string memory) {
        string memory full = Strings.toHexString(uint256(uint160(a)), 20);
        bytes memory fb = bytes(full);
        // 0xABCD...EFGH
        bytes memory out = new bytes(13);
        for (uint i; i < 6; ++i) out[i] = fb[i];
        out[6] = '.'; out[7] = '.'; out[8] = '.';
        for (uint i; i < 4; ++i) out[9 + i] = fb[fb.length - 4 + i];
        return string(out);
    }

    function _formatEthShort(uint256 wei_) internal pure returns (string memory) {
        // returns string like "1.234 ETH" with 3 decimals (truncated)
        uint256 whole = wei_ / 1 ether;
        uint256 frac = (wei_ % 1 ether) / 1e15;     // milli-eth
        bytes memory fracStr = bytes(frac.toString());
        // pad to 3 chars
        while (fracStr.length < 3) {
            bytes memory newStr = new bytes(fracStr.length + 1);
            newStr[0] = '0';
            for (uint i; i < fracStr.length; ++i) newStr[i+1] = fracStr[i];
            fracStr = newStr;
        }
        return string.concat(whole.toString(), '.', string(fracStr), ' ETH');
    }

    function _bytes32ToString(bytes32 b) internal pure returns (string memory) {
        uint256 len;
        while (len < 32 && b[len] != 0) ++len;
        bytes memory out = new bytes(len);
        for (uint i; i < len; ++i) out[i] = b[i];
        return string(out);
    }
}
