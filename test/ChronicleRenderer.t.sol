// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import {ChronicleRenderer} from "src/ChronicleRenderer.sol";
import {Reign, REASON_OVERTHROWN} from "src/Types.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

contract ChronicleRendererTest is Test {
    function test_RenderProducesParseableJson() public pure {
        Reign memory r = Reign({
            king: address(0xCAFE),
            reignId: 7,
            startBlock: 100,
            endBlock: 500,
            ethEarned: 1.234 ether,
            recordHigh: 2.5 ether,
            dethroneReason: REASON_OVERTHROWN
        });
        string memory uri = ChronicleRenderer.render(r, "Soul");

        // Must start with the data-URI prefix
        bytes memory uriBytes = bytes(uri);
        bytes memory prefix = bytes("data:application/json;base64,");
        require(uriBytes.length > prefix.length, "uri too short");
        for (uint i = 0; i < prefix.length; ++i) {
            require(uriBytes[i] == prefix[i], "wrong prefix");
        }

        // Decode payload
        string memory b64 = _slice(uri, prefix.length, uriBytes.length);
        bytes memory decoded = Base64.decode(b64);
        require(decoded.length > 0, "empty payload");
        // Sanity: payload must contain "Soul" and "data:image/svg+xml" markers somewhere
        require(_contains(string(decoded), "Soul"), "missing variant marker");
        require(_contains(string(decoded), "data:image/svg+xml"), "missing image data uri");
    }

    function _slice(string memory s, uint start, uint end) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory r = new bytes(end - start);
        for (uint i = 0; i < r.length; ++i) r[i] = b[start + i];
        return string(r);
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint i = 0; i <= h.length - n.length; ++i) {
            bool match_ = true;
            for (uint j = 0; j < n.length; ++j) {
                if (h[i+j] != n[j]) { match_ = false; break; }
            }
            if (match_) return true;
        }
        return false;
    }
}
