// The rental agreement's content, shared by the PDF and the Word file. The layout copies Pardz Car Rental's
// paper form; the booking fills in the renter and vehicle blanks, and the price blanks stay empty on purpose
// so the admin writes in the deal agreed at the office.
export const BLANK = '__________'

const pad = (value) => String(value).padStart(2, '0')
function dateTime(day, time, shortYear = false) {
  const date = new Date(`${day}T00:00:00`)
  const year = shortYear ? String(date.getFullYear()).slice(2) : date.getFullYear()
  let text = `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${year}`
  if (time) {
    const [hours, minutes] = String(time).split(':').map(Number)
    text += ` ${hours % 12 || 12}:${pad(minutes)} ${hours < 12 ? 'AM' : 'PM'}`
  }
  return text
}

// Splits text into [text, bold] pieces: the company name and peso amounts are bold, like on the paper form.
export function emphasis(text) {
  return String(text || '').split(/(PARDZ CAR RENTAL|\(P[\d,. ]+\))/).filter(Boolean).map((part) => [part, /^(PARDZ CAR RENTAL|\(P[\d,. ]+\))$/.test(part)])
}

export function buildAgreement(pack) {
  const { booking, customer, vehicle } = pack
  const terms = pack.agreement_terms || {}
  const isLicense = (type) => /driver.?s? license/i.test(type || '')
  const license = isLicense(customer.id_type) ? customer.id_number : isLicense(customer.second_id_type) ? customer.second_id_number : ''
  const days = Math.max(1, Math.round((new Date(`${booking.end_date}T00:00:00`) - new Date(`${booking.start_date}T00:00:00`)) / 86400000) + 1)
  const period = `${dateTime(booking.start_date)} to ${dateTime(booking.end_date)} (${days} day${days === 1 ? '' : 's'})`
  const now = new Date()
  const day = now.getDate()
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th')

  return {
    title: terms.title || 'RENTAL AGREEMENT',
    preamble: terms.preamble || 'KNOW ALL MEN BY THESE PRESENTS:',
    witnesseth: terms.witnesseth || 'WITNESSETH:',
    intro: terms.vehicle_details_intro || 'Whereas the LESSOR leases the following described vehicle with the following details:',
    name: customer.full_name || '',
    address: customer.address || '',
    license: license || '',
    vehicle: `${vehicle.make || ''} ${vehicle.model || ''}`.trim(),
    plate: vehicle.plate_number || '',
    phone: customer.phone || '',
    release: dateTime(booking.start_date, booking.pickup_time, true),
    end: dateTime(booking.end_date, booking.return_time, true),
    renterTerms: (terms.renter_terms || []).map((term) => term.replace('Period of Lease:', 'Period of Lease -').replace('{period}', period).replace('{amount}', BLANK)),
    liabilityHeading: terms.liability_heading || 'LIABILITY FOR ACCIDENT/DAMAGE TO THE VEHICLE/LOSS OF LIFE/LOSS OF VEHICLE',
    liability: terms.liability_text || '',
    signingLocation: terms.signing_location || 'Cagayan de Oro City',
    day: `${day}${suffix}`,
    month: now.toLocaleString('en', { month: 'long' }),
    year: String(now.getFullYear()).slice(2),
    fileName: (extension) => `rental-agreement-${(customer.full_name || 'customer').replace(/[^\w-]+/g, '-').replace(/-+/g, '-')}-${booking.start_date}.${extension}`,
  }
}
