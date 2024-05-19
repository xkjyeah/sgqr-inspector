import React, { useCallback, useState, useContext } from 'react'
import './App.css'
import jsQR from 'jsqr'
import { UNKNOWN, ParseError, parseData, EMVCoMPMContext } from './EMVCoMPMContext'
import type { Interpretation, ParseResult, ParsedElement } from './EMVCoMPMContext'
import { AppStateContext } from './State'
import { ImageCapturer } from './ImageCapturer'
import { extractPaymentMethodsFromParseResult } from './PaymentMethod'

function renderDescription(s: string | typeof UNKNOWN): React.ReactNode {
  if (typeof s === 'string') {
    return s
  } else {
    return <em>Unknown</em>
  }
}

function renderInterpretation(s: Interpretation | null) {
  if (typeof s === 'string') {
    return s
  } else if (s === null) {
    return null
  } else if (s === UNKNOWN) {
    return <em>Unknown</em>
  } else {
    return renderParseResult(s)
  }
}


function EMVCoInterpretation(props: { data: string }) {
  const parseResult = parseData(EMVCoMPMContext, props.data)
  const appStateContext = useContext(AppStateContext);

  const paymentMethodElements = parseResult.elements.filter((e): e is ParsedElement =>
    !(e instanceof ParseError) &&
    e.elementID >= '26' && e.elementID <= '51'
  )
  const hasPaymentMethods = paymentMethodElements.length > 0

  return <>
    {renderParseResult(parseResult)}
    {hasPaymentMethods && <button onClick={() => appStateContext!.setPage({
      id: 'compose',
      data: {
        paymentMethods: extractPaymentMethodsFromParseResult(paymentMethodElements),
      }
    })}>Combine with other QRs</button>}
  </>

}

function renderParseResult(parseResult: ParseResult) {
  return <table>
    <thead>
      <tr><th colSpan={3}>{parseResult.context.name}</th></tr>
    </thead>
    <tbody>
      {parseResult.elements.map((elem, index) => {
        if (elem instanceof ParseError) {
          return (<tr key={index}><td colSpan={3}>{elem.message}</td></tr>)
        } else {
          return (<>
            <tr key={index + '._1'} className="group-start">
              <td>{elem.elementID}</td>
              <td>{renderDescription(elem.description)}</td>
              <td>
                <RawValue value={elem.rawValue}></RawValue>
              </td>
            </tr>
            {elem.interpretation && <tr key={index + '._2'}>
              <td></td>
              <td colSpan={2}>
                {renderInterpretation(elem.interpretation)}
              </td>
            </tr>}
          </>)
        }
      })}
    </tbody>
  </table>
}

function RawValue(props: { value: string }) {
  return <div style={{
    width: '100%',
    whiteSpace: 'normal',
    maxWidth: '100%',
    maxHeight: '300px',
    overflow: 'hidden',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    textAlign: 'left',
    border: 'solid 1px black',
  }}>
    {props.value}
  </div>
}


function RenderData(props: { data: string | null }) {
  if (props.data === null) {
    return null;
  }

  return <>
    <div style={{ textAlign: 'left' }}>
      Captured data:
    </div>
    <RawValue value={props.data}></RawValue>
    <EMVCoInterpretation data={props.data} />
  </>
}

function InterpretPage() {
  const [data, setData] = useState<string | null>('00020101021126810011SG.COM.NETS01231198500065G9912312359000211111687665000308687665019908B97B381427530008com.grab0132312d0578749b4d2e89009e362bc39d6f0201228460010com.myfave0128https://myfave.com/qr/ejwnr55204000053037025802SG5902NA6009Singapore63042E15')

  const interpretImage = useCallback((imageData: ReturnType<CanvasRenderingContext2D["getImageData"]>) => {
    return jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
  }, [])

  const handleImageCaptured = useCallback((result: ReturnType<typeof jsQR>) => {
    setData(result!.data)
  }, [setData])

  const RImageCapturer = ImageCapturer<ReturnType<typeof jsQR>>

  return (
    <>
      <RImageCapturer tester={interpretImage} onImageCaptured={handleImageCaptured}>
        {({ captureImage, isCapturing, stopCapture }) => (<>
          {!isCapturing && <button onClick={captureImage}>Capture QR</button>}
          {isCapturing && <button onClick={stopCapture}>Stop Capture</button>}
        </>)}
      </RImageCapturer>
      <RenderData data={data} />
    </>
  )
}


export default InterpretPage
