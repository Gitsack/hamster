import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML pages for certain error
   * codes. You might want to enable them in production only, but feel
   * free to enable them in development as well.
   */
  protected renderStatusPages = app.inProduction

  /**
   * Status pages is a collection of error code range and a callback
   * to return the HTML contents to send as a response.
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (error, { inertia }) => inertia.render('errors/not_found', { error }),
    '500..599': (error, { inertia }) => inertia.render('errors/server_error', { error }),
  }

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    // Return JSON for API routes instead of rendering Inertia error pages
    if (ctx.request.url().startsWith('/api/')) {
      const err = error as any
      const status = err?.status || 500
      const message = err?.message || 'Internal server error'
      const body: Record<string, any> = { error: message }
      if (err?.messages) {
        body.details = err.messages
      }
      ctx.response.status(status).send(body)
      return
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    // Log API errors to stdout so they appear in docker logs
    if (ctx.request.url().startsWith('/api/')) {
      const err = error as any
      console.error(`[API Error] ${ctx.request.method()} ${ctx.request.url()}:`, err?.message || err)
    }

    return super.report(error, ctx)
  }
}
