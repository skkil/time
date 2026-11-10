import SwiftUI
import WidgetKit

struct SkyView: View {
  let sky: GlanceSky

  var body: some View {
    GeometryReader { geometry in
      ZStack {
        LinearGradient(
          colors: [Color(argb: sky.top), Color(argb: sky.bottom)],
          startPoint: .top,
          endPoint: .bottom)
        RadialGradient(
          colors: [Color(argb: sky.glow), Color(argb: sky.glow).opacity(0)],
          center: UnitPoint(x: 0.15, y: 0.1),
          startRadius: 0,
          endRadius: max(geometry.size.width, geometry.size.height) * 0.75)
      }
    }
  }
}

extension View {
  @ViewBuilder
  func sky(_ sky: GlanceSky) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { SkyView(sky: sky) }
    } else {
      padding().background(SkyView(sky: sky))
    }
  }
}
