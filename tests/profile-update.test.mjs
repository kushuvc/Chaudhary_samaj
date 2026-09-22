import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

/**
 * Saving the profile silently dropped most of what was typed.
 *
 * The app sends religion, caste, sub-caste, dosh, physical status, country,
 * state, village, eating habit and the horoscope fields under `profile`; the
 * update statement read some of them only from `matrimony` and others not at
 * all. And every column was written with COALESCE over a value that had been
 * through `|| null`, so clearing a field meant "keep what was there".
 */

let server
let member

before(async () => {
  server = await startServer()
  member = await signUpUser(server, { gender: 'male' })
})
after(async () => { await server?.stop() })

const save = (payload) =>
  server.request('PUT', '/api/matrimony/me', { token: member.token, body: payload })

const read = async () => {
  const res = await server.request('GET', '/api/matrimony/me', { token: member.token })
  assert.equal(res.status, 200)
  return res.body.data
}

describe('saving the profile', () => {
  test('fields the app sends under profile are stored', async () => {
    const res = await save({
      profile: {
        religion: 'Hindu',
        caste: 'Chaudhary',
        subCaste: 'Jat',
        dosh: 'no',
        physicalStatus: 'normal',
        country: 'India',
        state: 'Gujarat',
        village: 'Kadi',
        eatingHabit: 'vegetarian',
        horoscopeTime: '06:30',
        horoscopePlace: 'Ahmedabad',
      },
    })
    assert.equal(res.status, 200)

    const { profile } = await read()
    assert.equal(profile.religion, 'Hindu')
    assert.equal(profile.caste, 'Chaudhary')
    assert.equal(profile.subCaste, 'Jat')
    assert.equal(profile.dosh, 'no')
    assert.equal(profile.physicalStatus, 'normal')
    assert.equal(profile.country, 'India')
    assert.equal(profile.state, 'Gujarat')
    assert.equal(profile.village, 'Kadi')
    assert.equal(profile.eatingHabit, 'vegetarian')
    assert.equal(profile.horoscopeTime, '06:30')
    assert.equal(profile.horoscopePlace, 'Ahmedabad')
  })

  test('fields sent under matrimony are stored too', async () => {
    const res = await save({
      matrimony: {
        height: '66',
        maritalStatus: 'never_married',
        familyType: 'joint',
        fatherName: 'Ramesh',
        hobbies: ['Reading', 'Cricket'],
      },
    })
    assert.equal(res.status, 200)

    const { matrimony } = await read()
    assert.equal(matrimony.height, '66')
    assert.equal(matrimony.maritalStatus, 'never_married')
    assert.equal(matrimony.familyType, 'joint')
    assert.equal(matrimony.fatherName, 'Ramesh')
    assert.deepEqual(matrimony.hobbies, ['Reading', 'Cricket'])
  })

  test('a field can be cleared', async () => {
    await save({ profile: { village: 'Kadi' } })
    assert.equal((await read()).profile.village, 'Kadi')

    await save({ profile: { village: '' } })
    assert.equal((await read()).profile.village, '', 'clearing a field left the old value in place')
  })

  test('fields that were not sent are left alone', async () => {
    await save({ profile: { religion: 'Hindu', caste: 'Chaudhary' } })
    await save({ profile: { religion: 'Jain' } })

    const { profile } = await read()
    assert.equal(profile.religion, 'Jain')
    assert.equal(profile.caste, 'Chaudhary', 'an untouched field was wiped')
  })

  test('age follows the date of birth', async () => {
    const born = new Date(Date.now() - 30 * 365.25 * 864e5).toISOString().slice(0, 10)
    await save({ profile: { dateOfBirth: born } })
    const { matrimony } = await read()
    assert.ok(Math.abs(Number(matrimony.age) - 30) <= 1, `expected about 30, got ${matrimony.age}`)
  })

  test('gender still cannot be changed', async () => {
    await save({ profile: { gender: 'female' } })
    const { profile } = await read()
    assert.equal(profile.gender, 'male')
  })

  test('saving requires a session', async () => {
    const res = await server.request('PUT', '/api/matrimony/me', { body: { profile: { religion: 'Hindu' } } })
    assert.equal(res.status, 401)
  })
})
