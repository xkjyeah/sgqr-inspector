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

type AppPage = Page<'interpret', InterpretState> | Page<'compose', ComposeState>

export type AppState = {
  page: AppPage
  setPage: (p: AppPage) => void
}

export const AppStateContext = createContext<AppState | null>(null)