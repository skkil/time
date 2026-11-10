package com.skkil.time.widgets

import android.content.Context
import android.graphics.Color
import org.json.JSONObject
import java.io.File

data class Line(val label: String, val title: String, val detail: String?, val countingFrom: Long?)

data class Sky(val top: Int, val bottom: Int, val glow: Int)

data class Ink(val primary: Int, val secondary: Int, val faint: Int, val glass: Int, val hairline: Int)

data class Entry(
  val at: Long,
  val sky: Sky,
  val now: Line,
  val next: Line?,
  val musts: List<String>,
  val earlier: String?,
)

data class Snapshot(val ink: Ink, val mustsLabel: String, val entries: List<Entry>) {
  fun entryAt(seconds: Long): Entry = entries.lastOrNull { it.at <= seconds } ?: entries.first()

  fun changeAfter(seconds: Long): Long? = entries.firstOrNull { it.at > seconds }?.at

  companion object {
    const val VERSION = 1

    val EMPTY = Snapshot(
      ink = Ink(
        primary = Color.parseColor("#fff1f1ee"),
        secondary = Color.parseColor("#bff1f1ee"),
        faint = Color.parseColor("#66f1f1ee"),
        glass = Color.parseColor("#0fffffff"),
        hairline = Color.parseColor("#1fffffff"),
      ),
      mustsLabel = "",
      entries = listOf(
        Entry(
          at = 0,
          sky = Sky(Color.parseColor("#ff070b1a"), Color.parseColor("#ff0d1430"), Color.parseColor("#d9182c58")),
          now = Line("skkil time", "Open skkil time to see today", null, null),
          next = null,
          musts = emptyList(),
          earlier = null,
        ),
      ),
    )
  }
}

object SnapshotStore {
  private const val FOLDER = "widgets"
  private const val FILE = "glance.json"

  private fun file(context: Context) = File(File(context.filesDir, FOLDER), FILE)

  fun write(context: Context, json: String) {
    val target = file(context)
    target.parentFile?.mkdirs()
    val staged = File(target.parentFile, "$FILE.tmp")
    staged.writeText(json)
    if (!staged.renameTo(target)) {
      target.writeText(json)
      staged.delete()
    }
  }

  fun read(context: Context): Snapshot =
    runCatching { parse(JSONObject(file(context).readText())) }.getOrNull() ?: Snapshot.EMPTY

  private fun parse(json: JSONObject): Snapshot? {
    if (json.getInt("version") != Snapshot.VERSION) return null
    val ink = json.getJSONObject("ink")
    val entries = json.getJSONArray("entries")
    if (entries.length() == 0) return null
    return Snapshot(
      ink = Ink(
        primary = color(ink, "primary"),
        secondary = color(ink, "secondary"),
        faint = color(ink, "faint"),
        glass = color(ink, "glass"),
        hairline = color(ink, "hairline"),
      ),
      mustsLabel = json.getString("mustsLabel"),
      entries = (0 until entries.length()).map { entry(entries.getJSONObject(it)) },
    )
  }

  private fun entry(json: JSONObject): Entry {
    val sky = json.getJSONObject("sky")
    val musts = json.getJSONArray("musts")
    return Entry(
      at = json.getLong("at"),
      sky = Sky(color(sky, "top"), color(sky, "bottom"), color(sky, "glow")),
      now = line(json.getJSONObject("now")),
      next = json.optJSONObject("next")?.let(::line),
      musts = (0 until musts.length()).map { musts.getString(it) },
      earlier = text(json, "earlier"),
    )
  }

  private fun line(json: JSONObject) = Line(
    label = json.getString("label"),
    title = json.getString("title"),
    detail = text(json, "detail"),
    countingFrom = if (json.isNull("countingFrom")) null else json.getLong("countingFrom"),
  )

  private fun text(json: JSONObject, key: String): String? = if (json.isNull(key)) null else json.getString(key)

  private fun color(json: JSONObject, key: String) = Color.parseColor(json.getString(key))
}
