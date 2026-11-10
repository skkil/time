package com.skkil.time.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle
import android.widget.RemoteViews

class QuickAddWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    render(context, manager, ids)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    render(context, manager, intArrayOf(id))
  }

  companion object {
    private const val SMALL_DP = 110

    fun updateAll(context: Context) {
      render(context, AppWidgetManager.getInstance(context), Widgets.ids(context, QuickAddWidget::class.java))
    }

    private fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
      if (ids.isEmpty()) return
      val snapshot = SnapshotStore.read(context)
      val entry = snapshot.entryAt(System.currentTimeMillis() / 1000)
      for (id in ids) {
        val options = manager.getAppWidgetOptions(id)
        val views = RemoteViews(context.packageName, R.layout.widget_quick_add)
        Widgets.paintSky(
          views,
          R.id.sky,
          context,
          entry.sky,
          Widgets.widthDp(options, SMALL_DP),
          Widgets.heightDp(options, SMALL_DP),
        )
        views.setTextColor(R.id.plus, snapshot.ink.primary)
        views.setTextColor(R.id.quick_add_label, snapshot.ink.secondary)
        views.setOnClickPendingIntent(R.id.root, Widgets.open(context, Widgets.ADD_URL))
        manager.updateAppWidget(id, views)
      }
    }
  }
}
