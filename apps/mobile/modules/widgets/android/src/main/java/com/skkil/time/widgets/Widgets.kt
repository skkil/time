package com.skkil.time.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews
import kotlin.math.max
import kotlin.math.min

object Widgets {
  const val DAY_URL = "skkiltime:///"
  const val ADD_URL = "skkiltime://add"
  private const val CORNER_DP = 24f
  private const val LONGEST_SIDE_PX = 900f

  fun refresh(context: Context) {
    TodayWidget.updateAll(context)
    QuickAddWidget.updateAll(context)
  }

  fun ids(context: Context, provider: Class<*>): IntArray =
    AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, provider))

  fun open(context: Context, url: String): PendingIntent =
    PendingIntent.getActivity(
      context,
      url.hashCode(),
      Intent(Intent.ACTION_VIEW, Uri.parse(url))
        .setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

  fun widthDp(options: Bundle, fallback: Int) =
    options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH).takeIf { it > 0 } ?: fallback

  fun heightDp(options: Bundle, fallback: Int) =
    options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT).takeIf { it > 0 } ?: fallback

  fun paintSky(views: RemoteViews, viewId: Int, context: Context, sky: Sky, widthDp: Int, heightDp: Int) {
    val density = context.resources.displayMetrics.density
    val scale = min(density, LONGEST_SIDE_PX / max(widthDp, heightDp))
    val width = max(1, (widthDp * scale).toInt())
    val height = max(1, (heightDp * scale).toInt())
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val bounds = RectF(0f, 0f, width.toFloat(), height.toFloat())
    val corner = CORNER_DP * scale
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.shader = LinearGradient(0f, 0f, 0f, height.toFloat(), sky.top, sky.bottom, Shader.TileMode.CLAMP)
    canvas.drawRoundRect(bounds, corner, corner, paint)
    val reach = max(width, height) * 0.75f
    paint.shader = RadialGradient(
      width * 0.15f,
      height * 0.1f,
      reach,
      sky.glow,
      sky.glow and 0x00ffffff,
      Shader.TileMode.CLAMP,
    )
    canvas.drawRoundRect(bounds, corner, corner, paint)
    views.setImageViewBitmap(viewId, bitmap)
  }
}
