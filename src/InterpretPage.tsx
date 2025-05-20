import React, { Fragment, useCallback, useContext } from 'react'
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
    {hasPaymentMethods && <button style={{ width: '100%' }} onClick={() => appStateContext!.setPage({
      id: 'compose',
      data: {
        paymentMethods: extractPaymentMethodsFromParseResult(paymentMethodElements),
      }
    })}>Combine with other QRs</button>}
  </>
}


function URLInterpretation(props: { data: string }) {
  let parsedData: URL | null = null;

  try {
    parsedData = new URL(props.data)
  } catch (e) {
    return null;
  }

  if (!parsedData) return;

  return <>
    <p><strong>You have scanned a URL!</strong></p>
    <p>The website is hosted at <strong >{parsedData.protocol}://{parsedData.hostname}</strong>.</p>
    <p>Please verify that the domain is expected before visiting the website.</p>
    <p><a style={{ display: 'inline-block', margin: '0.8em', backgroundColor: '#DDD', borderRadius: '0.5em', padding: '0.8em', fontSize: '150%', fontWeight: 'bold' }} href={props.data}>➛ Go to site</a></p>
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
          return (<Fragment key={index}>
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
          </Fragment>)
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
    <URLInterpretation data={props.data} />
    <EMVCoInterpretation data={props.data} />
  </>
}

function InterpretPage({ rawData: data }: { rawData: string | null }) {
  const appStateContext = useContext(AppStateContext);
  const setData = useCallback((data: string) => {
    appStateContext?.setPage({
      id: 'interpret',
      data: {
        rawData: data
      }
    })
  }, [appStateContext])

  const interpretImage = useCallback((imageData: ReturnType<CanvasRenderingContext2D["getImageData"]>) => {
    return jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
  }, [])

  const handleImageCaptured = useCallback((result: ReturnType<typeof jsQR>) => {
    setData(result!.data)
  }, [setData])

  const RImageCapturer = ImageCapturer<ReturnType<typeof jsQR>>

  const Capture = (props: { label: string }) => <>
    <RImageCapturer tester={interpretImage} onImageCaptured={handleImageCaptured}>
      {({ captureImage }) => (<>
        {<button style={{ width: '100%' }} onClick={captureImage}>{props.label}</button>}
      </>)}
    </RImageCapturer>
  </>

  if (data) {
    return <>
      <Capture label="Capture QR" />
      <RenderData data={data} />
    </>
  } else {
    return (
      <>
        <Capture label="Capture QR" />
        {!data && <>
          <section style={{ textAlign: 'left' }}>
            <h1>QR Parser and SGQR Inspector</h1>
            <p>
              Hello! This page will let you inspect any QR code. If the QR code is an{' '}
              <a href="https://www.mas.gov.sg/development/e-payments/sgqr">SGQR</a>{' '}
              code, it will tell you what goes into the SGQR code.
            </p>
            <p>
              For example scanning the following QR code yields the following details:
            </p>
            <p>
              <img src="public/sample-qr.png" style={{ width: '40%', height: 'auto' }} />
              <img src="public/captured-information.png" style={{ width: '40%', height: 'auto' }} />
            </p>
          </section>
          <section>
            <Capture label="Try it now!" />
            <p>
              For example, it will tell you all the payment methods supported by
              the SGQR code (yes! you can list more than one payment method in one SGQR code!
              For example, you can combine a Grabpay QR with a PayNow QR.) It can tell you the
              GrabPay / NETS QR merchant ID.
            </p>
            <p>
              After you capture the SGQR code, you can further combine it with other SGQR codes.
              When you have multiple payment methods in your SGQR, you can reorder them in your
              preferred priority order.
            </p>
            <p>
              <img src="public/example-of-too-many.jpg" style={{ width: '40%', height: 'auto', verticalAlign: 'middle' }} />
              {' '}→ becomes →{' '}
              <img src="public/combine-qrs.jpg" style={{ maxHeight: '300px', maxWidth: '40%', verticalAlign: 'middle' }} />
            </p>
            <p>
              So, if you've been trying to understand why certain QRs are not supported by your
              favourite App, or why your favourite coffee uncle has "PayNow: 9XXXXXXX" written just
              above their SGQR code, use this tool -- you'll probably discover that despite being super
              popular, NETS QR is not widely supported beyond the bank apps. I personally love
              Google Pay but it's not an option with many hawker stalls. Oh well. Shrugs.
            </p>
            <p>
              <strong>MAS, if you're reading this, please fix the interoperability problem.</strong>
            </p>
            <h2>A word about competition</h2>
            <p>
              Singapore believes in the free market. And yet somehow in the world of low-cost
              QR-code payments, Singapore does not seem to foster much competition --
              NETS pretty much has a monopoly position among hawker stalls.
            </p>
            <p>
              This would be fine with me if the bank apps were actually great, but they aren't.
              They suck. <strong>Loading</strong> the bank apps alone takes me at least 15s on my
              medium-high end Oppo Reno 10 Pro. That's not to mention the number of silly
              taps and swipes that I have to make just to scan a QR code.
              This is absolutely ridiculous. Worse, because the banks know that it's easier to
              change spouses than to change bank accounts, they aren't incentivized to make their
              apps better because they know we're stuck with our banks.
            </p>
            <p>
              Google Pay and GrabPay offer much better interfaces, but for various reasons,
              they only support PayNow; and GrabPay only supports UEN PayNows.
            </p>
            <p>
              Hear me out -- I love NETS when I don't see them. FAST is great and PayNow is great,
              and I know that NETS powers these rails. On top of that,
              the fees on NETS cards are reasonable, unlike Visa/Mastercard.
            </p>
            <p>
              However, when NETS builds apps, I won't touch them with a ten-foot pole. Just look
              at the Play Store ratings:
              <ul>
                <li>NETS App: 1.9★</li>
                <li>NETS vCashCard: 2.5★</li>
                <li>NETSBiz: 3.7★</li>
              </ul>
              Meanwhile, Google Pay has a whopping 4.4★, and GrabPay 4.7★.
            </p>
            <p><strong>So, MAS, for the sake of Singaporeans and Singapore residents,
              let's just admit that building nice user-facing Apps isn't NETS's strong suit,
              nor DBS/OCBC/UOB's strong suit.
              Let's instead ensure that there can be some degree of competition in our choice
              of apps.</strong></p>
            <p>China has put in place regulations to ensure that WeChat Pay codes are scannable
              by Alipay and vice-versa. In India, UPI is also accessible by a large range of bank apps.
              I think Singapore with a population of around two-hundredths of these countries can
              and should do better.
            </p>
            <p>Thank you for reading. @xkjyeah 2024-05-25
            </p>
          </section>
          <RImageCapturer tester={interpretImage} onImageCaptured={handleImageCaptured}>
            {({ captureImage, isCapturing }) => (<>
              {!isCapturing && <button style={{ width: '100%' }} onClick={captureImage}>Capture QR</button>}
            </>)}
          </RImageCapturer>
        </>}
      </>
    )
  }
}


export default InterpretPage
