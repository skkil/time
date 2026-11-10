import ExpoModulesCore
import WidgetKit

public class WidgetsModule: Module {
  static let appGroup = "group.com.skkil.time"
  static let fileName = "glance.json"

  public func definition() -> ModuleDefinition {
    Name("SkkilWidgets")

    AsyncFunction("publish") { (json: String) in
      guard
        let folder = FileManager.default.containerURL(
          forSecurityApplicationGroupIdentifier: WidgetsModule.appGroup)
      else {
        throw AppGroupUnavailableException()
      }
      try Data(json.utf8).write(
        to: folder.appendingPathComponent(WidgetsModule.fileName), options: .atomic)
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}

final class AppGroupUnavailableException: Exception {
  override var reason: String {
    "The app group \(WidgetsModule.appGroup) is not set up for this build"
  }
}
