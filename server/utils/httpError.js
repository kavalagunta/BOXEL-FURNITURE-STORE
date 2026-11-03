export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.expose = true;
    Object.assign(this, extra);
  }
}

export const badRequest = (msg, extra) => new HttpError(400, msg, extra);
export const unauthorized = (msg = 'Please sign in to continue.') => new HttpError(401, msg);
export const forbidden = (msg = 'You do not have permission to do that.') => new HttpError(403, msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, msg);
export const conflict = (msg, extra) => new HttpError(409, msg, extra);
export const unprocessable = (msg, extra) => new HttpError(422, msg, extra);
