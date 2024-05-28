import { createContext } from "react"
import type { PaymentMethod } from "./PaymentMethod"

type Page<R, S> = {
  id: R,
  data: S
}

export type InterpretState = {
  rawData: string | null,
}

export type ComposeState = {
  paymentMethods: Array<PaymentMethod>
}

export type LearnQRCodesState = {
  data: string,
}

type AppPage = Page<'interpret', InterpretState> | Page<'compose', ComposeState> | Page<'learn-qr-codes', LearnQRCodesState>

export type AppState = {
  page: AppPage
  setPage: (p: AppPage) => void
}

export const AppStateContext = createContext<AppState | null>(null)