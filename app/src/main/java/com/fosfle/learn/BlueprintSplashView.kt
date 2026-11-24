package com.fosfle.learn

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import android.view.animation.DecelerateInterpolator
import androidx.core.content.ContextCompat
import kotlin.math.min

/**
 * Custom hardware-accelerated Canvas splash view for Fosfle.
 * Aesthetic: Architectural Blueprint & Editorial Code Craft
 * Draws progressive drafting lines, animated syntax brackets (<  />),
 * the authentic Fosfle emblem, and a crisp monospace loading telemetry rail.
 */
class BlueprintSplashView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var progress = 0f
    private val density = resources.displayMetrics.density
    private fun dp(v: Float) = v * density

    private val bgPaint = Paint().apply {
        color = Color.parseColor("#001240")
        style = Paint.Style.FILL
    }

    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#0F2766")
        strokeWidth = dp(1f)
        style = Paint.Style.STROKE
    }

    private val crossPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#2A4EA8")
        strokeWidth = dp(1.2f)
        style = Paint.Style.STROKE
    }

    private val bracketPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#4D88FF")
        strokeWidth = dp(3.2f)
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        style = Paint.Style.STROKE
    }

    private val slashPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#F59E0B")
        strokeWidth = dp(3.0f)
        strokeCap = Paint.Cap.ROUND
        style = Paint.Style.STROKE
    }

    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#1D5BFF")
        strokeWidth = dp(1.5f)
        style = Paint.Style.STROKE
    }

    private val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = dp(28f)
        typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
        letterSpacing = 0.14f
        textAlign = Paint.Align.CENTER
    }

    private val subtitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#8FA8E8")
        textSize = dp(12.5f)
        typeface = Typeface.create("sans-serif", Typeface.NORMAL)
        letterSpacing = 0.06f
        textAlign = Paint.Align.CENTER
    }

    private val monoPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#7392DE")
        textSize = dp(10.5f)
        typeface = Typeface.MONOSPACE
        textAlign = Paint.Align.LEFT
    }

    private val pctPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#C7D7FF")
        textSize = dp(10.5f)
        typeface = Typeface.MONOSPACE
        textAlign = Paint.Align.RIGHT
    }

    private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#0E2257")
        style = Paint.Style.FILL
    }

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#2B6BFF")
        style = Paint.Style.FILL
    }

    private val brandBitmap: Bitmap? by lazy {
        val drawable = ContextCompat.getDrawable(context, R.drawable.ic_fosfle_brand) ?: return@lazy null
        val size = dp(96f).toInt()
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        drawable.setBounds(0, 0, size, size)
        drawable.draw(c)
        bmp
    }

    private val logoPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val leftBracket = Path()
    private val rightBracket = Path()
    private val drawnPath = Path()
    private val pathMeasure = PathMeasure()
    private val trackRect = RectF()
    private val fillRect = RectF()

    private var animator: ValueAnimator? = null

    fun startSequence(durationMs: Long = 1750L, onFinished: () -> Unit) {
        animator?.cancel()
        animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = durationMs
            interpolator = DecelerateInterpolator(1.35f)
            addUpdateListener { anim ->
                progress = anim.animatedValue as Float
                invalidate()
            }
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    onFinished()
                }
            })
            start()
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        animator?.cancel()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        val cx = w * 0.5f
        val cy = h * 0.44f

        // 1. Deep Fosfle navy drafting background
        canvas.drawRect(0f, 0f, w, h, bgPaint)

        // 2. Subtle architectural drafting grid (fades in smoothly)
        val gridAlpha = (min(1f, progress / 0.35f) * 140).toInt()
        gridPaint.alpha = gridAlpha
        val step = dp(36f)
        var x = cx % step
        while (x < w) {
            canvas.drawLine(x, 0f, x, h, gridPaint)
            x += step
        }
        var y = cy % step
        while (y < h) {
            canvas.drawLine(0f, y, w, y, gridPaint)
            y += step
        }

        // 3. Corner registration crosshairs
        crossPaint.alpha = (min(1f, progress / 0.4f) * 200).toInt()
        val margin = dp(28f)
        val arm = dp(8f)
        drawCross(canvas, margin, margin + dp(24f), arm)
        drawCross(canvas, w - margin, margin + dp(24f), arm)
        drawCross(canvas, margin, h - margin - dp(24f), arm)
        drawCross(canvas, w - margin, h - margin - dp(24f), arm)

        // 4. Precision drafting circle behind brand emblem
        val ringReveal = ((progress - 0.08f) / 0.45f).coerceIn(0f, 1f)
        val radius = dp(64f)
        ringPaint.alpha = (ringReveal * 115).toInt()
        canvas.drawArc(
            cx - radius, cy - radius, cx + radius, cy + radius,
            -90f, 360f * ringReveal, false, ringPaint
        )

        // 5. Animated code brackets `<` and `/>` framing the Fosfle emblem
        val bracketReveal = ((progress - 0.12f) / 0.45f).coerceIn(0f, 1f)
        val bSpan = dp(88f)
        val bH = dp(24f)
        val bW = dp(14f)

        leftBracket.reset()
        leftBracket.moveTo(cx - bSpan + bW, cy - bH)
        leftBracket.lineTo(cx - bSpan, cy)
        leftBracket.lineTo(cx - bSpan + bW, cy + bH)
        drawPartialPath(canvas, leftBracket, bracketReveal, bracketPaint)

        rightBracket.reset()
        rightBracket.moveTo(cx + bSpan - bW, cy - bH)
        rightBracket.lineTo(cx + bSpan, cy)
        rightBracket.lineTo(cx + bSpan - bW, cy + bH)
        drawPartialPath(canvas, rightBracket, bracketReveal, bracketPaint)

        // Warm amber accent slash next to right bracket
        val slashReveal = ((progress - 0.30f) / 0.30f).coerceIn(0f, 1f)
        if (slashReveal > 0f) {
            val sx1 = cx + bSpan - dp(24f)
            val sy1 = cy + dp(18f)
            val sx2 = cx + bSpan - dp(16f)
            val sy2 = cy - dp(18f)
            canvas.drawLine(
                sx1, sy1,
                sx1 + (sx2 - sx1) * slashReveal,
                sy1 + (sy2 - sy1) * slashReveal,
                slashPaint
            )
        }

        // 6. Authentic Fosfle Logo with subtle scale-in
        brandBitmap?.let { bmp ->
            val logoReveal = ((progress - 0.05f) / 0.35f).coerceIn(0f, 1f)
            val scale = 0.86f + 0.14f * logoReveal
            logoPaint.alpha = (logoReveal * 255).toInt()
            canvas.save()
            canvas.translate(cx, cy)
            canvas.scale(scale, scale)
            val half = bmp.width / 2f
            canvas.drawBitmap(bmp, -half, -half, logoPaint)
            canvas.restore()
        }

        // 7. Brand wordmark & tagline
        val textReveal = ((progress - 0.25f) / 0.35f).coerceIn(0f, 1f)
        val slideY = (1f - textReveal) * dp(12f)
        titlePaint.alpha = (textReveal * 255).toInt()
        subtitlePaint.alpha = (textReveal * 220).toInt()
        canvas.drawText("FOSFLE", cx, cy + dp(104f) + slideY, titlePaint)
        canvas.drawText("Interactive Coding Academy", cx, cy + dp(126f) + slideY, subtitlePaint)

        // 8. Tactile bottom progress rail & live status telemetry
        val railWidth = min(w - dp(64f), dp(280f))
        val railLeft = cx - railWidth / 2f
        val railRight = cx + railWidth / 2f
        val railTop = h - dp(96f)
        val railHeight = dp(4.5f)
        val corner = dp(3f)

        trackRect.set(railLeft, railTop, railRight, railTop + railHeight)
        canvas.drawRoundRect(trackRect, corner, corner, trackPaint)

        val fillWidth = (railWidth * progress).coerceAtLeast(dp(6f))
        fillRect.set(railLeft, railTop, railLeft + fillWidth, railTop + railHeight)
        canvas.drawRoundRect(fillRect, corner, corner, fillPaint)

        val status = when {
            progress < 0.34f -> "BOOTING COURSE ENGINE"
            progress < 0.68f -> "LOADING 19 HTML5 MODULES"
            progress < 0.92f -> "SYNCING FOSFLE CLOUD"
            else -> "READY TO LEARN"
        }
        val pct = "${(progress * 100).toInt().coerceIn(0, 100)}%"
        canvas.drawText(status, railLeft, railTop - dp(10f), monoPaint)
        canvas.drawText(pct, railRight, railTop - dp(10f), pctPaint)
    }

    private fun drawCross(canvas: Canvas, x: Float, y: Float, arm: Float) {
        canvas.drawLine(x - arm, y, x + arm, y, crossPaint)
        canvas.drawLine(x, y - arm, x, y + arm, crossPaint)
    }

    private fun drawPartialPath(canvas: Canvas, path: Path, fraction: Float, paint: Paint) {
        if (fraction <= 0f) return
        pathMeasure.setPath(path, false)
        drawnPath.reset()
        pathMeasure.getSegment(0f, pathMeasure.length * fraction, drawnPath, true)
        canvas.drawPath(drawnPath, paint)
    }
}
