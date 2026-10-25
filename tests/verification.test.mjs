import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { startServer, signUpUser } from './helpers/harness.mjs'
import { loadUidaiKeys, namesMatch, verifyAadhaarQr } from '../server/aadhaar-qr.js'

/*
 * Aadhaar verification, end to end.
 *
 * Real Secure QR codes are signed by UIDAI, whose private key we will never
 * have, so the server is pointed at a key made here and the tests sign their
 * own codes in the same layout. A second key stands in for a forger.
 */
const uidai = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const forger = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aadhaar-keys-'))
fs.writeFileSync(path.join(certDir, 'test-uidai.pem'), uidai.publicKey.export({ type: 'spki', format: 'pem' }))

function makeQr({
  name = 'Test User',
  dob = '01-01-1995',
  gender = 'M',
  last4 = '1234',
  key = uidai.privateKey,
  version = 'V2',
} = {}) {
  const fields = [
    '3', `${last4}20261018101500123`, name, dob, gender, 'S/O Ram', 'Mehsana', '', '12', 'Main Road',
    '384002', 'Mehsana', 'Gujarat', 'Station Road', 'Mehsana', 'Mehsana', '9876',
  ]
  const parts = [...(version ? [version] : []), ...fields].map((f) => Buffer.from(f, 'latin1'))
  const sep = Buffer.from([0xff])
  const text = Buffer.concat(parts.flatMap((p) => [p, sep]))
  // A stand-in photo with 0xFF bytes in it, as a real JPEG 2000 has.
  const photo = Buffer.concat([Buffer.from([0xff, 0x4f, 0xff, 0x51]), crypto.randomBytes(300), Buffer.from([0xff, 0xd9])])
  const signed = Buffer.concat([text, photo])
  const signature = crypto.sign('sha256', signed, key)
  const packed = zlib.gzipSync(Buffer.concat([signed, signature]))
  return BigInt(`0x${packed.toString('hex')}`).toString(10)
}

let server
let admin

before(async () => {
  server = await startServer({ env: { AADHAAR_CERT_DIR: certDir } })
  admin = await signUpUser(server, { gender: 'female' })
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
})
after(async () => {
  await server?.stop()
  fs.rmSync(certDir, { recursive: true, force: true })
})

const submit = (who, qr, consent = true) =>
  server.request('POST', '/api/verification/aadhaar', { token: who.token, body: { qr, consent } })

async function listedAs(viewer, userId, query = '') {
  const res = await server.request('GET', `/api/matrimony/profiles${query}`, { token: viewer.token })
  assert.equal(res.status, 200)
  const [row] = await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [userId])
  return res.body.data.find((p) => p.id === row.id)
}

describe('email verification', () => {
  test('a new account counts its email as verified', async () => {
    const me = await signUpUser(server)
    const res = await server.request('GET', '/api/verification', { token: me.token })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.email.verified, true)
    assert.equal(res.body.data.aadhaar.status, 'none')
  })

  test('the profile listing carries the email badge', async () => {
    const me = await signUpUser(server)
    const card = await listedAs(admin, me.userId)
    assert.equal(card.emailVerified, true)
    assert.equal(card.idVerified, false)
  })
})

