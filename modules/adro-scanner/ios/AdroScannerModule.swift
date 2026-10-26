import AVFoundation
import ExpoModulesCore
import UIKit
import VisionKit

/// Apple's own barcode scanner (the one Live Text uses), shown inside a view on our screen instead of over it.
/// It switches lenses to focus up close, lets you pinch to zoom and highlights the code it reads.
public final class AdroScannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AdroScanner")

    View(AdroScannerView.self) {
      Events("onCode", "onUnavailable")

      Prop("active") { (view: AdroScannerView, active: Bool?) in
        view.active = active ?? true
      }

      Prop("torch") { (view: AdroScannerView, on: Bool?) in
        view.torch = on ?? false
      }
    }
  }
}

public final class AdroScannerView: ExpoView {
  let onCode = EventDispatcher()
  let onUnavailable = EventDispatcher()

  var active = true {
    didSet { update() }
  }
  var torch = false {
    didSet { setTorch() }
  }

  /// The DataScannerViewController (typed loosely so the class itself needs no iOS 16 check).
  private var scanner: UIViewController?
  private var lastCode: String?
  private var reportedUnavailable = false

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    update()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    scanner?.view.frame = bounds
  }

  private func update() {
    if window != nil && active {
      start()
    } else {
      stop()
    }
  }

  private func unavailable(_ reason: String) {
    if reportedUnavailable { return }
    reportedUnavailable = true
    onUnavailable(["reason": reason])
  }

  private func start() {
    guard #available(iOS 16.0, *) else {
      unavailable("ios")
      return
    }
    if let current = scanner as? DataScannerViewController {
      if !current.isScanning { try? current.startScanning() }
      return
    }
    guard DataScannerViewController.isSupported else {
      unavailable("unsupported")
      return
    }
    guard DataScannerViewController.isAvailable else {
      unavailable("unavailable")
      return
    }
    let controller = DataScannerViewController(
      recognizedDataTypes: [.barcode(symbologies: [.ean13, .ean8, .upce])],
      qualityLevel: .balanced,
      recognizesMultipleItems: false,
      isHighFrameRateTrackingEnabled: true,
      isPinchToZoomEnabled: true,
      isGuidanceEnabled: true,
      isHighlightingEnabled: true
    )
    controller.delegate = self
    // A child of the screen's controller, so it lives inside this view (not presented over the app).
    if let parent = parentController() {
      parent.addChild(controller)
      addSubview(controller.view)
      controller.didMove(toParent: parent)
    } else {
      addSubview(controller.view)
    }
    controller.view.frame = bounds
    controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    scanner = controller
    lastCode = nil
    do {
      try controller.startScanning()
    } catch {
      unavailable("start")
    }
  }

  private func stop() {
    guard let controller = scanner else { return }
    if #available(iOS 16.0, *), let dataScanner = controller as? DataScannerViewController {
      dataScanner.stopScanning()
    }
    controller.willMove(toParent: nil)
    controller.view.removeFromSuperview()
    controller.removeFromParent()
    scanner = nil
  }

  private func parentController() -> UIViewController? {
    var responder: UIResponder? = self
    while let next = responder?.next {
      if let controller = next as? UIViewController { return controller }
      responder = next
    }
    return nil
  }

  /// Best effort: the scanner keeps its own camera session, the torch is the phone's.
  private func setTorch() {
    guard let device = AVCaptureDevice.default(for: .video), device.hasTorch else { return }
    do {
      try device.lockForConfiguration()
      device.torchMode = torch ? .on : .off
      device.unlockForConfiguration()
    } catch {}
  }

  fileprivate func send(_ items: [RecognizedItemBox]) {
    for item in items where item.value != lastCode {
      lastCode = item.value
      onCode(["data": item.value, "type": item.type])
      return
    }
  }
}

/// A read barcode: its digits and kind.
struct RecognizedItemBox {
  let value: String
  let type: String
}

@available(iOS 16.0, *)
extension AdroScannerView: DataScannerViewControllerDelegate {
  private func boxes(_ items: [RecognizedItem]) -> [RecognizedItemBox] {
    items.compactMap { item in
      if case .barcode(let code) = item, let value = code.payloadStringValue {
        return RecognizedItemBox(value: value, type: code.observation.symbology.rawValue)
      }
      return nil
    }
  }

  public func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
    send(boxes(addedItems))
  }

  public func dataScanner(_ dataScanner: DataScannerViewController, didTapOn item: RecognizedItem) {
    send(boxes([item]))
  }

  public func dataScanner(_ dataScanner: DataScannerViewController, becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable) {
    unavailable("lost")
  }
}
