/**
 * Reads and checks the "Secure QR" printed on Aadhaar cards, e-Aadhaar PDFs
 * and the mAadhaar app.
 *
 * The QR holds one long decimal number. As bytes it is a gzip stream; inflated
 * it is a run of fields separated by 0xFF, then a JPEG 2000 photo, then (if the
 * holder registered them) hashes of their email and mobile, then a 256-byte
 * RSA-SHA256 signature by UIDAI over everything before it. UIDAI publishes no
 * byte-level spec, so the layout here follows the open-source readers
 * (pyaadhaar, anon-aadhaar) and is checked by the signature: whatever we read,
 * UIDAI signed it.
 *
 * This is the "offline verification" the 2019 Aadhaar amendment allows a
 * private service with the holder's consent. It needs no UIDAI licence, sees
 * only the last four digits of the Aadhaar number, and nothing here is ever
 * stored except the result the caller chooses to keep.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const SIGNATURE_BYTES = 256
const DELIMITER = 0xff
// A real Secure QR is a few thousand digits. The cap keeps a hostile payload
// from making BigInt parsing or inflation expensive.
const MAX_QR_DIGITS = 12000
const MAX_INFLATED_BYTES = 64 * 1024

// Field order after the optional "V2"-style version marker.
const FIELDS = [
  'emailMobileIndicator',
  'referenceId',
  'name',
  'dob',
  'gender',
  'careOf',
  'district',
  'landmark',
  'house',
  'location',
  'pincode',
  'postOffice',
  'state',
  'street',
  'subDistrict',
  'vtc',
]

export class AadhaarQrError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const DEFAULT_CERT_DIR = path.join(import.meta.dirname, 'certs', 'aadhaar')

/**
 * UIDAI's signing keys, from the .cer files on its "Data and Downloads" page.
 *
 * Every key is tried, expired ones included: a card printed in 2019 is signed
 * with the key in use then, and the signature still proves UIDAI issued it.
 * AADHAAR_CERT_DIR points elsewhere so the tests can sign their own QR codes.
 */
let cachedKeys = null
export function loadUidaiKeys(dir = process.env.AADHAAR_CERT_DIR || DEFAULT_CERT_DIR) {
  if (cachedKeys && cachedKeys.dir === dir) return cachedKeys.keys
  const keys = []
  let names = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    names = []
  }
  for (const name of names) {
    if (!/\.(cer|crt|pem)$/i.test(name)) continue
    const raw = fs.readFileSync(path.join(dir, name))
    try {
      keys.push({ name, key: new crypto.X509Certificate(raw).publicKey })
    } catch {
      try {
        keys.push({ name, key: crypto.createPublicKey(raw) })
      } catch {
        console.warn(`[aadhaar] could not read key file ${name}`)
      }
    }
  }
  cachedKeys = { dir, keys }
  return keys
}

function decimalToBytes(text) {
  let hex = BigInt(text).toString(16)
  if (hex.length % 2) hex = `0${hex}`
  return Buffer.from(hex, 'hex')
}

/**
 * Turns the scanned text into the signed bytes and the signature.
 * Throws AadhaarQrError with a code the app can explain.
 */
function unpack(qrText) {
  const text = String(qrText || '').trim()

  // Cards printed before 2018 carry a plain XML QR with no signature, which
  // anyone can forge, so it is refused with a pointer to a newer copy.
  if (text.startsWith('<') || text.includes('<PrintLetterBarcodeData')) {
    throw new AadhaarQrError(
      'OLD_QR',
      'This is an older Aadhaar QR without a UIDAI signature. Please scan the QR on a newly downloaded e-Aadhaar or in the mAadhaar app.',
    )
  }
  if (!/^\d+$/.test(text) || text.length < 500 || text.length > MAX_QR_DIGITS) {
    throw new AadhaarQrError('NOT_AADHAAR', 'This does not look like an Aadhaar Secure QR code.')
  }

  let inflated
  try {
    inflated = zlib.unzipSync(decimalToBytes(text), { maxOutputLength: MAX_INFLATED_BYTES })
  } catch {
    throw new AadhaarQrError('NOT_AADHAAR', 'This does not look like an Aadhaar Secure QR code.')
  }
  if (inflated.length <= SIGNATURE_BYTES + 32) {
    throw new AadhaarQrError('NOT_AADHAAR', 'This does not look like an Aadhaar Secure QR code.')
  }

  return {
    signed: inflated.subarray(0, inflated.length - SIGNATURE_BYTES),
    signature: inflated.subarray(inflated.length - SIGNATURE_BYTES),
  }
}

/**
 * Reads the text fields from the front of the signed data.
 *
 * Only the leading fields are split on 0xFF. The photo that follows can contain
 * 0xFF bytes of its own, so the reader stops before it rather than splitting
 * the whole buffer.
 */
