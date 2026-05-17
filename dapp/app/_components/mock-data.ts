/**
 * Placeholder values until task #20 wires real wagmi reads.
 */
export const mockKing = {
  reignRoman: 'VII',           // current reign sequence
  decreeRoman: 'CXLVII',       // count of dethronings so far
  currentKing: '0x7f3a4c2bd8e295Ab0E1cF6e8d2c4A983E1d5c8d72',
  kingEarningsETH: 12.847,
  thresholdETH: 1.337,         // decayedRecord × 1.03
  decayedRecordETH: 1.298,
  recordETH: 2.85,             // all-time peak buy
  decayBlocksElapsed: 2316,
  decayBlocksTotal: 3600,
  blockNumber: 18_453_219,
  reignStartedAt: 18_447_851,
};

export const mockStats = {
  totalSupplyKOTH: 985_715,
  totalSupplyMaxKOTH: 1_000_000,
  treasuryETH: 47.21,
  burnedKOTH: 14_285,
};

export const mockPricing = {
  kothPerEth: 1847.4,
  ethPerKoth: 1 / 1847.4,
  userEthBalance: 1.247,
  userKothBalance: 3_240,
};