describe('Aadhaar Secure QR', () => {
  test('a genuine QR matching the profile verifies at once', async () => {
    const me = await signUpUser(server, { fullName: 'Rahul Kumar Chaudhary', dateOfBirth: '1994-03-15' })
    const res = await submit(me, makeQr({ name: 'Rahul Kumar Chaudhary', dob: '15-03-1994', last4: '1111' }))
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.aadhaar.status, 'verified')

    const card = await listedAs(admin, me.userId)
    assert.equal(card.idVerified, true)
  })

  test('the "verified only" filter keeps verified members and drops the rest', async () => {
    const verified = await signUpUser(server, { fullName: 'Sunil Chaudhary', dateOfBirth: '1990-07-01' })
    await submit(verified, makeQr({ name: 'Sunil Chaudhary', dob: '01-07-1990', last4: '2222' }))
    const plain = await signUpUser(server)

    assert.ok(await listedAs(admin, verified.userId, '?verifiedOnly=1'))
    assert.equal(await listedAs(admin, plain.userId, '?verifiedOnly=1'), undefined)
    assert.ok(await listedAs(admin, plain.userId))
  })

  test('surname spellings and missing middle names still match', () => {
    assert.ok(namesMatch('Rahul Choudhary', 'Rahul Kumar Chaudhary'))
    assert.ok(namesMatch('Rahul Chaudhari', 'RAHUL CHAUDHARY'))
    assert.ok(namesMatch('R. Chaudhary', 'Rahul Chaudhary') === false, 'one full word is not enough')
    assert.ok(!namesMatch('Chaudhary', 'Rahul Chaudhary'))
    assert.ok(!namesMatch('Amit Chaudhary', 'Rahul Chaudhary'))
  })

  test('a genuine QR that does not match goes to admin review, and approval verifies', async () => {
    const me = await signUpUser(server, { fullName: 'Bunty Chaudhary' })
    const res = await submit(me, makeQr({ name: 'Rajesh Chaudhary', last4: '3333' }))
    assert.equal(res.status, 200)
    assert.equal(res.body.data.aadhaar.status, 'review')
    assert.deepEqual(res.body.data.aadhaar.mismatches, ['name'])
    assert.equal((await listedAs(admin, me.userId)).idVerified, false)

    const queue = await server.request('GET', '/api/admin/verifications', { token: admin.token })
    const item = queue.body.data.find((v) => v.userId === me.userId)
    assert.equal(item.onId.name, 'Rajesh Chaudhary')
    assert.equal(item.onProfile.name, 'Bunty Chaudhary')

    const decided = await server.request('PUT', `/api/admin/verifications/${me.userId}`, {
      token: admin.token, body: { decision: 'approve', note: 'Bunty is his pet name' },
    })
    assert.equal(decided.status, 200)
    assert.equal((await listedAs(admin, me.userId)).idVerified, true)
  })

  test('only admins can see or decide the queue', async () => {
    const me = await signUpUser(server)
    const list = await server.request('GET', '/api/admin/verifications', { token: me.token })
    assert.equal(list.status, 403)
    const decide = await server.request('PUT', `/api/admin/verifications/${me.userId}`, {
      token: me.token, body: { decision: 'approve' },
    })
    assert.equal(decide.status, 403)
  })

  test('a QR not signed by UIDAI is refused', async () => {
    const me = await signUpUser(server)
    const res = await submit(me, makeQr({ key: forger.privateKey, last4: '4444' }))
    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'BAD_SIGNATURE')
    const rows = await server.sql('SELECT 1 FROM member_verifications WHERE user_id = $1', [me.userId])
    assert.equal(rows.length, 0)
  })

  test('an edited QR fails the signature check', async () => {
    const me = await signUpUser(server)
    const genuine = makeQr({ last4: '5555' })
    // Flip one digit: the bytes change, so either inflation or the signature fails.
    const edited = genuine.slice(0, 600) + ((Number(genuine[600]) + 1) % 10) + genuine.slice(601)
    const res = await submit(me, edited)
    assert.equal(res.status, 400)
    assert.ok(['BAD_SIGNATURE', 'NOT_AADHAAR'].includes(res.body.code), res.body.code)
  })

  test('the old unsigned XML QR is refused with an explanation', async () => {
    const me = await signUpUser(server)
    const res = await submit(me, '<?xml version="1.0"?><PrintLetterBarcodeData uid="123412341234" name="Test User"/>')
    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'OLD_QR')
  })

  test('consent is required', async () => {
    const me = await signUpUser(server)
    const res = await submit(me, makeQr({ last4: '6666' }), false)
    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'CONSENT_REQUIRED')
  })

  test('one card cannot verify two accounts', async () => {
    const qr = makeQr({ name: 'Test User', last4: '7777' })
    const first = await signUpUser(server)
    assert.equal((await submit(first, qr)).body.data.aadhaar.status, 'verified')

    const second = await signUpUser(server)
    const res = await submit(second, makeQr({ name: 'Test User', last4: '7777' }))
    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'AADHAAR_ALREADY_USED')
  })

  test('a QR without the version marker (older Secure QR) also reads', async () => {
    const me = await signUpUser(server)
    const res = await submit(me, makeQr({ version: null, last4: '8888' }))
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.aadhaar.status, 'verified')
  })

  test('once verified, name and date of birth can no longer be edited', async () => {
    const me = await signUpUser(server)
    await submit(me, makeQr({ last4: '9999' }))

    const res = await server.request('PUT', '/api/matrimony/me', {
      token: me.token,
      body: { user: { fullName: 'Someone Else' }, profile: { dateOfBirth: '1980-01-01', bio: 'Updated bio' } },
    })
    assert.equal(res.status, 200)
    const [row] = await server.sql(
      `SELECT u.full_name, p.date_of_birth, p.bio FROM users u JOIN matrimony_profiles p ON p.user_id = u.id
        WHERE u.id = $1`,
      [me.userId]
    )
    assert.equal(row.full_name, 'Test User')
    assert.equal(String(row.date_of_birth).slice(0, 10), '1995-01-01')
    assert.equal(row.bio, 'Updated bio', 'other fields still save')
  })

  test('once verified, where they live can no longer be changed', async () => {
    const me = await signUpUser(server, { fullName: 'Lata Location' })
    await server.request('PUT', '/api/matrimony/me', {
      token: me.token,
      body: { profile: { country: 'India', state: 'Gujarat', city: 'Mahesana', location: 'Mahesana, Gujarat' } },
    })
    const verified = await submit(me, makeQr({ name: 'Lata Location', last4: '8888' }))
    assert.equal(verified.body.data?.aadhaar?.status, 'verified', JSON.stringify(verified.body))

    const res = await server.request('PUT', '/api/matrimony/me', {
      token: me.token,
      body: { profile: { country: 'USA', state: 'Texas', city: 'Dallas', location: 'Dallas', bio: 'Moved?' } },
    })
    assert.equal(res.status, 200)
    const [row] = await server.sql('SELECT country, state, location AS city, bio FROM matrimony_profiles WHERE user_id = $1', [me.userId])
    assert.equal(row.country, 'India')
    assert.equal(row.state, 'Gujarat')
    assert.equal(row.city, 'Mahesana, Gujarat')
    assert.equal(row.bio, 'Moved?', 'other fields still save')
  })

  test('nothing beyond the result and the few signed details is stored', async () => {
    const [columns] = await server.sql(
      `SELECT string_agg(column_name, ',' ORDER BY column_name) AS names
         FROM information_schema.columns WHERE table_name = 'member_verifications'`
    )
    for (const forbidden of ['qr', 'photo', 'address', 'aadhaar_number', 'uid']) {
      assert.ok(!columns.names.split(',').includes(forbidden), `${forbidden} must not be a column`)
    }
  })
})

