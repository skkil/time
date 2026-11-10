import Foundation
import SwiftUI

struct GlanceLine: Decodable {
  let label: String
  let title: String
  let detail: String?
  let countingFrom: Double?
}

struct GlanceSky: Decodable {
  let top: String
  let bottom: String
  let glow: String
}

struct GlanceInk: Decodable {
  let primary: String
  let secondary: String
  let faint: String
  let glass: String
  let hairline: String
}

struct GlanceEntry: Decodable {
  let at: Double
  let sky: GlanceSky
  let now: GlanceLine
  let next: GlanceLine?
  let musts: [String]
  let earlier: String?
}

struct GlanceSnapshot: Decodable {
  static let currentVersion = 1
  static let appGroup = "group.com.skkil.time"
  static let fileName = "glance.json"

  let version: Int
  let ink: GlanceInk
  let mustsLabel: String
  let entries: [GlanceEntry]

  static func read() -> GlanceSnapshot {
    guard
      let folder = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroup),
      let data = try? Data(contentsOf: folder.appendingPathComponent(fileName)),
      let snapshot = try? JSONDecoder().decode(GlanceSnapshot.self, from: data),
      snapshot.version == currentVersion,
      !snapshot.entries.isEmpty
    else {
      return empty
    }
    return snapshot
  }

  func timeline(from date: Date) -> [(Date, GlanceEntry)] {
    let seconds = date.timeIntervalSince1970
    let current = entries.lastIndex { $0.at <= seconds } ?? 0
    return entries[current...].enumerated().map { offset, entry in
      (offset == 0 ? date : Date(timeIntervalSince1970: entry.at), entry)
    }
  }

  static let defaultInk = GlanceInk(
    primary: "#fff1f1ee",
    secondary: "#bff1f1ee",
    faint: "#66f1f1ee",
    glass: "#0fffffff",
    hairline: "#1fffffff")

  static let night = GlanceSky(top: "#ff070b1a", bottom: "#ff0d1430", glow: "#d9182c58")

  static let empty = GlanceSnapshot(
    version: currentVersion,
    ink: defaultInk,
    mustsLabel: "",
    entries: [
      GlanceEntry(
        at: 0,
        sky: night,
        now: GlanceLine(
          label: "skkil time", title: "Open skkil time to see today", detail: nil,
          countingFrom: nil),
        next: nil,
        musts: [],
        earlier: nil)
    ])

  static let sample = GlanceSnapshot(
    version: currentVersion,
    ink: defaultInk,
    mustsLabel: "Musts today",
    entries: [
      GlanceEntry(
        at: 0,
        sky: night,
        now: GlanceLine(
          label: "Now", title: "Write the spec", detail: "14:00–15:00", countingFrom: nil),
        next: GlanceLine(label: "Next", title: "Read", detail: "16:00", countingFrom: nil),
        musts: ["Call the bank", "Send the invoice"],
        earlier: "2 tasks from earlier days")
    ])
}

extension Color {
  init(argb: String) {
    let value = UInt32(argb.dropFirst(), radix: 16) ?? 0xFF00_0000
    self.init(
      .sRGB,
      red: Double((value >> 16) & 0xFF) / 255,
      green: Double((value >> 8) & 0xFF) / 255,
      blue: Double(value & 0xFF) / 255,
      opacity: Double((value >> 24) & 0xFF) / 255)
  }
}
