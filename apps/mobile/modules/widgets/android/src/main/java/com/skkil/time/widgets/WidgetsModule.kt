package com.skkil.time.widgets

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SkkilWidgets")

    AsyncFunction("publish") { json: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      SnapshotStore.write(context, json)
      Widgets.refresh(context)
    }
  }
}
