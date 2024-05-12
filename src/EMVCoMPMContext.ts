import { range } from 'lodash'

export const UNKNOWN: unique symbol = Symbol()

export class ParseError extends Error { }
class InvalidLengthError extends ParseError {
  lengthRequested: number
  lengthAvailable: number
  constructor(lengthRequested: number, lengthAvailable: number) {
    super(`A length of ${lengthRequested} was requested, but only ${lengthAvailable} chars are left in the payload`)
    this.lengthRequested = lengthRequested
    this.lengthAvailable = lengthAvailable
  }
}
class InvalidElementError extends ParseError {
  element: string
  constructor(element: string) {
    super(`An invalid element+length indicator of ${element} was encountered`)
    this.element = element
  }
}

export type ParsedElement = {
  elementID: string,
  length: number,
  rawValue: string,
  interpretation: string | ParseResult | typeof UNKNOWN | null,
  description: string | typeof UNKNOWN,
}
export type ParseResult = {
  context: InterpretationContext,
  elements: Array<ParsedElement | ParseError>
}

export type Interpretation = string | ParseResult | typeof UNKNOWN

type KnownElement = {
  description: string,
  interpreter?: ((value: string) => Interpretation | null)
}

type InterpretationContext = {
  name: string,
  knownElements: Record<string, KnownElement>
}

const merchantAccountInformation = {
  description: 'Merchant account information',
  interpreter: (v: string) => {
    const pd = parseData(GenericMerchantAccountInformationContext, v)

    const firstElement = pd.elements[0]

    if (firstElement && !(firstElement instanceof ParseError) && firstElement.elementID === '00') {
      const formatIndicator = firstElement.rawValue.toUpperCase()
      if (formatIndicator in SGQRContexts) {
        return parseData(SGQRContexts[formatIndicator], v)
      } else {
        return pd
      }
    } else {
      return pd
    }
  }
}

const GenericMerchantAccountInformationContext: InterpretationContext = {
  name: 'Generic merchant account information',
  knownElements: {
    '00': {
      description: 'Payload format indicator',
    }
  }
}

const SGQRContexts: Record<string, InterpretationContext> = {
  'SG.PAYNOW': {
    name: 'PayNow Merchant Information',
    knownElements: {
      '00': {
        description: 'Payload format indicator',
      },
      '01': {
        description: 'Payee type',
        interpreter: (n: string) => {
          return {
            0: 'Mobile number',
            2: 'UEN',
          }[n] || UNKNOWN
        }
      },
      '02': {
        description: 'Payee',
      },
      '03': {
        description: 'Is amount editable',
        interpreter: (n: string) => ({
          0: 'Not editable',
          1: 'Editable',
        }[n]) || UNKNOWN
      },
      '04': {
        description: 'Transaction reference',
      },
      '05': {
        description: 'Expiry (YYYY/MM/DD)',
      },
    }
  },
  'SG.COM.NETS': {
    name: 'NETS',
    knownElements: {
      '00': {
        description: 'Payload format indicator',
      },
      '01': {
        description: 'QR metadata'
      },
      '02': { description: 'Merchant ID' },
      '03': { description: 'Terminal ID' },
      '09': { description: 'Transaction amount modifier' },
      '99': { description: 'Signature' },
    }
  },
  'COM.GRAB': {
    name: 'GrabPay',
    knownElements: {
      '00': {
        description: 'Payload format indicator',
      },
      '01': {
        description: 'Merchant ID'
      },
    }
  },
  'SG.SGQR': {
    name: 'SG Merchant ID',
    knownElements: {
      '00': {
        description: 'Payload format indicator',
      },
      '01': {
        description: 'SGQR ID Number'
      },
      '02': { description: 'Version' },
      '03': { description: 'Postcode' },
      '04': { description: 'Level' },
      '05': { description: 'Unit number' },
      '06': { description: 'Misc' },
      '07': { description: 'Revision date (YYYYMMDD)' },
    }
  },
}

export const EMVCoMPMContext: InterpretationContext = {
  name: 'EMVCo Merchant Presented QR Code',
  knownElements: {
    '00': {
      description: 'Payload format indicator'
    },
    '01': {
      description: 'Point of initiation',
      interpreter: (n) => ({
        '11': 'Static -- can be used for multiple transactions',
        '12': 'Dynamic -- to be used for a single transaction',
      })[n] || UNKNOWN
    },
    ...(
      Object.fromEntries(
        range(26, 52).map((i: number) => [i.toString().padStart(2, '0'), merchantAccountInformation])
      )
    ),
    '52': {
      description: 'Merchant category code'
    },
    '53': {
      description: 'Transaction currency'
    },
    '58': {
      description: 'Country code'
    },
    '59': {
      description: 'Merchant name'
    },
    '60': {
      description: 'Merchant city'
    },
    '63': {
      description: 'CRC'
    },
  }
}

export const parseData = (context: InterpretationContext, data: string): ParseResult => {
  let index = 0
  const elements: Array<ParseError | ParsedElement> = []

  while (index < data.length) {
    const elementAndLength = data.substring(index, index + 4)

    index += 4

    if (elementAndLength.length < 4) {
      elements.push(new InvalidElementError(elementAndLength))
      break;
    }

    const elementID = elementAndLength.substring(0, 2)
    const lengthString = elementAndLength.substring(2, 4)
    if (!lengthString.match(/[0-9]{2}/)) {
      elements.push(new InvalidElementError(elementAndLength))
      break;
    }

    const length = parseInt(lengthString)
    const value = data.substring(index, index + length)

    index += length

    if (value.length < length) {
      elements.push(new InvalidLengthError(length, value.length))
      break;
    }

    if (elementID in context.knownElements) {
      elements.push({
        elementID,
        length,
        description: context.knownElements[elementID].description,
        rawValue: value,
        interpretation: context.knownElements[elementID].interpreter?.(value) || null,
      })
    } else {
      elements.push({
        elementID,
        length,
        description: UNKNOWN,
        rawValue: value,
        interpretation: null,
      })
    }
  }

  return {
    context,
    elements,
  }
}