describe('UIDAI certificates', () => {
  test('the shipped UIDAI keys all load', () => {
    const keys = loadUidaiKeys(path.resolve(import.meta.dirname, '..', 'server', 'certs', 'aadhaar'))
    assert.ok(keys.length >= 7, `expected the UIDAI keys, got ${keys.length}`)
  })

  test('a QR signed by a test key is refused by the real UIDAI keys', () => {
    const keys = loadUidaiKeys(path.resolve(import.meta.dirname, '..', 'server', 'certs', 'aadhaar'))
    assert.throws(() => verifyAadhaarQr(makeQr(), keys), (err) => err.code === 'BAD_SIGNATURE')
  })
})

describe('changing the date of birth on the profile', () => {
  const yearsAgo = (n) => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - n)
    d.setDate(d.getDate() - 10)
    return d.toISOString().slice(0, 10)
  }
  const row = async (userId) =>
    (await server.sql(
      `SELECT u.full_name, p.date_of_birth, p.age FROM users u JOIN matrimony_profiles p ON p.user_id = u.id
        WHERE u.id = $1`,
      [userId]
    ))[0]

  test('before verification, name and date of birth change, and the age follows', async () => {
    const me = await signUpUser(server, { dateOfBirth: yearsAgo(30) })
    const res = await server.request('PUT', '/api/matrimony/me', {
      token: me.token,
      body: { user: { fullName: 'Renamed Person' }, profile: { dateOfBirth: yearsAgo(27) } },
    })
    assert.equal(res.status, 200)
    const after = await row(me.userId)
    assert.equal(after.full_name, 'Renamed Person')
    assert.equal(String(after.date_of_birth).slice(0, 10), yearsAgo(27))
    assert.equal(Number(after.age), 27)
  })

  test('a date making the member under 18 is refused and nothing changes', async () => {
    const me = await signUpUser(server, { dateOfBirth: yearsAgo(30) })
    const res = await server.request('PUT', '/api/matrimony/me', {
      token: me.token,
      body: { profile: { dateOfBirth: yearsAgo(15), bio: 'should not save' } },
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'UNDER_AGE')
    const after = await row(me.userId)
    assert.equal(String(after.date_of_birth).slice(0, 10), yearsAgo(30))
    assert.equal(Number(after.age), 30)
  })

  test('sending back the stored date unchanged is not re-checked', async () => {
    const me = await signUpUser(server, { dateOfBirth: yearsAgo(30) })
    // An old account whose stored date predates the age gate.
    await server.sql('UPDATE matrimony_profiles SET date_of_birth = $1 WHERE user_id = $2', [yearsAgo(16), me.userId])
    const res = await server.request('PUT', '/api/matrimony/me', {
      token: me.token,
      body: { profile: { dateOfBirth: yearsAgo(16), bio: 'still saves' } },
    })
    assert.equal(res.status, 200)
  })
})
