import SwiftUI
import WidgetKit

enum Links {
  static let day = URL(string: "skkiltime:///")!
  static let add = URL(string: "skkiltime://add")!
}

struct GlanceTimelineEntry: TimelineEntry {
  let date: Date
  let ink: GlanceInk
  let mustsLabel: String
  let glance: GlanceEntry
}

struct GlanceProvider: TimelineProvider {
  func placeholder(in context: Context) -> GlanceTimelineEntry {
    entries(of: .sample, from: Date())[0]
  }

  func getSnapshot(in context: Context, completion: @escaping (GlanceTimelineEntry) -> Void) {
    let snapshot = context.isPreview ? GlanceSnapshot.sample : GlanceSnapshot.read()
    completion(entries(of: snapshot, from: Date())[0])
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GlanceTimelineEntry>) -> Void) {
    completion(Timeline(entries: entries(of: GlanceSnapshot.read(), from: Date()), policy: .never))
  }

  private func entries(of snapshot: GlanceSnapshot, from date: Date) -> [GlanceTimelineEntry] {
    snapshot.timeline(from: date).map { date, glance in
      GlanceTimelineEntry(
        date: date, ink: snapshot.ink, mustsLabel: snapshot.mustsLabel, glance: glance)
    }
  }
}

struct LineView: View {
  let line: GlanceLine
  let ink: GlanceInk
  let prominent: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(line.label)
        .font(.system(size: 11, weight: .medium))
        .kerning(0.6)
        .foregroundStyle(Color(argb: ink.faint))
      Text(line.title)
        .font(.system(size: prominent ? 18 : 14, weight: prominent ? .light : .regular))
        .foregroundStyle(Color(argb: ink.primary))
        .lineLimit(prominent ? 2 : 1)
      if let from = line.countingFrom {
        Text(Date(timeIntervalSince1970: from), style: .timer)
          .font(.system(size: 12).monospacedDigit())
          .foregroundStyle(Color(argb: ink.secondary))
      } else if let detail = line.detail {
        Text(detail)
          .font(.system(size: 12).monospacedDigit())
          .foregroundStyle(Color(argb: ink.secondary))
          .lineLimit(1)
      }
    }
  }
}

struct MustsView: View {
  let entry: GlanceTimelineEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      if !entry.glance.musts.isEmpty {
        Text(entry.mustsLabel)
          .font(.system(size: 11, weight: .medium))
          .kerning(0.6)
          .foregroundStyle(Color(argb: entry.ink.faint))
      }
      ForEach(Array(entry.glance.musts.enumerated()), id: \.offset) { _, must in
        HStack(spacing: 8) {
          Circle()
            .strokeBorder(Color(argb: entry.ink.faint), lineWidth: 1.5)
            .frame(width: 12, height: 12)
          Text(must)
            .font(.system(size: 14))
            .foregroundStyle(Color(argb: entry.ink.primary))
            .lineLimit(1)
        }
      }
      Spacer(minLength: 0)
      if let earlier = entry.glance.earlier {
        Text(earlier)
          .font(.system(size: 12))
          .foregroundStyle(Color(argb: entry.ink.secondary))
          .lineLimit(1)
      }
    }
  }
}

struct TodayView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlanceTimelineEntry

  var body: some View {
    HStack(alignment: .top, spacing: 16) {
      VStack(alignment: .leading, spacing: 0) {
        LineView(line: entry.glance.now, ink: entry.ink, prominent: true)
        Spacer(minLength: 8)
        if let next = entry.glance.next {
          LineView(line: next, ink: entry.ink, prominent: false)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      if family == .systemMedium {
        MustsView(entry: entry)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .sky(entry.glance.sky)
    .widgetURL(Links.day)
  }
}

struct QuickAddView: View {
  let entry: GlanceTimelineEntry

  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "plus")
        .font(.system(size: 26, weight: .light))
        .foregroundStyle(Color(argb: entry.ink.primary))
        .frame(width: 56, height: 56)
        .background(Circle().fill(Color(argb: entry.ink.glass)))
        .overlay(Circle().strokeBorder(Color(argb: entry.ink.hairline), lineWidth: 1))
      Text("Quick add")
        .font(.system(size: 13))
        .foregroundStyle(Color(argb: entry.ink.secondary))
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .sky(entry.glance.sky)
    .widgetURL(Links.add)
  }
}

struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "today", provider: GlanceProvider()) { entry in
      TodayView(entry: entry)
    }
    .configurationDisplayName("Today")
    .description("Now, next and today's musts")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct QuickAddWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "quick-add", provider: GlanceProvider()) { entry in
      QuickAddView(entry: entry)
    }
    .configurationDisplayName("Quick add")
    .description("Add a task in one tap")
    .supportedFamilies([.systemSmall])
  }
}

@main
struct SkkilWidgets: WidgetBundle {
  var body: some Widget {
    TodayWidget()
    QuickAddWidget()
  }
}