function readFields(signed) {
  let start = 0
  let version = '1'

  const firstEnd = signed.indexOf(DELIMITER, 0)
  const first = firstEnd > 0 ? signed.subarray(0, firstEnd).toString('latin1') : ''
  const versionMatch = /^V(\d+)$/.exec(first)
  if (versionMatch) {
    version = versionMatch[1]
    start = firstEnd + 1
  }

  const values = {}
  for (const field of FIELDS) {
    const end = signed.indexOf(DELIMITER, start)
    if (end < 0) {
      throw new AadhaarQrError('UNREADABLE', 'Could not read the details in this Aadhaar QR.')
    }
    values[field] = signed.subarray(start, end).toString('latin1').trim()
    start = end + 1
  }
  return { version, values }
}

/** DD-MM-YYYY, DD/MM/YYYY or a bare year (some older records) → { iso | year }. */
function parseAadhaarDob(value) {
  const full = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(value)
  if (full) return { iso: `${full[3]}-${full[2]}-${full[1]}`, year: full[3] }
  if (/^\d{4}$/.test(value)) return { iso: null, year: value }
  return null
}

const GENDERS = { M: 'male', F: 'female', T: 'transgender' }

/**
 * Checks a scanned Secure QR and returns what UIDAI signed.
 *
 * Throws AadhaarQrError when the code is not an Aadhaar Secure QR, when no
 * UIDAI key signed it, or when the signed fields are not in the expected shape
 * (a layout we do not know is refused rather than misread: a misread field
 * would still pass the signature check and be trusted).
 */
export function verifyAadhaarQr(qrText, keys = loadUidaiKeys()) {
  if (!keys.length) {
    throw new AadhaarQrError('NOT_CONFIGURED', 'Aadhaar verification is not available right now.')
  }

  const { signed, signature } = unpack(qrText)

  const signer = keys.find(({ key }) => {
    try {
      return crypto.verify('sha256', signed, key, signature)
    } catch {
      return false
    }
  })
  if (!signer) {
    throw new AadhaarQrError(
      'BAD_SIGNATURE',
      'This QR is not signed by UIDAI. Please scan the QR on your own Aadhaar card, e-Aadhaar or mAadhaar app.',
    )
  }

  const { version, values } = readFields(signed)
  const dob = parseAadhaarDob(values.dob)
  const gender = GENDERS[values.gender?.toUpperCase()]
  const last4 = /^(\d{4})/.exec(values.referenceId)?.[1]
  if (!values.name || !dob || !gender || !last4) {
    throw new AadhaarQrError('UNREADABLE', 'Could not read the details in this Aadhaar QR.')
  }

  return {
    version,
    signer: signer.name,
    name: values.name,
    dob: dob.iso,
    birthYear: dob.year,
    gender,
    last4,
    state: values.state || null,
    district: values.district || null,
  }
}

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'smt', 'shri', 'shree', 'sri', 'kumari', 'kum', 'dr'])

function nameTokens(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t))
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

// Chaudhary / Choudhary / Chaudhari / Chaudhry are one surname spelt four ways,
// so a one-letter difference in a longer word still counts as the same name.
function tokensMatch(profileToken, idToken) {
  if (profileToken.length === 1) return idToken.startsWith(profileToken)
  if (profileToken === idToken) return true
  return Math.min(profileToken.length, idToken.length) >= 5 && editDistance(profileToken, idToken) <= 1
}

/**
 * Does the name on the profile plausibly belong to the person on the card?
 *
 * Every word of the profile name has to appear in the Aadhaar name (initials
 * may stand for a word), and at least two must match whenever the card has two
 * or more words — otherwise a profile named just "Chaudhary" would match every
 * Chaudhary in India.
 */
export function namesMatch(profileName, idName) {
  const mine = nameTokens(profileName)
  const theirs = nameTokens(idName)
  if (!mine.length || !theirs.length) return false
  const used = new Set()
  let full = 0
  for (const token of mine) {
    const at = theirs.findIndex((t, i) => !used.has(i) && tokensMatch(token, t))
    if (at < 0) return false
    used.add(at)
    if (token.length > 1) full += 1
  }
  return full >= Math.min(2, theirs.length)
}

/**
 * Compares what UIDAI signed with what the member put on their profile.
 * Returns the list of fields that differ; empty means a match.
 */
export function compareWithProfile(id, profile) {
  const mismatches = []
  if (!namesMatch(profile.fullName, id.name)) mismatches.push('name')

  const profileDob = profile.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : ''
  if (!profileDob) mismatches.push('dateOfBirth')
  else if (id.dob ? profileDob !== id.dob : profileDob.slice(0, 4) !== id.birthYear) mismatches.push('dateOfBirth')

  if (String(profile.gender || '').toLowerCase() !== id.gender) mismatches.push('gender')
  return mismatches
}

/**
 * A stable tag for "this Aadhaar holder", so one card cannot verify several
 * accounts. Keyed with a server secret, so the stored value cannot be reversed
 * by hashing guesses of name, birthday and four digits.
 */
export function aadhaarFingerprint(id, secret) {
  const basis = [id.last4, nameTokens(id.name).join(' '), id.dob || id.birthYear, id.gender].join('|')
  return crypto.createHmac('sha256', secret).update(basis).digest('hex')
}
