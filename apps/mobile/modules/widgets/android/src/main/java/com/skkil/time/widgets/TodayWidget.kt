package com.skkil.time.widgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews

class TodayWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    render(context, manager, ids)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    render(context, manager, intArrayOf(id))
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action in REFRESH_ACTIONS) updateAll(context)
  }

  override fun onDisabled(context: Context) {
    alarms(context).cancel(tick(context))
  }

  companion object {
    private const val ACTION_TICK = "com.skkil.time.widgets.TODAY_TICK"
    private const val WIDE_DP = 250
    private const val SMALL_DP = 110
    private val REFRESH_ACTIONS = setOf(ACTION_TICK, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED)
    private val MUST_ROWS = intArrayOf(R.id.must_1, R.id.must_2, R.id.must_3)

    fun updateAll(context: Context) {
      render(context, AppWidgetManager.getInstance(context), Widgets.ids(context, TodayWidget::class.java))
    }

    private fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val snapshot = SnapshotStore.read(context)
      val seconds = System.currentTimeMillis() / 1000
      val entry = snapshot.entryAt(seconds)
      for (id in ids) manager.updateAppWidget(id, views(context, manager.getAppWidgetOptions(id), snapshot, entry))
      schedule(context, if (ids.isEmpty()) null else snapshot.changeAfter(seconds))
    }

    private fun views(context: Context, options: Bundle, snapshot: Snapshot, entry: Entry): RemoteViews {
      val width = Widgets.widthDp(options, SMALL_DP)
      val wide = width >= WIDE_DP
      val views = RemoteViews(
        context.packageName,
        if (wide) R.layout.widget_today_medium else R.layout.widget_today_small,
      )
      val ink = snapshot.ink
      Widgets.paintSky(views, R.id.sky, context, entry.sky, width, Widgets.heightDp(options, SMALL_DP))
      showLine(views, ink, entry.now, R.id.now_label, R.id.now_title, R.id.now_detail, R.id.now_timer)
      val next = entry.next
      views.setViewVisibility(R.id.next, if (next == null) View.GONE else View.VISIBLE)
      if (next != null) showLine(views, ink, next, R.id.next_label, R.id.next_title, R.id.next_detail, null)
      if (wide) showMusts(views, ink, snapshot.mustsLabel, entry)
      views.setOnClickPendingIntent(R.id.root, Widgets.open(context, Widgets.DAY_URL))
      return views
    }

    private fun showLine(
      views: RemoteViews,
      ink: Ink,
      line: Line,
      labelId: Int,
      titleId: Int,
      detailId: Int,
      timerId: Int?,
    ) {
      views.setTextViewText(labelId, line.label)
      views.setTextColor(labelId, ink.faint)
      views.setTextViewText(titleId, line.title)
      views.setTextColor(titleId, ink.primary)
      val detail = line.detail
      views.setViewVisibility(detailId, if (detail == null) View.GONE else View.VISIBLE)
      if (detail != null) {
        views.setTextViewText(detailId, detail)
        views.setTextColor(detailId, ink.secondary)
      }
      if (timerId == null) return
      val from = line.countingFrom
      views.setViewVisibility(timerId, if (from == null) View.GONE else View.VISIBLE)
      if (from == null) {
        views.setChronometer(timerId, SystemClock.elapsedRealtime(), null, false)
        return
      }
      val elapsed = System.currentTimeMillis() - from * 1000
      views.setChronometer(timerId, SystemClock.elapsedRealtime() - elapsed, null, true)
      views.setTextColor(timerId, ink.secondary)
    }

    private fun showMusts(views: RemoteViews, ink: Ink, label: String, entry: Entry) {
      views.setViewVisibility(R.id.musts_label, if (entry.musts.isEmpty()) View.GONE else View.VISIBLE)
      views.setTextViewText(R.id.musts_label, label)
      views.setTextColor(R.id.musts_label, ink.faint)
      MUST_ROWS.forEachIndexed { index, row ->
        val must = entry.musts.getOrNull(index)
        views.setViewVisibility(row, if (must == null) View.GONE else View.VISIBLE)
        if (must != null) {
          views.setTextViewText(row, must)
          views.setTextColor(row, ink.primary)
        }
      }
      val earlier = entry.earlier
      views.setViewVisibility(R.id.earlier, if (earlier == null) View.GONE else View.VISIBLE)
      if (earlier != null) {
        views.setTextViewText(R.id.earlier, earlier)
        views.setTextColor(R.id.earlier, ink.secondary)
      }
    }

    private fun alarms(context: Context) = context.getSystemService(AlarmManager::class.java)

    private fun tick(context: Context): PendingIntent =
      PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, TodayWidget::class.java).setAction(ACTION_TICK),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )

    private fun schedule(context: Context, at: Long?) {
      val alarms = alarms(context)
      if (at == null) {
        alarms.cancel(tick(context))
        return
      }
      alarms.set(AlarmManager.RTC, at * 1000, tick(context))
    }
  }
}
