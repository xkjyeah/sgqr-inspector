import type { ParseResult, ParsedElement } from './EMVCoMPMContext'

export type PaymentMethod = {
  rawData: string,
  iconURL: string,
  description: string,
}

export const extractPaymentMethodsFromParseResult = (elements: ParsedElement[]): PaymentMethod[] => {
  return elements.map(pme => ({
    rawData: pme.rawValue,
    description: (pme.interpretation as ParseResult).context.name,
    iconURL: '',
  }))
}