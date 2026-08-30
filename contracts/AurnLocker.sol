// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AurnLocker
 * @notice A trustless, non-custodial ERC-20 time-lock for Robinhood Chain (id 4663).
 *
 * A holder locks supply of any ERC-20 for a fixed term. The tokens are held by
 * this contract and can ONLY be withdrawn by the same wallet that locked them,
 * and ONLY after the unlock time. There is no owner, no admin, no pause, and no
 * upgrade path — nobody (not even the deployer) can move, sweep, or unlock
 * another wallet's tokens. That is the whole point of a locker.
 *
 * Design notes:
 *  - Locks are pull-based: `withdraw` follows checks-effects-interactions and is
 *    guarded against reentrancy, so a malicious token cannot double-withdraw.
 *  - Fee-on-transfer tokens are supported: the amount recorded is what actually
 *    arrived (measured by balance delta), not the requested amount.
 *  - A lock can be topped up (`increase`) or extended (`extend`), but never
 *    shortened — an extend can only push the unlock time further out.
 *  - MAX_DURATION is a guardrail against fat-finger "lock for 10000 years".
 *
 * Caveats to understand before using:
 *  - Rebasing tokens whose balance shrinks are not fully supported: the recorded
 *    amount is fixed at lock time, so a downward rebase could leave the contract
 *    unable to pay it out. Do not lock negative-rebasing tokens.
 *  - This code is provided as-is. Get it audited and test on a testnet before
 *    locking meaningful value.
 */
contract AurnLocker is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Lock {
        address token;    // the locked ERC-20
        uint256 amount;   // amount still locked (0 after withdrawal)
        uint64 lockedAt;  // unix seconds when the lock was created
        uint64 unlockAt;  // unix seconds when withdrawal becomes possible
        bool withdrawn;   // true once withdrawn
    }

    /// @dev 10 years — a sanity ceiling, not a policy. Presets in the app are far shorter.
    uint256 public constant MAX_DURATION = 3650 days;

    /// owner => their locks (append-only; withdrawn locks stay for history)
    mapping(address => Lock[]) private _locks;

    event Locked(address indexed owner, uint256 indexed lockId, address indexed token, uint256 amount, uint64 unlockAt);
    event Increased(address indexed owner, uint256 indexed lockId, uint256 addedAmount, uint256 newAmount);
    event Extended(address indexed owner, uint256 indexed lockId, uint64 newUnlockAt);
    event Withdrawn(address indexed owner, uint256 indexed lockId, address indexed token, uint256 amount);

    error ZeroAmount();
    error ZeroDuration();
    error DurationTooLong();
    error BadLockId();
    error AlreadyWithdrawn();
    error StillLocked();
    error NotLater();

    // ─────────────────────────────────────────────────────────────────────────
    // Write
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Lock `amount` of `token` for `duration` seconds.
     * @dev Caller must `approve` this contract for `amount` first.
     * @return lockId the caller's index for this lock (0-based, per wallet).
     */
    function lock(address token, uint256 amount, uint256 duration)
        external
        nonReentrant
        returns (uint256 lockId)
    {
        if (amount == 0) revert ZeroAmount();
        if (duration == 0) revert ZeroDuration();
        if (duration > MAX_DURATION) revert DurationTooLong();

        uint256 received = _pull(IERC20(token), amount);

        uint64 unlockAt = uint64(block.timestamp + duration);
        _locks[msg.sender].push(
            Lock({token: token, amount: received, lockedAt: uint64(block.timestamp), unlockAt: unlockAt, withdrawn: false})
        );
        lockId = _locks[msg.sender].length - 1;
        emit Locked(msg.sender, lockId, token, received, unlockAt);
    }

    /**
     * @notice Add more of the same token to an existing, not-yet-withdrawn lock.
     * @dev Does not change the unlock time. Caller must `approve` first.
     */
    function increase(uint256 lockId, uint256 amount) external nonReentrant {
        Lock storage l = _mine(lockId);
        if (l.withdrawn) revert AlreadyWithdrawn();
        if (amount == 0) revert ZeroAmount();

        uint256 received = _pull(IERC20(l.token), amount);
        l.amount += received;
        emit Increased(msg.sender, lockId, received, l.amount);
    }

    /**
     * @notice Extend a lock by `addDuration` seconds. Can only push the unlock
     *         time later — never earlier.
     */
    function extend(uint256 lockId, uint256 addDuration) external {
        Lock storage l = _mine(lockId);
        if (l.withdrawn) revert AlreadyWithdrawn();
        if (addDuration == 0) revert ZeroDuration();

        // Extend from the later of "now" or the current unlock, so extending an
        // already-matured lock still adds real time.
        uint256 base = block.timestamp > l.unlockAt ? block.timestamp : l.unlockAt;
        uint256 newUnlock = base + addDuration;
        if (newUnlock <= l.unlockAt) revert NotLater();
        if (newUnlock - l.lockedAt > MAX_DURATION) revert DurationTooLong();

        l.unlockAt = uint64(newUnlock);
        emit Extended(msg.sender, lockId, l.unlockAt);
    }

    /**
     * @notice Withdraw a matured lock back to the caller.
     * @dev Reverts unless the caller owns the lock and block.timestamp >= unlockAt.
     */
    function withdraw(uint256 lockId) external nonReentrant {
        Lock storage l = _mine(lockId);
        if (l.withdrawn) revert AlreadyWithdrawn();
        if (block.timestamp < l.unlockAt) revert StillLocked();

        uint256 amt = l.amount;
        l.withdrawn = true;
        l.amount = 0;
        emit Withdrawn(msg.sender, lockId, l.token, amt);
        IERC20(l.token).safeTransfer(msg.sender, amt);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Every lock (active, matured and withdrawn) for `owner`.
    function locksOf(address owner) external view returns (Lock[] memory) {
        return _locks[owner];
    }

    /// @notice One lock by index.
    function getLock(address owner, uint256 lockId) external view returns (Lock memory) {
        if (lockId >= _locks[owner].length) revert BadLockId();
        return _locks[owner][lockId];
    }

    /// @notice How many lock records `owner` has (including withdrawn ones).
    function lockCount(address owner) external view returns (uint256) {
        return _locks[owner].length;
    }

    /// @notice Seconds remaining until a lock unlocks (0 if matured or withdrawn).
    function timeLeft(address owner, uint256 lockId) external view returns (uint256) {
        if (lockId >= _locks[owner].length) revert BadLockId();
        Lock storage l = _locks[owner][lockId];
        if (l.withdrawn || block.timestamp >= l.unlockAt) return 0;
        return l.unlockAt - block.timestamp;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _mine(uint256 lockId) private view returns (Lock storage l) {
        Lock[] storage arr = _locks[msg.sender];
        if (lockId >= arr.length) revert BadLockId();
        l = arr[lockId];
    }

    /// @dev Pull `amount` from the caller and return the amount actually received.
    function _pull(IERC20 token, uint256 amount) private returns (uint256 received) {
        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        received = token.balanceOf(address(this)) - balBefore;
        if (received == 0) revert ZeroAmount();
    }
}
