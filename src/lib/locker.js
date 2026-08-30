import { parseAbi } from 'viem'

/**
 * AurnLocker - the on-chain token time-lock (contracts/AurnLocker.sol).
 *
 * Set NEXT_PUBLIC_LOCKER_ADDRESS to the deployed address to turn the Locked page
 * on-chain. Until then LOCKER_ADDRESS is empty and the page shows a clear
 * "not live yet" note. Non-custodial: every lock/unlock is signed by the owner.
 */
export const LOCKER_ADDRESS = (process.env.NEXT_PUBLIC_LOCKER_ADDRESS || '').trim()
export const lockerLive = /^0x[a-fA-F0-9]{40}$/.test(LOCKER_ADDRESS)

export const lockerAbi = parseAbi([
  'function lock(address token, uint256 amount, uint64 unlockAt) returns (uint256 id)',
  'function unlock(uint256 id)',
  'function locksCount() view returns (uint256)',
  'function getLock(uint256 id) view returns ((address owner,address token,uint256 amount,uint64 lockedAt,uint64 unlockAt,bool withdrawn))',
  'function getLocks(uint256 start, uint256 count) view returns ((address owner,address token,uint256 amount,uint64 lockedAt,uint64 unlockAt,bool withdrawn)[])',
  'function ownerLockIds(address owner) view returns (uint256[])',
  'function tokenLockIds(address token) view returns (uint256[])',
  'function totalLocked(address token) view returns (uint256)',
  'event Locked(uint256 indexed id, address indexed owner, address indexed token, uint256 amount, uint64 unlockAt)',
  'event Unlocked(uint256 indexed id, address indexed owner, address indexed token, uint256 amount)',
])

export const erc20ApproveAbi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
])
