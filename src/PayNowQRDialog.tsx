import React, { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PaymentMethod } from './PaymentMethod'
import { QRData } from './QRData'


type PayNowMode = 'UEN' | 'Phone number'
const standardizePhone = (mode: PayNowMode | null, s: string) => {
  if (mode !== 'Phone number') {
    return s;
  } else {
    if (s.match(/^[0-9]{8}$/)) {
      return '+65' + s
    } else {
      return s
    }
  }
}

export function PayNowQRDialog(props: {
  children: (props: {
    openDialog: () => void,
  }) => React.ReactNode,
  onConfirm: ((arg0: PaymentMethod) => void)
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [destination, setDestination] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [type, setType] = useState<null | PayNowMode>(null)
  const { onConfirm } = props

  const openDialog = useCallback(() => {
    setIsOpen(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      inputRef.current!.focus()
    }
  }, [isOpen])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDestination(value)
    if (value.match(/^[0-9]{8}$/) ||
      value.match(/^\+65[0-9]{8}$/)) {
      setType('Phone number')
    } else if (value.match(/[a-zA-Z]/) && value.match(/[0-9]/)) {
      setType('UEN')
    } else {
      setType(null)
    }
  }, [type, destination])


  const handleCancel = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleConfirm = useCallback(() => {
    onConfirm({
      rawData: new QRData({
        '00': 'SG.PAYNOW',
        '01': type === 'Phone number' ? '0' : '2',
        '02': standardizePhone(type, destination).toUpperCase(),
        '03': '1', // Amount is not editabe
        '04': type === 'UEN' ? paymentReference || null : null,
      }).toString(),
      description: `PayNow (${destination.toUpperCase()})`,
      iconURL: '',
      protocol: 'SG.PAYNOW'
    })
    setIsOpen(false)
  }, [onConfirm, destination, type])

  return <>
    {props.children({ openDialog })}
    <PopupSpace style={{ display: isOpen ? undefined : 'none', textAlign: 'center' }}>
      <div style={{ backgroundColor: "light-dark(white, black)", width: '100%', maxWidth: '500px', padding: '2em' }}>
        <table style={{ width: '100%' }}>
          <tbody>
            <tr>
              <th style={{ textAlign: 'right' }}>PayNow number / UEN</th>
              <td>
                <input type="text" value={destination} onInput={handleInput} ref={inputRef} style={{ textTransform: 'uppercase', width: '100%', boxSizing: 'border-box' }} />
              </td>
            </tr>
            <tr>
              <th style={{ textAlign: 'right' }}>Type</th>
              <td>
                <label><input type="radio" value='UEN' readOnly checked={type === 'UEN'} />
                  UEN</label><br />
                <label><input type="radio" value='Phone number' readOnly checked={type === 'Phone number'} />
                  Phone number</label><br />
              </td>
            </tr>
            {type === 'UEN' && <tr>
              <th>Payment reference</th>
              <td>
                <input type="text" value={paymentReference} onInput={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentReference(e.target.value)} />
              </td>
            </tr>}
            <tr>
              <td colSpan={2} style={{ textAlign: 'center' }}>
                <button disabled={type === null} onClick={handleConfirm}>Add</button>
                <button onClick={handleCancel}>Cancel</button>
              </td>
            </tr>
          </tbody>
        </table></div>
    </PopupSpace>
  </>
}

function PopupSpace(props: { children: React.ReactNode | Array<React.ReactNode>, style: Record<string, string | number | null | undefined> }) {
  return createPortal(
    <div className="canvas-portal" style={props.style}>
      {props.children}
    </div>,
    document.body
  )
}
