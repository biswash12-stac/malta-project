// What request data may reach the logs: the method, the path and the status code. Never the query
// string (admin search carries phone numbers and order numbers), headers (cookies) or bodies.
export const pathWithoutQuery = (url: string | undefined): string =>
  (url ?? "").split("?")[0] ?? "";

export const requestLogSerializers = {
  req: (req: { method?: string; url?: string }) => ({
    method: req.method,
    path: pathWithoutQuery(req.url),
  }),
  res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
};
