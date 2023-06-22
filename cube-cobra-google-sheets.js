/**
 * Cube Cobra + Google Sheets integration.
 *
 * Made by Anthony Mattox. Read more on Github.
 *
 * https://github.com/ahmattox/cube-cobra-google-sheets
 *
 * Last updated 2023-06-22
 */

// - Sheet Functions

/**
 * Fetch a list of cards from Cube Cobra and return a given set of fields for
 * each. Cards are sorted by color, type, and mana value.
 */
function CUBECOBRA_LIST(idOrLink, fields) {
  const id = cubeIDFromLink(idOrLink)
  const cube = fetchCube(id)

  const fieldNames = normalizeCardFieldNames(fields)

  const sortedCards = sortCards(cube.cards.mainboard)

  return sortedCards.map((card) => {
    return fieldNames.map((fieldName) => {
      return cardFieldFormatters[fieldName] != null
        ? cardFieldFormatters[fieldName](card)
        : card[fieldName] ?? card.details[fieldName]
    })
  })
}

/**
 * Fetch specified meta data attributes on a Cube Cobra cube.
 */
function CUBECOBRA_METADATA(idOrLink, fields) {
  console.log(fields)

  const id = cubeIDFromLink(idOrLink)
  const cube = fetchCube(id)

  return fields.flat().map((field) => {
    return cube[field]
  })
}

// - Cube Cobra Utilities

const cubeCobraURL = 'https://cubecobra.com'
const apiURL = 'https://cubecobra.com/cube/api'

function overviewURLForCube(id) {
  return `${cubeCobraURL}/cube/overview/${id}`
}

function apiURLForCube(id) {
  return `${apiURL}/cubeJSON/${id}`
}

function fetchCube(id) {
  return JSON.parse(UrlFetchApp.fetch(apiURLForCube(id)).getContentText())
}

const cubeLinkPattern = /cubecobra.com\/.*\/(?<cubeID>[a-zA-Z0-9-_]+?)($|\?)/i

const cubeIDPattern = /^[a-zA-Z0-9-_]+$/

/**
 * Returns the ID of a Cube on Cube Cobra given either the ID or a link to any
 * page for the Cube on Cube Cobra. This doesn't guarantee the ID exists on Cube
 * Cobra, but just finds what could be a valid id.
 */
function cubeIDFromLink(cubeLink) {
  const trimmedLink = cubeLink?.trim()

  if (trimmedLink == null || trimmedLink.length === 0) {
    return null
  }

  if (trimmedLink.match(cubeIDPattern)) {
    return trimmedLink
  }

  return trimmedLink.match(cubeLinkPattern)?.groups?.cubeID ?? null
}

// Fields are a mix of snake_case and camelCase in Cube Cobra cards. Add aliases
// to address this and some other cases, like names and mana values / cmc.
const cardAttributeAliases = {
  card_name: 'name',
  card: 'name',
  type: 'type_line',
  color: 'colors',
  color_category: 'colorCategory',
  is_unlimited: 'isUnlimited',
  card_id: 'cardID',
  cube_count: 'cubeCount',
  pick_count: 'pickCount',
  is_token: 'isToken',
  mv: 'cmc',
  mana_value: 'cmc',
  converted_mana_cost: 'cmc',
  added_timestamp: 'addedTmsp',
  price: 'price_usd',
}

// Convert field names to snake case or the specific formatting Cube Cobra uses.
function normalizeCardFieldNames(names) {
  return names.flat().map((name) => {
    const snakeName = name.toLowerCase().replaceAll(' ', '_')

    return cardAttributeAliases[snakeName] ?? snakeName
  })
}

// Formatters for non scalar fields. E.g. joins color arrays and picks out
// nested values.
const cardFieldFormatters = {
  color_identity: (card) => {
    return card.details.color_identity.join('')
  },
  colors: (card) => {
    return card.details.colors.join('')
  },
  finishes: (card) => {
    return card.details.finishes.join(', ')
  },
  parsed_cost: (card) => {
    return card.details.parsed_cost.join('')
  },
  price_usd: (card) => {
    return card.details.prices.usd
  },
  price_usd_foil: (card) => {
    return card.details.prices.usd_foil
  },
  price_usd_etched: (card) => {
    return card.details.prices.usd_etched
  },
  price_eur: (card) => {
    return card.details.prices.eur
  },
  price_tix: (card) => {
    return card.details.prices.tix
  },
}

// Card Sorting

function normalizeColorIdentity(colorIdentity) {
  const allColors = ['W', 'U', 'B', 'R', 'G']
  const input = colorIdentity.join('').toUpperCase()
  return allColors
    .filter((c) => {
      return input != null && input.includes(c)
    })
    .join('')
}

const colorIdentityOrder = [
  'W',
  'U',
  'B',
  'R',
  'G',
  'WU',
  'WB',
  'WR',
  'WG',
  'UB',
  'UR',
  'UG',
  'BR',
  'BG',
  'RG',
  'WUB',
  'WUR',
  'WUG',
  'WBR',
  'WBG',
  'WRG',
  'UBR',
  'UBG',
  'URG',
  'BRG',
  'WUBR',
  'WUBG',
  'WURG',
  'WBRG',
  'UBRG',
  'WUBRG',
  '',
].reduce((result, value, index) => {
  result[value] = index
  return result
}, {})

function colorIdentityIndex(colorIdentity) {
  return colorIdentityOrder[normalizeColorIdentity(colorIdentity)]
}

const cardTypeOrder = [
  'Creature',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Planeswalker',
  'Land',
]

function cardTypeIndex(cardType) {
  return cardTypeOrder.findIndex((type) => cardType.includes(type))
}

/**
 * Sorts cards the "normal" way, by color, type, and then mana value.
 */
function sortCards(cards) {
  return cards.sort((a, b) => {
    const ciA = colorIdentityIndex(a.details.color_identity)
    const ciB = colorIdentityIndex(b.details.color_identity)
    if (ciA !== ciB) {
      return ciA < ciB ? -1 : 1
    }

    const tA = cardTypeIndex(a.type_line)
    const tB = cardTypeIndex(b.type_line)
    if (tB !== tA) {
      return tA < tB ? -1 : 1
    }

    if (a.cmc != b.cmc) {
      return a.cmc < b.cmc ? -1 : 1
    }

    if (a.details.name < b.details.name) {
      return -1
    }

    if (a.details.name > b.details.name) {
      return 1
    }

    return 0
  })
}
