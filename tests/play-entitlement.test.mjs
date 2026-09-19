import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isEntitledState } from '../server/play-billing.js'

/*
 * Caught in a live test: cancelling a subscription took access away that
 * instant, while nearly two minutes of paid time remained. Google moves a
 * cancelled subscription to SUBSCRIPTION_STATE_CANCELED and keeps it there
 * until the expiry date; treating that as "not entitled" wrote status
 * 'expired', and every access check requires status 'active'.
 */
describe('which Play states still owe the member access', () => {
  test('an active subscription is entitled', () => {
    assert.equal(isEntitledState('SUBSCRIPTION_STATE_ACTIVE'), true)
  })

  test('a grace period is entitled', () => {
    // A renewal Google is still retrying. Cutting access punishes someone
    // whose card merely expired.
    assert.equal(isEntitledState('SUBSCRIPTION_STATE_IN_GRACE_PERIOD'), true)
  })

  test('a cancelled but unexpired subscription is entitled', () => {
    // The regression this file exists for. They paid for the period; turning
    // off auto-renew does not hand the time back.
    assert.equal(isEntitledState('SUBSCRIPTION_STATE_CANCELED'), true)
  })

  test('an expired subscription is not', () => {
    assert.equal(isEntitledState('SUBSCRIPTION_STATE_EXPIRED'), false)
  })

  test('on hold is not — payment failed and retries are exhausted', () => {
    assert.equal(isEntitledState('SUBSCRIPTION_STATE_ON_HOLD'), false)
  })

  test('paused is not — the member chose to suspend it', () => {
    assert.equal(isEntitledState('SUBSCRIPTION_STATE_PAUSED'), false)
  })

  test('pending is not — nothing has been paid yet', () => {
    assert.equal(isEntitledState('SUBSCRIPTION_STATE_PENDING'), false)
  })

  test('an unknown or missing state is not entitled', () => {
    // Fail closed: a state Google adds later must not hand out free access.
    assert.equal(isEntitledState('SUBSCRIPTION_STATE_UNSPECIFIED'), false)
    assert.equal(isEntitledState('SOMETHING_GOOGLE_ADDS_IN_2027'), false)
    assert.equal(isEntitledState(undefined), false)
    assert.equal(isEntitledState(null), false)
  })
})
